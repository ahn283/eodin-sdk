/// Eodin Deferred Deep Link SDK for Flutter
///
/// Enable deferred deep linking to direct users to specific content
/// after app installation.
///
/// ## Usage
///
/// ```dart
/// import 'package:eodin_deeplink/eodin_deeplink.dart';
///
/// void main() async {
///   WidgetsFlutterBinding.ensureInitialized();
///
///   // Configure SDK
///   EodinDeeplink.configure(
///     apiEndpoint: 'https://link.eodin.app/api/v1',
///     service: 'your-service-id',
///   );
///
///   runApp(MyApp());
/// }
/// ```
///
/// For full SDK functionality including Analytics, use:
/// ```dart
/// import 'package:eodin_deeplink/eodin_sdk.dart';
/// ```
library eodin_deeplink;

export 'src/eodin_deeplink.dart';
export 'src/models/deferred_params_result.dart';
export 'src/exceptions/eodin_exception.dart';

// Also export analytics for convenience
export 'src/analytics/eodin_analytics.dart';
export 'src/models/event.dart';
