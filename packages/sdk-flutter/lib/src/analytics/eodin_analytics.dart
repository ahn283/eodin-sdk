import 'dart:convert';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../models/event.dart';

/// Eodin Analytics SDK for Flutter
///
/// Use this class to track analytics events and send them to the Eodin backend.
///
/// ## Example
///
/// ```dart
/// // Configure SDK
/// EodinAnalytics.configure(
///   apiEndpoint: 'https://link.eodin.app/api/v1',
///   apiKey: 'your-api-key',
///   appId: 'fridgify',
/// );
///
/// // Track events
/// EodinAnalytics.track('app_open');
/// EodinAnalytics.track('button_clicked', properties: {'button': 'subscribe'});
///
/// // Identify user
/// EodinAnalytics.identify('user-123');
/// ```
class EodinAnalytics {
  /// Private constructor to prevent instantiation
  EodinAnalytics._();

  static String? _apiEndpoint;
  static String? _apiKey;
  static String? _appId;
  static String? _deviceId;
  static String? _userId;
  static String? _sessionId;
  static Attribution? _attribution;
  static DeviceInfo? _deviceInfo;
  static bool _debug = false;
  static http.Client? _httpClient;

  // Event queue for batching
  static final List<AnalyticsEvent> _eventQueue = [];
  static const int _maxBatchSize = 20;
  static const Duration _flushInterval = Duration(seconds: 30);
  static DateTime? _lastFlushTime;

  // Storage keys
  static const String _deviceIdKey = 'eodin_device_id';
  static const String _userIdKey = 'eodin_user_id';
  static const String _attributionKey = 'eodin_attribution';
  static const String _sessionIdKey = 'eodin_session_id';
  static const String _sessionStartKey = 'eodin_session_start';

  /// Configure the Analytics SDK
  ///
  /// Call this once at app startup.
  ///
  /// [apiEndpoint] - The Eodin API endpoint (e.g., 'https://link.eodin.app/api/v1')
  /// [apiKey] - Your API key for the service
  /// [appId] - Your app ID (e.g., 'fridgify', 'arden')
  /// [debug] - Enable debug logging
  /// [httpClient] - Optional HTTP client for testing
  static Future<void> configure({
    required String apiEndpoint,
    required String apiKey,
    required String appId,
    bool debug = false,
    http.Client? httpClient,
  }) async {
    _apiEndpoint = apiEndpoint.endsWith('/')
        ? apiEndpoint.substring(0, apiEndpoint.length - 1)
        : apiEndpoint;
    _apiKey = apiKey;
    _appId = appId;
    _debug = debug;
    _httpClient = httpClient;

    // Initialize device ID
    await _initDeviceId();

    // Load stored user ID
    await _loadUserId();

    // Load stored attribution
    await _loadAttribution();

    // Initialize session
    await _initSession();

    // Get device info
    await _initDeviceInfo();

    _log('Configured with endpoint: $_apiEndpoint, appId: $_appId');
  }

  /// Whether the SDK has been configured
  static bool get isConfigured =>
      _apiEndpoint != null && _apiKey != null && _appId != null;

  /// Current device ID
  static String? get deviceId => _deviceId;

  /// Current user ID
  static String? get userId => _userId;

  /// Current session ID
  static String? get sessionId => _sessionId;

  /// Current attribution
  static Attribution? get attribution => _attribution;

  /// Track an analytics event
  ///
  /// [eventName] - The name of the event (e.g., 'app_open', 'subscribe_start')
  /// [properties] - Optional custom properties for the event
  static Future<void> track(
    String eventName, {
    Map<String, dynamic>? properties,
  }) async {
    if (!isConfigured) {
      _log('SDK not configured. Call configure() first.', isError: true);
      return;
    }

    final event = AnalyticsEvent(
      eventName: eventName,
      appId: _appId!,
      deviceId: _deviceId!,
      userId: _userId,
      sessionId: _sessionId,
      attribution: _attribution,
      device: _deviceInfo,
      properties: properties,
    );

    _eventQueue.add(event);
    _log('Queued event: $eventName (queue size: ${_eventQueue.length})');

    // Check if we should flush
    if (_shouldFlush()) {
      await flush();
    }
  }

  /// Identify a user
  ///
  /// [userId] - The unique user identifier
  static Future<void> identify(String userId) async {
    _userId = userId;

    // Persist user ID
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userIdKey, userId);

