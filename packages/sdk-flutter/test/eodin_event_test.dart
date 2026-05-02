import 'dart:convert';

import 'package:eodin_sdk/analytics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('EodinEvent', () {
    test('eventName is snake_case wire format', () {
      expect(EodinEvent.appOpen.eventName, 'app_open');
      expect(EodinEvent.subscribeStart.eventName, 'subscribe_start');
      expect(EodinEvent.accountDelete.eventName, 'account_delete');
      expect(EodinEvent.adRewardedView.eventName, 'ad_rewarded_view');
      expect(EodinEvent.adInterstitialView.eventName, 'ad_interstitial_view');
      expect(EodinEvent.dailyLimitReached.eventName, 'daily_limit_reached');
      expect(EodinEvent.dailyLimitUpgradeTap.eventName, 'daily_limit_upgrade_tap');
      expect(EodinEvent.passPurchase.eventName, 'pass_purchase');
    });

    test('all enum values use snake_case (regex)', () {
      final snakeCase = RegExp(r'^[a-z][a-z0-9]*(_[a-z0-9]+)*$');
      for (final e in EodinEvent.values) {
        expect(
          snakeCase.hasMatch(e.eventName),
          isTrue,
          reason: '${e.name} -> "${e.eventName}" is not snake_case',
        );
        expect(
          e.eventName.length <= 40,
          isTrue,
          reason: '${e.name} -> "${e.eventName}" exceeds 40 chars',
        );
      }
    });

    test('all enum values are unique', () {
      final names = EodinEvent.values.map((e) => e.eventName).toList();
      expect(names.toSet().length, names.length, reason: 'duplicate eventName');
    });

    test('does not contain forbidden v1 names', () {
      // Phase 0.4 audit: these v1 names violate naming rules.
      // EodinEvent enum should NOT include them; v2 migration replaces.
      const forbidden = {
        'subscription_purchase_completed',
        'subscription_trial_started',
        'subscription_restored',
        'paywall_dismissed',
        'ad_clicked',
        'ad_failed',
        'rewarded_ad_attempt',
        'rewarded_ad_complete',
        'interstitial_ad_shown',
        'native_ad_shown',
        'login',
        'auth_logout',
        'auth_account_deleted',
        'onboarding_skipped',
      };
      final used = EodinEvent.values.map((e) => e.eventName).toSet();
      expect(used.intersection(forbidden), isEmpty);
    });
  });

  // M4 guard: ensures `trackEvent(EodinEvent.X)` flows the snake_case
  // wire-format (not Dart's builtin `name` getter, which returns PascalCase
  // like "appOpen") through to the network layer.
  group('EodinAnalytics.trackEvent wire-format integration', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await EodinAnalytics.reset();
    });

    test('forwards EodinEvent.appOpen as wire-format "app_open"', () async {
      final captured = <String>[];
      final mockClient = MockClient((request) async {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final events = body['events'] as List<dynamic>;
        for (final e in events) {
          captured.add((e as Map<String, dynamic>)['event_name'] as String);
        }
        return http.Response('{"success":true}', 200);
      });

      await EodinAnalytics.configure(
        apiEndpoint: 'https://api.eodin.app/api/v1',
        apiKey: 'test-key',
        appId: 'test-app',
        offlineMode: false, // direct send so we observe the HTTP body
        httpClient: mockClient,
      );

      await EodinAnalytics.trackEvent(EodinEvent.appOpen);
      await EodinAnalytics.trackEvent(
        EodinEvent.subscribeStart,
        properties: {'plan': 'monthly', 'price': 9900, 'currency': 'KRW'},
      );

      expect(captured, contains('app_open'));
      expect(captured, contains('subscribe_start'));
      // Critical: enum's builtin `name` getter would have returned PascalCase
      // 'appOpen' / 'subscribeStart' — must NOT appear in wire format.
      expect(captured, isNot(contains('appOpen')));
      expect(captured, isNot(contains('subscribeStart')));
    });
  });
}
