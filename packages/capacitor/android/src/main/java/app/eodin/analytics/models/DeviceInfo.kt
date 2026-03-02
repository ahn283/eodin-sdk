package app.eodin.analytics.models

import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.util.Locale
import java.util.TimeZone

/**
 * Device information for analytics events.
 */
data class DeviceInfo(
    /** Operating system (android) */
    val os: String = "android",

    /** OS version (e.g., "14", "13") */
    val osVersion: String? = null,

    /** Device model (e.g., "Pixel 8", "Galaxy S24") */
    val model: String? = null,

    /** Device manufacturer (e.g., "Google", "Samsung") */
    val manufacturer: String? = null,

    /** Device locale (e.g., "en_US", "ko_KR") */
    val locale: String? = null,

    /** Device timezone (e.g., "Asia/Seoul") */
    val timezone: String? = null,

    /** App version name */
    val appVersion: String? = null,

    /** App version code */
    val appVersionCode: Int? = null
) {
    /**
     * Convert to JSON for API requests.
     */
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("os", os)
            osVersion?.let { put("os_version", it) }
            model?.let { put("model", it) }
            manufacturer?.let { put("manufacturer", it) }
            locale?.let { put("locale", it) }
            timezone?.let { put("timezone", it) }
            appVersion?.let { put("app_version", it) }
            appVersionCode?.let { put("app_version_code", it) }
        }
    }

    companion object {
        /**
         * Collect device information from the current device.
         *
         * @param context Application context
         * @return DeviceInfo with collected data
         */
        fun collect(context: Context): DeviceInfo {
            val packageInfo = try {
                context.packageManager.getPackageInfo(context.packageName, 0)
            } catch (e: Exception) {
                null
            }

            val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo?.longVersionCode?.toInt()
            } else {
                @Suppress("DEPRECATION")
                packageInfo?.versionCode
            }

            return DeviceInfo(
                os = "android",
                osVersion = Build.VERSION.RELEASE,
                model = Build.MODEL,
                manufacturer = Build.MANUFACTURER,
                locale = Locale.getDefault().toString(),
                timezone = TimeZone.getDefault().id,
                appVersion = packageInfo?.versionName,
                appVersionCode = versionCode
            )
        }
    }
}