    _log('Identified user: $userId');
  }

  /// Clear user identification
  static Future<void> clearIdentity() async {
    _userId = null;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userIdKey);

    _log('Cleared user identity');
  }

  /// Set attribution data
  ///
  /// This is typically called automatically when deferred params are retrieved.
  static Future<void> setAttribution(Attribution attribution) async {
    _attribution = attribution;

    // Persist attribution
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_attributionKey, jsonEncode(attribution.toJson()));

    _log('Set attribution: $attribution');
  }

  /// Flush pending events to the server
  static Future<void> flush() async {
    if (_eventQueue.isEmpty) {
      _log('No events to flush');
      return;
    }

    if (!isConfigured) {
      _log('SDK not configured. Cannot flush.', isError: true);
      return;
    }

    // Take up to _maxBatchSize events
    final eventsToSend = _eventQueue.take(_maxBatchSize).toList();
    _eventQueue.removeRange(0, eventsToSend.length);

    _log('Flushing ${eventsToSend.length} events');

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
          'events': eventsToSend.map((e) => e.toJson()).toList(),
        }),
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body);
        _log('Flush successful: received=${json['received']}, duplicates=${json['duplicates']}');
      } else {
        _log('Flush failed: ${response.statusCode} - ${response.body}', isError: true);
        // Re-queue failed events
        _eventQueue.insertAll(0, eventsToSend);
      }
    } catch (e) {
      _log('Flush error: $e', isError: true);
      // Re-queue failed events
      _eventQueue.insertAll(0, eventsToSend);
    } finally {
      if (_httpClient == null) {
        client.close();
      }
      _lastFlushTime = DateTime.now();
    }
  }

  /// Start a new session
  static Future<void> startSession() async {
    _sessionId = const Uuid().v4();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_sessionIdKey, _sessionId!);
    await prefs.setInt(_sessionStartKey, DateTime.now().millisecondsSinceEpoch);

    _log('Started new session: $_sessionId');

    // Track session_start event
    await track('session_start');
  }

  /// End the current session
  static Future<void> endSession() async {
    if (_sessionId != null) {
      await track('session_end');
      _log('Ended session: $_sessionId');
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionIdKey);
    await prefs.remove(_sessionStartKey);

    _sessionId = null;
  }

  // Private methods

  static bool _shouldFlush() {
    // Flush if queue is full
    if (_eventQueue.length >= _maxBatchSize) {
      return true;
    }

    // Flush if enough time has passed
    if (_lastFlushTime != null) {
      final elapsed = DateTime.now().difference(_lastFlushTime!);
      if (elapsed >= _flushInterval && _eventQueue.isNotEmpty) {
        return true;
      }
    }

    return false;
  }

  static Future<void> _initDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    _deviceId = prefs.getString(_deviceIdKey);

    if (_deviceId == null) {
      // Generate new device ID
      _deviceId = await _generateDeviceId();
      await prefs.setString(_deviceIdKey, _deviceId!);
    }

    _log('Device ID: $_deviceId');
  }

  static Future<String> _generateDeviceId() async {
    // Use UUID for device ID generation
    return const Uuid().v4();
  }

  static Future<void> _loadUserId() async {
    final prefs = await SharedPreferences.getInstance();
    _userId = prefs.getString(_userIdKey);

    if (_userId != null) {
      _log('Loaded user ID: $_userId');
    }
  }

  static Future<void> _loadAttribution() async {
    final prefs = await SharedPreferences.getInstance();
    final attributionJson = prefs.getString(_attributionKey);

    if (attributionJson != null) {
      try {
        final json = jsonDecode(attributionJson) as Map<String, dynamic>;
        _attribution = Attribution.fromJson(json);
        _log('Loaded attribution: $_attribution');
      } catch (e) {
        _log('Failed to load attribution: $e', isError: true);
      }
    }
  }

  static Future<void> _initSession() async {
    final prefs = await SharedPreferences.getInstance();
    final storedSessionId = prefs.getString(_sessionIdKey);
    final sessionStart = prefs.getInt(_sessionStartKey);

    // Check if session is still valid (30 minutes)
    if (storedSessionId != null && sessionStart != null) {
      final elapsed = DateTime.now().millisecondsSinceEpoch - sessionStart;
      if (elapsed < 30 * 60 * 1000) {
        _sessionId = storedSessionId;
        _log('Resumed session: $_sessionId');
        return;
      }
    }

    // Start new session
    await startSession();
  }

  static Future<void> _initDeviceInfo() async {
    try {
      final deviceInfoPlugin = DeviceInfoPlugin();

      if (Platform.isIOS) {
        final iosInfo = await deviceInfoPlugin.iosInfo;
        _deviceInfo = DeviceInfo(
          os: 'ios',
          osVersion: iosInfo.systemVersion,
          model: iosInfo.model,
          locale: Platform.localeName,
        );
      } else if (Platform.isAndroid) {
        final androidInfo = await deviceInfoPlugin.androidInfo;
        _deviceInfo = DeviceInfo(
          os: 'android',
          osVersion: androidInfo.version.release,
          model: androidInfo.model,
          locale: Platform.localeName,
        );
      }

      _log('Device info: $_deviceInfo');
    } catch (e) {
      _log('Failed to get device info: $e', isError: true);
    }
  }

  static void _log(String message, {bool isError = false}) {
    if (_debug || kDebugMode) {
      if (isError) {
        debugPrint('[EodinAnalytics ERROR] $message');
      } else {
        debugPrint('[EodinAnalytics] $message');
      }
    }
  }

  /// Reset SDK state (for testing purposes)
  @visibleForTesting
  static Future<void> reset() async {
    _apiEndpoint = null;
    _apiKey = null;
    _appId = null;
    _deviceId = null;
    _userId = null;
    _sessionId = null;
    _attribution = null;
    _deviceInfo = null;
    _httpClient = null;
    _eventQueue.clear();
    _lastFlushTime = null;
  }
}
