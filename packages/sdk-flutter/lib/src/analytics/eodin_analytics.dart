import 'dart:convert';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../models/event.dart';
import 'event_queue.dart';

/// Eodin Analytics SDK for Flutter
///
/// Use this class to track analytics events and send them to the Eodin backend.
///
/// ## Example
///
/// ```dart
/// // Configure SDK
/// EodinAnalytics.configure(
///   apiEndpoint: 'https://api.eodin.app/api/v1',
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
  static bool _offlineMode = true; // Enable offline support by default
  static bool _isEnabled = true; // GDPR compliance flag

  // Storage keys
  static const String _deviceIdKey = 'eodin_device_id';
  static const String _userIdKey = 'eodin_user_id';
  static const String _attributionKey = 'eodin_attribution';
  static const String _sessionIdKey = 'eodin_session_id';
  static const String _sessionStartKey = 'eodin_session_start';
  static const String _enabledKey = 'eodin_enabled';

  /// Configure the Analytics SDK
  ///
  /// Call this once at app startup.
  ///
  /// [apiEndpoint] - The Eodin API endpoint (e.g., 'https://api.eodin.app/api/v1')
  /// [apiKey] - Your API key for the service
  /// [appId] - Your app ID (e.g., 'fridgify', 'arden')
  /// [debug] - Enable debug logging
  /// [offlineMode] - Enable offline event storage (default: true)
  /// [httpClient] - Optional HTTP client for testing
  static Future<void> configure({
    required String apiEndpoint,
    required String apiKey,
    required String appId,
    bool debug = false,
    bool offlineMode = true,
    http.Client? httpClient,
  }) async {
    _apiEndpoint = apiEndpoint.endsWith('/')
        ? apiEndpoint.substring(0, apiEndpoint.length - 1)
        : apiEndpoint;
    _apiKey = apiKey;
    _appId = appId;
    _debug = debug;
    _offlineMode = offlineMode;
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

    // Load GDPR enabled state
    await _loadEnabledState();

    // Initialize EventQueue for offline support
    if (_offlineMode) {
      await EventQueue.instance.initialize(
        apiEndpoint: _apiEndpoint!,
        apiKey: _apiKey!,
        debug: _debug,
        httpClient: _httpClient,
      );
    }

    _log('Configured with endpoint: $_apiEndpoint, appId: $_appId, offlineMode: $_offlineMode');
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

    // GDPR compliance check
    if (!_isEnabled) {
      _log('Tracking disabled by user (GDPR). Skipping event: $eventName');
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

    // Use EventQueue for offline support
    if (_offlineMode) {
      await EventQueue.instance.enqueue(event);
      _log('Enqueued event: $eventName (offline mode)');
    } else {
      // Legacy direct send mode
      await _sendEventDirect(event);
    }
  }

  /// Send event directly without queue (legacy mode)
  static Future<void> _sendEventDirect(AnalyticsEvent event) async {
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
          'events': [event.toJson()],
        }),
      );

      if (response.statusCode == 200) {
        _log('Event sent: ${event.eventName}');
      } else {
        _log('Event send failed: ${response.statusCode}', isError: true);
      }
    } catch (e) {
      _log('Event send error: $e', isError: true);
    } finally {
      if (_httpClient == null) {
        client.close();
      }
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
    if (!isConfigured) {
      _log('SDK not configured. Cannot flush.', isError: true);
      return;
    }

    if (_offlineMode) {
      await EventQueue.instance.flush();
    }
  }

  /// Whether currently online (only available in offline mode)
  static bool get isOnline => _offlineMode ? EventQueue.instance.isOnline : true;

  /// Current queue size (only available in offline mode)
  static int get queueSize => _offlineMode ? EventQueue.instance.queueSize : 0;

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

  // ATT & GDPR Methods

  /// Set iOS App Tracking Transparency (ATT) status
  ///
  /// Call this after requesting ATT permission on iOS.
  /// This updates the device info with ATT status and IDFA (if authorized).
  ///
  /// [attStatus] - ATT status ('authorized', 'denied', 'not_determined', 'restricted')
  /// [idfa] - IDFA string (only when authorized)
  static Future<void> setDeviceATT({
    required String attStatus,
    String? idfa,
  }) async {
    if (_deviceInfo == null) {
      _log('Device info not initialized. Call configure() first.', isError: true);
      return;
    }

    _deviceInfo = DeviceInfo(
      os: _deviceInfo!.os,
      osVersion: _deviceInfo!.osVersion,
      model: _deviceInfo!.model,
      locale: _deviceInfo!.locale,
      attStatus: attStatus,
      idfa: idfa,
    );

    _log('Updated device ATT: status=$attStatus, hasIDFA=${idfa != null}');
  }

  /// Whether analytics tracking is enabled
  static bool get isEnabled => _isEnabled;

  /// Enable or disable analytics tracking (GDPR compliance)
  ///
  /// When disabled:
  /// - No events will be tracked
  /// - No data will be sent to the server
  static Future<void> setEnabled(bool enabled) async {
    _isEnabled = enabled;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, enabled);

    _log('Analytics ${enabled ? 'enabled' : 'disabled'}');
  }

  /// Request deletion of all user data (GDPR right to erasure)
  ///
  /// Returns true if the deletion request was successful.
  static Future<bool> requestDataDeletion() async {
    if (!isConfigured) {
      _log('SDK not configured. Cannot request data deletion.', isError: true);
      return false;
    }

    final client = _httpClient ?? http.Client();
    bool success = false;

    try {
      final response = await client.delete(
        Uri.parse('$_apiEndpoint/user-data'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-Key': _apiKey!,
          'X-Device-ID': _deviceId!,
        },
        body: jsonEncode({
          'device_id': _deviceId,
          'user_id': _userId,
          'app_id': _appId,
        }),
      );

      success = response.statusCode == 200 || response.statusCode == 202;
      _log('Data deletion request: ${success ? 'successful' : 'failed (${response.statusCode})'}');
    } catch (e) {
      _log('Data deletion request error: $e', isError: true);
    } finally {
      if (_httpClient == null) {
        client.close();
      }
    }

    // Clear local data regardless of server response
    await _clearLocalData();
    return success;
  }

  // Private methods

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

  static Future<void> _loadEnabledState() async {
    final prefs = await SharedPreferences.getInstance();
    _isEnabled = prefs.getBool(_enabledKey) ?? true;
    _log('Loaded enabled state: $_isEnabled');
  }

  static Future<void> _clearLocalData() async {
    final prefs = await SharedPreferences.getInstance();

    // Clear all SDK-related data
    await prefs.remove(_deviceIdKey);
    await prefs.remove(_userIdKey);
    await prefs.remove(_attributionKey);
    await prefs.remove(_sessionIdKey);
    await prefs.remove(_sessionStartKey);
    await prefs.remove(_enabledKey);

    // Clear EventQueue data
    if (_offlineMode) {
      await EventQueue.instance.reset();
    }

    // Reset in-memory state
    _deviceId = null;
    _userId = null;
    _attribution = null;
    _sessionId = null;
    _isEnabled = true;

    _log('Cleared all local data');
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
    _offlineMode = true;
    _isEnabled = true;

    // Reset EventQueue
    await EventQueue.instance.reset();
  }
}
