import 'dart:convert';

import 'package:eodin_sdk/analytics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Phase 1.7 — GDPR surface regression guards (open-issues §4.5).
///
/// Flutter already had `setEnabled` / `isEnabled` / `requestDataDeletion`
/// before Phase 1.7 — these tests pin the contract so cross-platform
/// (iOS / Android / Capacitor) implementations remain interchangeable.
void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await EodinAnalytics.reset();
  });

  group('GDPR — setEnabled / isEnabled', () {
    test('isEnabled defaults to true after fresh configure', () async {
      await EodinAnalytics.configure(
        apiEndpoint: 'https://api.eodin.app/api/v1',
        apiKey: 'k',
        appId: 'a',
        offlineMode: false,
      );
      expect(EodinAnalytics.isEnabled, isTrue);
    });

    test('setEnabled(false) flips the flag and persists', () async {
      await EodinAnalytics.configure(
        apiEndpoint: 'https://api.eodin.app/api/v1',
        apiKey: 'k',
        appId: 'a',
        offlineMode: false,
      );
      await EodinAnalytics.setEnabled(false);
      expect(EodinAnalytics.isEnabled, isFalse);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('eodin_enabled'), isFalse);
    });

    test('track() silently drops events when disabled', () async {
      final captured = <String>[];
      final mockClient = MockClient((request) async {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        for (final e in (body['events'] as List<dynamic>)) {
          captured.add((e as Map<String, dynamic>)['event_name'] as String);
        }
        return http.Response('{"success":true}', 200);
      });

      await EodinAnalytics.configure(
        apiEndpoint: 'https://api.eodin.app/api/v1',
        apiKey: 'k',
        appId: 'a',
        offlineMode: false,
        httpClient: mockClient,
      );
      await EodinAnalytics.setEnabled(false);
      await EodinAnalytics.track('app_open');
      await EodinAnalytics.track('subscribe_start');
      expect(captured, isNot(contains('app_open')));
      expect(captured, isNot(contains('subscribe_start')));
    });
  });

  group('GDPR — requestDataDeletion', () {
    test('returns false when SDK not configured', () async {
      final success = await EodinAnalytics.requestDataDeletion();
      expect(success, isFalse);
    });

    test('sends DELETE /events/user-data with X-API-Key + body', () async {
      var capturedBody = <String, dynamic>{};
      var capturedHeaders = <String, String>{};
      var capturedMethod = '';
      var capturedUrl = '';
      final mockClient = MockClient((request) async {
        // Only capture the DELETE — earlier POSTs from configure/identify
        // would otherwise overwrite our capture.
        if (request.method == 'DELETE') {
          capturedMethod = request.method;
          capturedUrl = request.url.toString();
          capturedHeaders = request.headers;
          capturedBody = jsonDecode(request.body) as Map<String, dynamic>;
        }
        return http.Response('{"deleted":true}', 200);
      });

      await EodinAnalytics.configure(
        apiEndpoint: 'https://api.eodin.app/api/v1',
        apiKey: 'k',
        appId: 'a',
        offlineMode: false,
        httpClient: mockClient,
      );
      await EodinAnalytics.identify('user-42');
      final success = await EodinAnalytics.requestDataDeletion();

      expect(success, isTrue);
      expect(capturedMethod, 'DELETE');
      // C1: path is /events/user-data, not /user-data
      expect(capturedUrl, 'https://api.eodin.app/api/v1/events/user-data');
      expect(capturedHeaders['X-API-Key'], 'k');
      expect(capturedHeaders['X-Device-ID'], isNotNull);
      expect(capturedBody['app_id'], 'a');
      expect(capturedBody['user_id'], 'user-42');
      expect(capturedBody['device_id'], isNotNull);
    });

    // C2/H1: post-deletion track() must continue to work
    test('track() works after requestDataDeletion (re-bootstrapped)', () async {
      var trackedAfterDelete = <String>[];
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/events/user-data')) {
          return http.Response('{}', 200);
        }
        if (request.url.path.endsWith('/events/collect')) {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          for (final e in (body['events'] as List<dynamic>)) {
            trackedAfterDelete.add((e as Map<String, dynamic>)['event_name'] as String);
          }
        }
        return http.Response('{"success":true}', 200);
      });

      await EodinAnalytics.configure(
        apiEndpoint: 'https://api.eodin.app/api/v1',
        apiKey: 'k',
        appId: 'a',
        offlineMode: false,
        httpClient: mockClient,
      );
      final beforeId = EodinAnalytics.deviceId;
      await EodinAnalytics.requestDataDeletion();
      final afterId = EodinAnalytics.deviceId;
      expect(afterId, isNotNull);
      expect(afterId, isNot(beforeId)); // fresh identity

      // Subsequent track() should NOT crash on null device_id
      await EodinAnalytics.track('post_deletion_event');
      expect(trackedAfterDelete, contains('post_deletion_event'));
    });

    // HIGH-3: opt-out preserved across deletion
    test('requestDataDeletion preserves disabled opt-out flag', () async {
      final mockClient = MockClient((_) async => http.Response('{}', 200));
      await EodinAnalytics.configure(
        apiEndpoint: 'https://api.eodin.app/api/v1',
        apiKey: 'k',
        appId: 'a',
        offlineMode: false,
        httpClient: mockClient,
      );
      await EodinAnalytics.setEnabled(false);
      await EodinAnalytics.requestDataDeletion();
      expect(EodinAnalytics.isEnabled, isFalse);
    });

    test('clears identity even when network fails (right to erasure local-only)', () async {
      final mockClient = MockClient((_) async {
        throw Exception('network down');
      });

      await EodinAnalytics.configure(
        apiEndpoint: 'https://api.eodin.app/api/v1',
        apiKey: 'k',
        appId: 'a',
        offlineMode: false,
        httpClient: mockClient,
      );
      final beforeDeviceId = EodinAnalytics.deviceId;
      await EodinAnalytics.identify('user-42');
      final success = await EodinAnalytics.requestDataDeletion();
      expect(success, isFalse);
      // userId fully cleared
      expect(EodinAnalytics.userId, isNull);
      // C2/H1: deviceId is re-bootstrapped (fresh identity), NOT null —
      // so subsequent track() does not crash on null device_id.
      expect(EodinAnalytics.deviceId, isNotNull);
      expect(EodinAnalytics.deviceId, isNot(beforeDeviceId));
    });
  });
}
