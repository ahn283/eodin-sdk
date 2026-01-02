import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:hive/hive.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import '../models/event.dart';

/// Manages event queuing with offline support.
///
/// Features:
/// - Stores events locally when offline
/// - Automatically sends events when network is restored
/// - Batches events for efficient transmission
/// - Implements exponential backoff on failure
/// - Persists events across app restarts
class EventQueue {
  EventQueue._();

  static EventQueue? _instance;

  /// Singleton instance
  static EventQueue get instance {
    _instance ??= EventQueue._();
    return _instance!;
  }

  // Configuration
  String? _apiEndpoint;
  String? _apiKey;
  bool _debug = false;
  http.Client? _httpClient;

  // Hive storage
  Box<String>? _eventBox;
  static const String _boxName = 'eodin_events';

  // Queue settings
  static const int maxQueueSize = 1000;
  static const int maxBatchSize = 50;
  static const int flushThreshold = 20;
  static const Duration flushInterval = Duration(seconds: 30);
  static const Duration maxEventAge = Duration(days: 7);

  // State
  final List<AnalyticsEvent> _memoryQueue = [];
  bool _isInitialized = false;
  bool _isFlushing = false;
  Timer? _flushTimer;
  int _retryCount = 0;
  static const int maxRetries = 5;

  // Network monitoring
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  bool _isOnline = true;

  /// Initialize the event queue
  Future<void> initialize({
    required String apiEndpoint,
    required String apiKey,
    bool debug = false,
    http.Client? httpClient,
  }) async {
    if (_isInitialized) return;

    _apiEndpoint = apiEndpoint;
    _apiKey = apiKey;
    _debug = debug;
    _httpClient = httpClient;

    // Initialize Hive
    try {
      final appDocDir = await getApplicationDocumentsDirectory();
      Hive.init('${appDocDir.path}/eodin_analytics');
      _eventBox = await Hive.openBox<String>(_boxName);
      _log('Hive initialized with ${_eventBox!.length} stored events');
    } catch (e) {
      _log('Failed to initialize Hive: $e', isError: true);
    }

    // Load persisted events
    await _loadPersistedEvents();

    // Start network monitoring
    _startNetworkMonitoring();

    // Start flush timer
    _startFlushTimer();

    _isInitialized = true;
    _log('EventQueue initialized');
  }

  /// Add an event to the queue
  Future<void> enqueue(AnalyticsEvent event) async {
    if (!_isInitialized) {
      _log('EventQueue not initialized', isError: true);
      return;
    }

    // Check queue size limit
    if (_memoryQueue.length >= maxQueueSize) {
      // Remove oldest events
      final removeCount = _memoryQueue.length - maxQueueSize + 1;
      _memoryQueue.removeRange(0, removeCount);
      _log('Queue overflow, removed $removeCount old events');
    }

    _memoryQueue.add(event);
    _log('Enqueued event: ${event.eventName} (queue size: ${_memoryQueue.length})');

    // Persist to Hive
    await _persistEvent(event);

    // Check if we should flush
    if (_isOnline && _memoryQueue.length >= flushThreshold) {
      await flush();
    }
  }

  /// Flush pending events to the server
  Future<void> flush() async {
    if (!_isInitialized || _isFlushing || _memoryQueue.isEmpty) {
      return;
    }

    if (!_isOnline) {
      _log('Offline, skipping flush');
      return;
    }

    _isFlushing = true;

    try {
      // Take up to maxBatchSize events
      final eventsToSend = _memoryQueue.take(maxBatchSize).toList();

      _log('Flushing ${eventsToSend.length} events');

      final success = await _sendEvents(eventsToSend);

      if (success) {
        // Remove sent events from memory queue
        _memoryQueue.removeRange(0, eventsToSend.length);

        // Remove from Hive storage
        for (final event in eventsToSend) {
          await _removePersistedEvent(event.eventId);
        }

        _retryCount = 0;
        _log('Flush successful');

        // Continue flushing if more events
        if (_memoryQueue.isNotEmpty) {
          await flush();
        }
      } else {
        _retryCount++;
        _log('Flush failed, retry count: $_retryCount', isError: true);

        // Schedule retry with exponential backoff
        if (_retryCount <= maxRetries) {
          final delay = _calculateBackoff(_retryCount);
          _log('Scheduling retry in ${delay.inSeconds}s');
          Timer(delay, () => flush());
        }
      }
    } finally {
      _isFlushing = false;
    }
  }

  /// Get current queue size
  int get queueSize => _memoryQueue.length;

  /// Get persisted event count
  int get persistedEventCount => _eventBox?.length ?? 0;

  /// Whether currently online
  bool get isOnline => _isOnline;

  /// Dispose resources
  Future<void> dispose() async {
    _flushTimer?.cancel();
    _connectivitySubscription?.cancel();
    await _eventBox?.close();
    _isInitialized = false;
    _log('EventQueue disposed');
  }

  // Private methods

