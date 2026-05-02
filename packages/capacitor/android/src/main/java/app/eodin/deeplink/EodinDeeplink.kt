package app.eodin.deeplink

import android.content.Context
import app.eodin.analytics.EodinAnalytics
import app.eodin.analytics.models.Attribution
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import org.json.JSONObject

/**
 * Eodin Deferred Deep Link SDK for Android
 *
 * Enables apps to retrieve deferred deep link parameters after installation.
 *
 * Usage:
 * ```kotlin
 * // Configure in Application.onCreate()
 * EodinDeeplink.configure(
 *     context = this,
 *     apiEndpoint = "https://api.eodin.app/api/v1",
 *     service = "your-service-id"
 * )
 *
 * // Check for deferred params
 * EodinDeeplink.checkDeferredParams { result ->
 *     result.onSuccess { params ->
 *         params.path?.let { navigateToDeeplink(it) }
 *     }
 * }
 * ```
 */
object EodinDeeplink {

    private var apiEndpoint: String? = null
    private var serviceId: String? = null
    private var applicationContext: Context? = null
    private var isConfigured = false

    /**
     * Configure the SDK with API endpoint and service identifier.
     *
     * @param context Application context (required for device fingerprinting)
     * @param apiEndpoint The base URL of the Eodin API (e.g., "https://api.eodin.app/api/v1")
     * @param service The service identifier registered with Eodin (e.g., "shopping")
     */
    @JvmStatic
    fun configure(context: Context, apiEndpoint: String, service: String) {
        this.applicationContext = context.applicationContext
        this.apiEndpoint = apiEndpoint.trimEnd('/')
        this.serviceId = service
        this.isConfigured = true

        if (BuildConfig.DEBUG) {
            android.util.Log.d(TAG, "Configured with endpoint: $apiEndpoint, service: $service")
        }
    }

    /**
     * Check if SDK is properly configured and ready to use.
     */
    @JvmStatic
    val isReady: Boolean
        get() = isConfigured

    /**
     * Check for deferred deep link parameters.
     *
     * Call this method on app launch or when user completes onboarding.
     *
     * @param callback Callback with Result containing DeferredParamsResult
     */
    @JvmStatic
    fun checkDeferredParams(callback: (Result<DeferredParamsResult>) -> Unit) {
        if (!isConfigured || applicationContext == null) {
            callback(Result.failure(EodinException.NotConfigured()))
            return
        }

        val context = applicationContext!!
        val endpoint = apiEndpoint!!

        Thread {
            try {
                val deviceId = DeviceFingerprint.generate(context)

                if (BuildConfig.DEBUG) {
                    android.util.Log.d(TAG, "Checking deferred params with deviceId: $deviceId")
                }

                val url = URL("$endpoint/deferred-params?deviceId=$deviceId")
                val connection = url.openConnection() as HttpURLConnection

                connection.apply {
                    requestMethod = "GET"
                    setRequestProperty("Accept", "application/json")
                    connectTimeout = 10000
                    readTimeout = 10000
                }

                val responseCode = connection.responseCode

                when (responseCode) {
                    HttpURLConnection.HTTP_OK -> {
                        val response = readResponse(connection)
                        val json = JSONObject(response)

                        val result = DeferredParamsResult(
                            path = json.optString("deeplinkPath", null),
                            resourceId = json.optString("resourceId", null),
                            metadata = parseMetadata(json.optJSONObject("metadata"))
                        )

                        if (BuildConfig.DEBUG) {
                            android.util.Log.d(TAG, "Found deferred params: path=${result.path}, resourceId=${result.resourceId}")
                        }

                        // Store attribution if available (fire-and-forget)
                        result.metadata?.let { metadata ->
                            if (EodinAnalytics.isConfigured) {
                                storeAttributionAsync(metadata)
                            }
                        }

                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            callback(Result.success(result))
                        }
                    }

                    HttpURLConnection.HTTP_NOT_FOUND -> {
                        if (BuildConfig.DEBUG) {
                            android.util.Log.d(TAG, "No deferred params found (404)")
                        }

                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            callback(Result.failure(EodinException.NoParamsFound()))
                        }
                    }

                    else -> {
                        val errorMessage = try {
                            val errorResponse = readErrorResponse(connection)
                            JSONObject(errorResponse).optString("message", "Unknown error")
                        } catch (e: Exception) {
                            "Server error"
                        }

                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            callback(Result.failure(EodinException.ServerError(responseCode, errorMessage)))
                        }
                    }
                }

