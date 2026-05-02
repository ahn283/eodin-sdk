/// **DEPRECATED v1 entry** — use `import 'package:eodin_sdk/eodin_sdk.dart'`
/// (full bundle) or `import 'package:eodin_sdk/deeplink.dart'` (deeplink only).
///
/// This entry is kept as a compatibility shim for the rename
/// `eodin_deeplink` → `eodin_sdk` (v2.0.0). It will be removed in v3.0.
///
/// Migration:
/// ```dart
/// // v1
/// import 'package:eodin_deeplink/eodin_deeplink.dart';
/// // v2 (recommended)
/// import 'package:eodin_sdk/eodin_sdk.dart';
/// // or module-only
/// import 'package:eodin_sdk/deeplink.dart';
/// import 'package:eodin_sdk/analytics.dart';
/// ```
@Deprecated('Use package:eodin_sdk/eodin_sdk.dart (full bundle), '
    'package:eodin_sdk/deeplink.dart (deeplink-only), or '
    'package:eodin_sdk/analytics.dart (analytics-only). '
    'This entry will be removed in v3.0.')
library eodin_deeplink;

export 'src/eodin_deeplink.dart';
export 'src/models/deferred_params_result.dart';
export 'src/exceptions/eodin_exception.dart';

// Also export analytics for convenience (v1 compatibility)
export 'src/analytics/eodin_analytics.dart';
export 'src/models/event.dart';
