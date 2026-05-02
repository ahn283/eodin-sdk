# EodinDeeplink Android SDK

Kotlin SDK for integrating Eodin deferred deep links into Android applications.

## Requirements

- Android API 21+ (Android 5.0 Lollipop)
- Kotlin 1.8+
- Android Gradle Plugin 8.0+

## Installation

### Gradle (Kotlin DSL)

Add to your app's `build.gradle.kts`:

```kotlin
dependencies {
    implementation("app.eodin:deeplink-sdk:1.0.0")
}
```

### Gradle (Groovy)

Add to your app's `build.gradle`:

```groovy
dependencies {
    implementation 'app.eodin:deeplink-sdk:1.0.0'
}
```

## Quick Start

### 1. Configure the SDK

Configure the SDK as early as possible, typically in your `Application` class:

```kotlin
import app.eodin.deeplink.EodinDeeplink

class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        EodinDeeplink.configure(
            context = this,
            apiEndpoint = "https://api.eodin.app/api/v1",
            service = "your-service-id"  // e.g., "shopping", "food", "video"
        )
    }
}
```

### 2. Check for Deferred Parameters

Check for deferred deep link parameters when appropriate (e.g., after onboarding):

```kotlin
// Callback-based
EodinDeeplink.checkDeferredParams { result ->
    result.onSuccess { params ->
        if (params.hasParams) {
            params.path?.let { path ->
                // Navigate to the deep link destination
                navigateToDeeplink(path)
            }
        }
    }.onFailure { error ->
        when (error) {
            is EodinException.NoParamsFound -> {
                // Normal case - user installed without clicking a link
            }
            else -> {
                Log.e("Deeplink", "Error: ${error.message}")
            }
        }
    }
}

// Coroutines (suspend function)
lifecycleScope.launch {
    try {
        val params = EodinDeeplink.checkDeferredParamsAsync()
        params.path?.let { navigateToDeeplink(it) }
    } catch (e: EodinException.NoParamsFound) {
        // Normal - no deferred link
    } catch (e: EodinException) {
        Log.e("Deeplink", "Error: ${e.message}")
    }
}
```

## API Reference

### Configuration

```kotlin
/**
 * Configure the SDK
 * @param context Application context
 * @param apiEndpoint Base URL of Eodin API
 * @param service Your service identifier registered with Eodin
 */
fun configure(context: Context, apiEndpoint: String, service: String)

/**
 * Check if SDK is configured and ready
 */
val isReady: Boolean
```

### Deferred Parameters

```kotlin
/**
 * Check for deferred deep link parameters (callback-based)
 * @param callback Callback with Result<DeferredParamsResult>
 */
fun checkDeferredParams(callback: (Result<DeferredParamsResult>) -> Unit)

/**
 * Check for deferred deep link parameters (coroutines)
 * @return DeferredParamsResult if found
 * @throws EodinException on error
 */
suspend fun checkDeferredParamsAsync(): DeferredParamsResult
```

### Data Types

```kotlin
data class DeferredParamsResult(
    /** Deep link path (e.g., "product/12345") */
    val path: String?,

    /** Resource ID from original link */
    val resourceId: String?,

    /** Additional metadata */
    val metadata: Map<String, Any>?
) {
    /** Whether parameters were found */
    val hasParams: Boolean
}

sealed class EodinException(message: String) : Exception(message) {
    class NotConfigured : EodinException(...)           // SDK not configured
    class NetworkError(cause: Throwable) : ...         // Network request failed
    class InvalidResponse : EodinException(...)        // Invalid server response
    class NoParamsFound : EodinException(...)          // No deferred params found
    class ServerError(code: Int, message: String?) : ... // Server returned error
}
```

## How It Works

1. User clicks an Eodin deep link (`link.eodin.app/your-service/resource-id`)
2. Web service detects app is not installed
3. Server generates device fingerprint and stores deferred parameters
4. User is redirected to Play Store
5. After installation, SDK calls API with matching fingerprint
6. Server returns stored parameters, SDK triggers navigation

### Device Fingerprinting

The SDK uses Android ID combined with device characteristics to generate a consistent fingerprint. This fingerprint:
- Does NOT require special permissions (uses INTERNET only)
- Is NOT advertising ID (GAID)
- Is consistent within your app
- Expires on server after 24 hours for privacy

## Permissions

The SDK only requires the INTERNET permission, which is automatically merged from the library manifest:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## ProGuard

ProGuard rules are automatically included via `consumer-rules.pro`. No additional configuration needed.

## Best Practices

1. **Call early but not too early**: Check deferred params after splash screen or onboarding
2. **Handle no params gracefully**: Most installs won't have deferred params
3. **Use coroutines**: The suspend function version integrates better with modern Android
4. **Navigate appropriately**: Use your app's navigation component to handle the path
5. **Test thoroughly**: Use the Eodin admin dashboard to verify integration

## Example Integration

```kotlin
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        checkDeferredDeeplink()
    }

    private fun checkDeferredDeeplink() {
        if (!EodinDeeplink.isReady) return

        lifecycleScope.launch {
            try {
                val params = EodinDeeplink.checkDeferredParamsAsync()
                params.path?.let { handleDeeplink(it) }
            } catch (e: EodinException.NoParamsFound) {
                // Expected for organic installs
            } catch (e: EodinException) {
                Log.w(TAG, "Deferred link error: ${e.message}")
            }
        }
    }

    private fun handleDeeplink(path: String) {
        // Parse path and navigate
        // e.g., "product/12345" → show product detail
        val segments = path.split("/")
        if (segments.size >= 2) {
            when (segments[0]) {
                "product" -> navigateToProduct(segments[1])
                "category" -> navigateToCategory(segments[1])
            }
        }
    }

    private fun navigateToProduct(id: String) {
        // Navigate to product detail screen
        val intent = Intent(this, ProductDetailActivity::class.java)
        intent.putExtra("product_id", id)
        startActivity(intent)
    }

    companion object {
        private const val TAG = "MainActivity"
    }
}
```

## Java Interoperability

The SDK is fully compatible with Java:

```java
// Configure
EodinDeeplink.configure(context, "https://api.eodin.app/api/v1", "shopping");

// Check params
EodinDeeplink.checkDeferredParams(result -> {
    if (result.isSuccess()) {
        DeferredParamsResult params = result.getOrNull();
        if (params != null && params.getHasParams()) {
            String path = params.getPath();
            // Navigate
        }
    }
    return Unit.INSTANCE;
});
```

## License

MIT License
