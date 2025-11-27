# Consumer ProGuard rules for apps using Eodin Deeplink SDK

# Keep SDK public API
-keep class app.eodin.deeplink.EodinDeeplink { *; }
-keep class app.eodin.deeplink.DeferredParamsResult { *; }
-keep class app.eodin.deeplink.EodinException { *; }
-keep class app.eodin.deeplink.EodinException$* { *; }
