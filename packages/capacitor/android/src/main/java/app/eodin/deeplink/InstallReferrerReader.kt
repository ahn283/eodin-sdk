package app.eodin.deeplink

import android.content.Context
import android.os.Looper
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Reads the Google Play Install Referrer (deeplink-reliability Phase 3, F-3).
 *
 * On a deferred deep link the landing embeds `referrer=eodin_cid=<token>` in the
 * Play Store URL; after install the referrer is available here and the backend
 * matches the token deterministically — no fingerprint guessing.
 *
 * Synchronous (blocks briefly) so it can run inside the existing background thread.
 * Result is cached after the first definitive response. Returns null when
 * unavailable (non-Play install, OEM store, error).
 */
internal object InstallReferrerReader {

    private const val PREF_NAME = "eodin_deeplink_prefs"
    private const val PREF_KEY_REFERRER = "install_referrer"
    private const val PREF_KEY_READ = "install_referrer_read"

    fun fetch(context: Context, timeoutMs: Long = 3000): String? {
        // Blocks on a latch → must not run on the main thread.
        check(Looper.myLooper() != Looper.getMainLooper()) {
            "InstallReferrerReader.fetch must run off the main thread"
        }
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        if (prefs.getBoolean(PREF_KEY_READ, false)) {
            return prefs.getString(PREF_KEY_REFERRER, null)
        }

        val latch = CountDownLatch(1)
        var referrer: String? = null
        var gotDefinitiveAnswer = false
        val client = InstallReferrerClient.newBuilder(context).build()

        try {
            client.startConnection(object : InstallReferrerStateListener {
                override fun onInstallReferrerSetupFinished(responseCode: Int) {
                    try {
                        if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                            gotDefinitiveAnswer = true
                            referrer = client.installReferrer.installReferrer
                        } else if (responseCode == InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED) {
                            gotDefinitiveAnswer = true
                        }
                        // SERVICE_UNAVAILABLE / DEVELOPER_ERROR → transient, allow retry next launch.
                    } catch (e: Exception) {
                        // ignore — treat as unavailable
                    } finally {
                        try { client.endConnection() } catch (e: Exception) { /* ignore */ }
                        latch.countDown()
                    }
                }

                override fun onInstallReferrerServiceDisconnected() {
                    latch.countDown()
                }
            })
            latch.await(timeoutMs, TimeUnit.MILLISECONDS)
        } catch (e: Exception) {
            // ignore — referrer unavailable this run
        }

        if (gotDefinitiveAnswer) {
            val toCache = if (hasEodinClickId(referrer)) referrer else null
            prefs.edit()
                .putBoolean(PREF_KEY_READ, true)
                .putString(PREF_KEY_REFERRER, toCache)
                .apply()
        }
        return referrer
    }

    /** True when the referrer carries the eodin click token (query-param boundary). */
    fun hasEodinClickId(referrer: String?): Boolean =
        referrer != null && Regex("(^|[?&])eodin_cid=").containsMatchIn(referrer)
}