  Future<bool> _sendEvents(List<AnalyticsEvent> events) async {
    if (_apiEndpoint == null || _apiKey == null) {
      return false;
    }

    final client = _httpClient ?? http.Client();

    try {
      final response = await client.post(
        Uri.parse('$_apiEndpoint/events/collect'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-Key': _apiKey!,
        },
        body: jsonEncode({
          'events': events.map((e) => e.toJson()).toList(),
        }),
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body);
        _log('Send successful: received=${json['received']}, duplicates=${json['duplicates']}');
        return true;
      } else {
        _log('Send failed: ${response.statusCode} - ${response.body}', isError: true);
        return false;
      }
    } on SocketException catch (e) {
      _log('Network error: $e', isError: true);
      _isOnline = false;
      return false;
    } on TimeoutException catch (e) {
      _log('Timeout error: $e', isError: true);
      return false;
    } catch (e) {
      _log('Send error: $e', isError: true);
      return false;
    } finally {
      if (_httpClient == null) {
        client.close();
      }
    }
  }

  Future<void> _persistEvent(AnalyticsEvent event) async {
    if (_eventBox == null) return;

    try {
      final jsonStr = jsonEncode(event.toJson());
      await _eventBox!.put(event.eventId, jsonStr);
    } catch (e) {
      _log('Failed to persist event: $e', isError: true);
    }
  }

  Future<void> _removePersistedEvent(String eventId) async {
    if (_eventBox == null) return;

    try {
      await _eventBox!.delete(eventId);
    } catch (e) {
      _log('Failed to remove persisted event: $e', isError: true);
    }
  }

  Future<void> _loadPersistedEvents() async {
    if (_eventBox == null) return;

    final now = DateTime.now();
    final expiredKeys = <String>[];

    for (final key in _eventBox!.keys) {
      try {
        final jsonStr = _eventBox!.get(key);
        if (jsonStr == null) continue;

        final json = jsonDecode(jsonStr) as Map<String, dynamic>;
        final event = _eventFromJson(json);

        // Check if event is too old
        if (now.difference(event.timestamp) > maxEventAge) {
          expiredKeys.add(key as String);
          continue;
        }

        // Check if already in memory queue
        if (!_memoryQueue.any((e) => e.eventId == event.eventId)) {
          _memoryQueue.add(event);
        }
      } catch (e) {
        _log('Failed to load persisted event: $e', isError: true);
        expiredKeys.add(key as String);
      }
    }

    // Remove expired events
    for (final key in expiredKeys) {
      await _eventBox!.delete(key);
    }

    _log('Loaded ${_memoryQueue.length} events from storage, removed ${expiredKeys.length} expired');
  }

  AnalyticsEvent _eventFromJson(Map<String, dynamic> json) {
    return AnalyticsEvent(
      eventId: json['event_id'] as String,
      eventName: json['event_name'] as String,
      appId: json['app_id'] as String,
      deviceId: json['device_id'] as String,
      userId: json['user_id'] as String?,
      sessionId: json['session_id'] as String?,
      timestamp: DateTime.parse(json['timestamp'] as String),
      attribution: json['attribution'] != null
          ? Attribution.fromJson(json['attribution'] as Map<String, dynamic>)
          : null,
      device: json['device'] != null
          ? _deviceInfoFromJson(json['device'] as Map<String, dynamic>)
          : null,
      properties: json['properties'] as Map<String, dynamic>?,
    );
  }

  DeviceInfo _deviceInfoFromJson(Map<String, dynamic> json) {
    return DeviceInfo(
      os: json['os'] as String?,
      osVersion: json['os_version'] as String?,
      model: json['model'] as String?,
      locale: json['locale'] as String?,
      attStatus: json['att_status'] as String?,
      idfa: json['idfa'] as String?,
    );
  }

  void _startNetworkMonitoring() {
    _connectivitySubscription = Connectivity()
        .onConnectivityChanged
        .listen((List<ConnectivityResult> results) {
      final wasOffline = !_isOnline;
      _isOnline = results.isNotEmpty &&
          !results.contains(ConnectivityResult.none);

      _log('Connectivity changed: $_isOnline');

      // If we just came online, flush events
      if (wasOffline && _isOnline && _memoryQueue.isNotEmpty) {
        _log('Network restored, flushing events');
        flush();
      }
    });

    // Check initial connectivity
    Connectivity().checkConnectivity().then((results) {
      _isOnline = results.isNotEmpty &&
          !results.contains(ConnectivityResult.none);
      _log('Initial connectivity: $_isOnline');
    });
  }

  void _startFlushTimer() {
    _flushTimer?.cancel();
    _flushTimer = Timer.periodic(flushInterval, (_) {
      if (_isOnline && _memoryQueue.isNotEmpty) {
        flush();
      }
    });
  }

  Duration _calculateBackoff(int retryCount) {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 60s)
    final seconds = min(pow(2, retryCount).toInt(), 60);
    return Duration(seconds: seconds);
  }

  void _log(String message, {bool isError = false}) {
    if (_debug || kDebugMode) {
      if (isError) {
        debugPrint('[EodinEventQueue ERROR] $message');
      } else {
        debugPrint('[EodinEventQueue] $message');
      }
    }
  }

  /// Reset for testing
  @visibleForTesting
  Future<void> reset() async {
    _flushTimer?.cancel();
    _connectivitySubscription?.cancel();
    _memoryQueue.clear();
    _isInitialized = false;
    _isFlushing = false;
    _retryCount = 0;

    if (_eventBox != null) {
      await _eventBox!.clear();
      await _eventBox!.close();
      _eventBox = null;
    }
  }
}
