# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /sdk/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.kts.

# Keep SDK public API
-keep class app.eodin.deeplink.EodinDeeplink { *; }
-keep class app.eodin.deeplink.DeferredParamsResult { *; }
-keep class app.eodin.deeplink.EodinException { *; }
-keep class app.eodin.deeplink.EodinException$* { *; }

# Keep BuildConfig
-keep class app.eodin.deeplink.BuildConfig { *; }
