package app.eodin.deeplink

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.provider.Settings
import java.security.MessageDigest
import java.util.Locale
import java.util.TimeZone

/**
 * Device fingerprinting utility for generating consistent device identifiers.
 *
 * Uses Android ID and device characteristics to generate a SHA-256 fingerprint.
 */
internal object DeviceFingerprint {

    private const val PREF_NAME = "eodin_deeplink_prefs"
    private const val PREF_KEY_FINGERPRINT = "device_fingerprint"

    /**
     * Generate a consistent device fingerprint.
     *
     * Uses Android ID combined with device characteristics.
     * Fingerprint is cached in SharedPreferences for consistency.
     *
     * @param context Application context
     * @return SHA-256 hash string representing the device
     */
    @SuppressLint("HardwareIds")
    fun generate(context: Context): String {
        // Check cached fingerprint first
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        prefs.getString(PREF_KEY_FINGERPRINT, null)?.let { cached ->
            return cached
        }

        // Generate new fingerprint
        val components = mutableListOf<String>()

        // 1. Android ID (unique per app per device after factory reset)
        try {
            val androidId = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ANDROID_ID
            )
            if (!androidId.isNullOrBlank() && androidId != "9774d56d682e549c") {
                // Exclude known buggy value from some emulators
                components.add("android_id:$androidId")
            }
        } catch (e: Exception) {
            // Ignore - some contexts may not have access
        }

        // 2. Device info
        components.add("brand:${Build.BRAND}")
        components.add("model:${Build.MODEL}")
        components.add("device:${Build.DEVICE}")
        components.add("product:${Build.PRODUCT}")

        // 3. Build info
        components.add("sdk:${Build.VERSION.SDK_INT}")
        components.add("release:${Build.VERSION.RELEASE}")

        // 4. Display info
        try {
            val displayMetrics = context.resources.displayMetrics
            components.add("screen:${displayMetrics.widthPixels}x${displayMetrics.heightPixels}")
            components.add("density:${displayMetrics.density}")
        } catch (e: Exception) {
            // Ignore
        }

        // 5. Locale and timezone
        components.add("locale:${Locale.getDefault()}")
        components.add("timezone:${TimeZone.getDefault().id}")

        // 6. Package name (ensures different fingerprint per app)
        components.add("package:${context.packageName}")

        // Combine and hash
        val combined = components.joinToString("|")
        val fingerprint = sha256Hash(combined)

        // Cache it
        prefs.edit().putString(PREF_KEY_FINGERPRINT, fingerprint).apply()

        return fingerprint
    }

    /**
     * Reset the stored fingerprint (for testing purposes).
     */
    fun reset(context: Context) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(PREF_KEY_FINGERPRINT)
            .apply()
    }

    private fun sha256Hash(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256")
            .digest(input.toByteArray(Charsets.UTF_8))

        return bytes.joinToString("") { "%02x".format(it) }
    }
}
