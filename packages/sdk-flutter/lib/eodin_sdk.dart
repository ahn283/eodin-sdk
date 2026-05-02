/// Eodin SDK for Flutter (full bundle)
///
/// Complete SDK for Eodin services including:
/// - Analytics Event Tracking
/// - Deferred Deep Linking
///
/// ## Quick Start
///
/// ```dart
/// import 'package:eodin_sdk/eodin_sdk.dart';
///
/// void main() async {
///   WidgetsFlutterBinding.ensureInitialized();
///
///   // Configure Analytics
///   await EodinAnalytics.configure(
///     apiEndpoint: 'https://api.eodin.app/api/v1',
///     apiKey: 'your-api-key',
///     appId: 'your-app-id',
///   );
///
///   // Configure Deep Link
///   EodinDeeplink.configure(
///     apiEndpoint: 'https://api.eodin.app/api/v1',
///     service: 'your-service-id',
///   );
///
///   runApp(MyApp());
/// }
/// ```
///
/// ## Module-only imports (tree-shaking friendly)
///
/// ```dart
/// import 'package:eodin_sdk/analytics.dart';   // Analytics only
/// import 'package:eodin_sdk/deeplink.dart';    // Deeplink only
/// ```
///
/// ## Analytics
///
/// ```dart
/// EodinAnalytics.track('app_open');
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
///   // Normal — user installed without clicking a link
/// }
/// ```
library eodin_sdk;

// Deep linking exports
export 'src/eodin_deeplink.dart';
export 'src/models/deferred_params_result.dart';
export 'src/exceptions/eodin_exception.dart';

// Analytics exports
export 'src/analytics/eodin_analytics.dart';
export 'src/analytics/eodin_event.dart';
export 'src/models/event.dart';
