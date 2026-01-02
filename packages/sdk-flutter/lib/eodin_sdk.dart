/// Eodin SDK for Flutter
///
/// Complete SDK for Eodin services including:
/// - Deferred Deep Linking
/// - Analytics Event Tracking
///
/// ## Quick Start
///
/// ```dart
/// import 'package:eodin_deeplink/eodin_sdk.dart';
///
/// void main() async {
///   WidgetsFlutterBinding.ensureInitialized();
///
///   // Configure Analytics
///   await EodinAnalytics.configure(
///     apiEndpoint: 'https://link.eodin.app/api/v1',
///     apiKey: 'your-api-key',
///     appId: 'your-app-id',
///   );
///
///   // Configure Deep Link
///   EodinDeeplink.configure(
///     apiEndpoint: 'https://link.eodin.app/api/v1',
///     service: 'your-service-id',
///   );
///
///   runApp(MyApp());
/// }
/// ```
///
/// ## Analytics
///
/// ```dart
/// // Track events
/// EodinAnalytics.track('app_open');
/// EodinAnalytics.track('button_clicked', properties: {'button': 'subscribe'});
///
/// // Identify user
/// EodinAnalytics.identify('user-123');
/// ```
///
/// ## Deferred Deep Links
///
/// ```dart
/// try {
///   final params = await EodinDeeplink.checkDeferredParams();
///   if (params.hasParams) {
///     Navigator.pushNamed(context, '/${params.path}');
///   }
/// } on NoParamsFoundException {
///   // Normal - user installed without clicking a link
/// }
/// ```
library eodin_sdk;

// Deep linking exports
export 'src/eodin_deeplink.dart';
export 'src/models/deferred_params_result.dart';
export 'src/exceptions/eodin_exception.dart';

// Analytics exports
export 'src/analytics/eodin_analytics.dart';
export 'src/models/event.dart';