                connection.disconnect()
            } catch (e: Exception) {
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    callback(Result.failure(EodinException.NetworkError(e)))
                }
            }
        }.start()
    }

    /**
     * Suspend function version of checkDeferredParams for coroutines.
     *
     * @return DeferredParamsResult if found
     * @throws EodinException on error
     */
    @JvmStatic
    suspend fun checkDeferredParamsAsync(): DeferredParamsResult = withContext(Dispatchers.IO) {
        if (!isConfigured || applicationContext == null) {
            throw EodinException.NotConfigured()
        }

        val context = applicationContext!!
        val endpoint = apiEndpoint!!
        val deviceId = DeviceFingerprint.generate(context)

        if (BuildConfig.DEBUG) {
            android.util.Log.d(TAG, "Checking deferred params with deviceId: $deviceId")
        }

        val url = URL("$endpoint/deferred-params?deviceId=$deviceId")
        val connection = url.openConnection() as HttpURLConnection

        try {
            connection.apply {
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
                connectTimeout = 10000
                readTimeout = 10000
            }

            val responseCode = connection.responseCode

            when (responseCode) {
                HttpURLConnection.HTTP_OK -> {
                    val response = readResponse(connection)
                    val json = JSONObject(response)

                    val result = DeferredParamsResult(
                        path = json.optString("deeplinkPath", null),
                        resourceId = json.optString("resourceId", null),
                        metadata = parseMetadata(json.optJSONObject("metadata"))
                    )

                    // Store attribution if available (fire-and-forget)
                    result.metadata?.let { metadata ->
                        if (EodinAnalytics.isConfigured) {
                            storeAttributionAsync(metadata)
                        }
                    }

                    result
                }

                HttpURLConnection.HTTP_NOT_FOUND -> {
                    throw EodinException.NoParamsFound()
                }

                else -> {
                    val errorMessage = try {
                        val errorResponse = readErrorResponse(connection)
                        JSONObject(errorResponse).optString("message", "Unknown error")
                    } catch (e: Exception) {
                        "Server error"
                    }
                    throw EodinException.ServerError(responseCode, errorMessage)
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun readResponse(connection: HttpURLConnection): String {
        return BufferedReader(InputStreamReader(connection.inputStream)).use { reader ->
            reader.readText()
        }
    }

    private fun readErrorResponse(connection: HttpURLConnection): String {
        return BufferedReader(InputStreamReader(connection.errorStream)).use { reader ->
            reader.readText()
        }
    }

    private fun parseMetadata(json: JSONObject?): Map<String, Any>? {
        if (json == null) return null

        val map = mutableMapOf<String, Any>()
        json.keys().forEach { key ->
            json.opt(key)?.let { value ->
                map[key] = value
            }
        }
        return if (map.isEmpty()) null else map
    }

    // Attribution Storage

    private val attributionExecutor = Executors.newSingleThreadExecutor()

    /**
     * Store attribution asynchronously (fire-and-forget).
     * This prevents analytics failures from affecting the deeplink flow.
     */
    private fun storeAttributionAsync(metadata: Map<String, Any>) {
        attributionExecutor.execute {
            try {
                val attribution = extractAttribution(metadata)
                if (attribution != null && attribution.hasData) {
                    EodinAnalytics.setAttribution(attribution)
                    if (BuildConfig.DEBUG) {
                        android.util.Log.d(TAG, "Stored attribution: $attribution")
                    }
                }
            } catch (e: Exception) {
                // Log but don't propagate error - analytics should not affect deeplink
                if (BuildConfig.DEBUG) {
                    android.util.Log.w(TAG, "Failed to store attribution (non-critical): ${e.message}")
                }
            }
        }
    }

    /**
     * Extract attribution from metadata.
     */
    private fun extractAttribution(metadata: Map<String, Any>): Attribution? {
        // Check if there's any attribution data
        val hasAttribution = metadata.containsKey("utmSource") ||
            metadata.containsKey("utm_source") ||
            metadata.containsKey("source") ||
            metadata.containsKey("clickId") ||
            metadata.containsKey("click_id") ||
            metadata.containsKey("campaignId") ||
            metadata.containsKey("campaign_id")

        if (!hasAttribution) return null

        return Attribution(
            source = metadata["source"] as? String,
            campaignId = (metadata["campaign_id"] as? String) ?: (metadata["campaignId"] as? String),
            adsetId = (metadata["adset_id"] as? String) ?: (metadata["adsetId"] as? String),
            adId = (metadata["ad_id"] as? String) ?: (metadata["adId"] as? String),
            clickId = (metadata["click_id"] as? String) ?: (metadata["clickId"] as? String),
            clickIdType = (metadata["click_id_type"] as? String) ?: (metadata["clickIdType"] as? String),
            utmSource = (metadata["utm_source"] as? String) ?: (metadata["utmSource"] as? String),
            utmMedium = (metadata["utm_medium"] as? String) ?: (metadata["utmMedium"] as? String),
            utmCampaign = (metadata["utm_campaign"] as? String) ?: (metadata["utmCampaign"] as? String),
            utmContent = (metadata["utm_content"] as? String) ?: (metadata["utmContent"] as? String),
            utmTerm = (metadata["utm_term"] as? String) ?: (metadata["utmTerm"] as? String)
        )
    }

    private const val TAG = "EodinDeeplink"
}
