import 'dart:convert';

import 'package:eodin_deeplink/eodin_deeplink.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    EodinDeeplink.reset();
  });

  group('EodinDeeplink', () {
    test('isReady returns false when not configured', () {
      expect(EodinDeeplink.isReady, isFalse);
    });

    test('isReady returns true after configure', () {
      EodinDeeplink.configure(
        apiEndpoint: 'https://link.eodin.app/api/v1',
        service: 'test-service',
      );

      expect(EodinDeeplink.isReady, isTrue);
    });

    test('configure removes trailing slash from endpoint', () {
      EodinDeeplink.configure(
        apiEndpoint: 'https://link.eodin.app/api/v1/',
        service: 'test-service',
      );

      expect(EodinDeeplink.isReady, isTrue);
    });

    test('checkDeferredParams throws NotConfiguredException when not configured', () async {
      expect(
        () => EodinDeeplink.checkDeferredParams(),
        throwsA(isA<NotConfiguredException>()),
      );
    });

    test('checkDeferredParams returns result on success', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, contains('/deferred-params'));
        expect(request.url.queryParameters['service'], 'test-service');

        return http.Response(
          jsonEncode({
            'success': true,
            'data': {
              'path': 'product/123',
              'resourceId': '123',
              'metadata': {'source': 'test'},
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      EodinDeeplink.configure(
        apiEndpoint: 'https://link.eodin.app/api/v1',
        service: 'test-service',
        httpClient: mockClient,
      );

      final result = await EodinDeeplink.checkDeferredParams();

      expect(result.hasParams, isTrue);
      expect(result.path, 'product/123');
      expect(result.resourceId, '123');
      expect(result.metadata?['source'], 'test');
    });

    test('checkDeferredParams throws NoParamsFoundException on 404', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'success': false, 'error': 'Not found'}),
          404,
          headers: {'content-type': 'application/json'},
        );
      });

      EodinDeeplink.configure(
        apiEndpoint: 'https://link.eodin.app/api/v1',
        service: 'test-service',
        httpClient: mockClient,
      );

      expect(
        () => EodinDeeplink.checkDeferredParams(),
        throwsA(isA<NoParamsFoundException>()),
      );
    });

    test('checkDeferredParams throws ApiException on other errors', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'success': false, 'error': 'Server error'}),
          500,
          headers: {'content-type': 'application/json'},
        );
      });

      EodinDeeplink.configure(
        apiEndpoint: 'https://link.eodin.app/api/v1',
        service: 'test-service',
        httpClient: mockClient,
      );

      expect(
        () => EodinDeeplink.checkDeferredParams(),
        throwsA(isA<ApiException>()),
      );
    });

    test('checkDeferredParams throws NoParamsFoundException if already claimed', () async {
      SharedPreferences.setMockInitialValues({'eodin_deferred_claimed': true});

      final mockClient = MockClient((request) async {
        fail('Should not make API call if already claimed');
        return http.Response('', 500);
      });

      EodinDeeplink.configure(
        apiEndpoint: 'https://link.eodin.app/api/v1',
        service: 'test-service',
        httpClient: mockClient,
      );

      expect(
        () => EodinDeeplink.checkDeferredParams(),
        throwsA(isA<NoParamsFoundException>()),
      );
    });
  });

  group('DeferredParamsResult', () {
    test('hasParams returns true when path is set', () {
      const result = DeferredParamsResult(path: 'test/path');
      expect(result.hasParams, isTrue);
    });

    test('hasParams returns true when resourceId is set', () {
      const result = DeferredParamsResult(resourceId: '123');
      expect(result.hasParams, isTrue);
    });

    test('hasParams returns false when empty', () {
      const result = DeferredParamsResult();
      expect(result.hasParams, isFalse);
    });

    test('fromJson creates correct instance', () {
      final json = {
        'path': 'product/456',
        'resourceId': '456',
        'metadata': {'key': 'value'},
      };

      final result = DeferredParamsResult.fromJson(json);

      expect(result.path, 'product/456');
      expect(result.resourceId, '456');
      expect(result.metadata?['key'], 'value');
    });

    test('toJson returns correct map', () {
      const result = DeferredParamsResult(
        path: 'category/789',
        resourceId: '789',
        metadata: {'test': true},
      );

      final json = result.toJson();

      expect(json['path'], 'category/789');
      expect(json['resourceId'], '789');
      expect(json['metadata'], {'test': true});
    });
  });

  group('EodinException', () {
    test('NotConfiguredException has correct message', () {
      const exception = NotConfiguredException();
      expect(exception.message, contains('not configured'));
    });

    test('NoParamsFoundException has correct message', () {
      const exception = NoParamsFoundException();
      expect(exception.message, contains('No deferred parameters'));
    });

    test('NetworkException includes underlying error', () {
      const exception = NetworkException('connection failed');
      expect(exception.toString(), contains('connection failed'));
    });

    test('ApiException includes status code', () {
      const exception = ApiException(500, 'Server error');
      expect(exception.toString(), contains('500'));
      expect(exception.toString(), contains('Server error'));
    });
  });
}
