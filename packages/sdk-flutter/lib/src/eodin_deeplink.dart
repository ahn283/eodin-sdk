import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'exceptions/eodin_exception.dart';
import 'models/deferred_params_result.dart';

/// Eodin Deferred Deep Link SDK
///
/// Use this class to check for deferred deep link parameters after app installation.
///
/// ## Example
///
/// ```dart
/// // Configure in main.dart
/// EodinDeeplink.configure(
///   apiEndpoint: 'https://link.eodin.app/api/v1',
///   service: 'shopping',
/// );
///
/// // Check for deferred params after splash screen
/// try {
///   final params = await EodinDeeplink.checkDeferredParams();
///   if (params.hasParams) {
///     Navigator.pushNamed(context, '/${params.path}');
///   }
/// } on NoParamsFoundException {
///   // Normal - user installed without clicking a link
/// } catch (e) {
///   debugPrint('Error checking deferred params: $e');
/// }
/// ```
class EodinDeeplink {
  static String? _apiEndpoint;
  static String? _service;
  static http.Client? _httpClient;

  static const String _claimedKey = 'eodin_deferred_claimed';

  /// Private constructor to prevent instantiation
  EodinDeeplink._();

  /// Configure the SDK with API endpoint and service ID
  ///
  /// Call this once at app startup, before using [checkDeferredParams].
  ///
  /// [apiEndpoint] - The Eodin API endpoint (e.g., 'https://link.eodin.app/api/v1')
  /// [service] - Your service ID registered in Eodin Admin Dashboard
  /// [httpClient] - Optional HTTP client for testing
  static void configure({
    required String apiEndpoint,
    required String service,
    http.Client? httpClient,
  }) {
    _apiEndpoint = apiEndpoint.endsWith('/')
        ? apiEndpoint.substring(0, apiEndpoint.length - 1)
        : apiEndpoint;
    _service = service;
    _httpClient = httpClient;

    if (kDebugMode) {
      print('[EodinDeeplink] Configured with endpoint: $_apiEndpoint, service: $_service');
    }
  }

  /// Whether the SDK has been configured
  static bool get isReady => _apiEndpoint != null && _service != null;

  /// Check for deferred deep link parameters
  ///
  /// Returns [DeferredParamsResult] if parameters were found and claimed.
  ///
  /// Throws:
  /// - [NotConfiguredException] if SDK is not configured
  /// - [NoParamsFoundException] if no parameters found (normal for organic installs)
  /// - [NetworkException] if a network error occurs
  /// - [ApiException] if the API returns an error
  static Future<DeferredParamsResult> checkDeferredParams() async {
    if (!isReady) {
      throw const NotConfiguredException();
    }

    // Check if already claimed
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_claimedKey) == true) {
      if (kDebugMode) {
        print('[EodinDeeplink] Deferred params already claimed');
      }
      throw const NoParamsFoundException();
    }

    // Generate device fingerprint
    final deviceId = await _generateDeviceId();

    if (kDebugMode) {
      print('[EodinDeeplink] Checking deferred params for device: $deviceId');
    }

    // Call API
    final client = _httpClient ?? http.Client();
    try {
      final uri = Uri.parse('$_apiEndpoint/deferred-params').replace(
        queryParameters: {
          'deviceId': deviceId,
          'service': _service,
        },
      );

      final response = await client.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final data = json['data'] as Map<String, dynamic>?;

        if (data != null) {
          // Mark as claimed
          await prefs.setBool(_claimedKey, true);

          final result = DeferredParamsResult.fromJson(data);

          if (kDebugMode) {
            print('[EodinDeeplink] Found deferred params: $result');
          }

          return result;
        }
      }

      if (response.statusCode == 404) {
        throw const NoParamsFoundException();
      }

      throw ApiException(
        response.statusCode,
        'Failed to fetch deferred params: ${response.body}',
      );
    } on EodinException {
      rethrow;
    } catch (e) {
      throw NetworkException(e);
    } finally {
      if (_httpClient == null) {
        client.close();
      }
    }
  }

  /// Generate a unique device identifier
  static Future<String> _generateDeviceId() async {
    final deviceInfo = DeviceInfoPlugin();
    String rawId;

    if (Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      rawId = iosInfo.identifierForVendor ?? iosInfo.name;
    } else if (Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      rawId = androidInfo.id;
    } else {
      // Fallback for other platforms
      rawId = DateTime.now().millisecondsSinceEpoch.toString();
    }

    // Hash the ID for privacy
    final bytes = utf8.encode('$rawId-$_service');
    final hash = sha256.convert(bytes);

    return hash.toString();
  }

  /// Reset claimed status (for testing purposes)
  @visibleForTesting
  static Future<void> resetClaimedStatus() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_claimedKey);
  }

  /// Reset SDK configuration (for testing purposes)
  @visibleForTesting
  static void reset() {
    _apiEndpoint = null;
    _service = null;
    _httpClient = null;
  }
}
