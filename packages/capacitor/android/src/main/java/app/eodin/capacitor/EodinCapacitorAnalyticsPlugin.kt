package app.eodin.capacitor

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import app.eodin.analytics.EodinAnalytics
import app.eodin.analytics.models.Attribution

@CapacitorPlugin(name = "EodinAnalytics")
class EodinCapacitorAnalyticsPlugin : Plugin() {

    @PluginMethod
    fun configure(call: PluginCall) {
        val apiEndpoint = call.getString("apiEndpoint")
        val apiKey = call.getString("apiKey")
        val appId = call.getString("appId")

        if (apiEndpoint == null || apiKey == null || appId == null) {
            call.reject("apiEndpoint, apiKey, and appId are required")
            return
        }

        EodinAnalytics.configure(
            context = context,
            apiEndpoint = apiEndpoint,
            apiKey = apiKey,
            appId = appId,
            debug = call.getBoolean("debug", false) ?: false,
            offlineMode = call.getBoolean("offlineMode", true) ?: true
        )
        call.resolve()
    }

    @PluginMethod
    fun track(call: PluginCall) {
        val eventName = call.getString("eventName")
        if (eventName == null) {
            call.reject("eventName is required")
            return
        }

        val properties = call.getObject("properties")?.let { obj ->
            val map = mutableMapOf<String, Any>()
            obj.keys().forEach { key -> obj.opt(key)?.let { map[key] = it } }
            map
        }

        EodinAnalytics.track(eventName, properties)
        call.resolve()
    }

    @PluginMethod
    fun identify(call: PluginCall) {
        val userId = call.getString("userId")
        if (userId == null) {
            call.reject("userId is required")
            return
        }
        EodinAnalytics.identify(userId)
        call.resolve()
    }

    @PluginMethod
    fun clearIdentity(call: PluginCall) {
        EodinAnalytics.clearIdentity()
        call.resolve()
    }

    @PluginMethod
    fun setAttribution(call: PluginCall) {
        val attribution = Attribution(
            source = call.getString("source"),
            campaignId = call.getString("campaignId"),
            adsetId = call.getString("adsetId"),
            adId = call.getString("adId"),
            clickId = call.getString("clickId"),
            clickIdType = call.getString("clickIdType"),
            utmSource = call.getString("utmSource"),
            utmMedium = call.getString("utmMedium"),
            utmCampaign = call.getString("utmCampaign"),
            utmContent = call.getString("utmContent"),
            utmTerm = call.getString("utmTerm")
        )
        EodinAnalytics.setAttribution(attribution)
        call.resolve()
    }

    @PluginMethod
    fun flush(call: PluginCall) {
        EodinAnalytics.flush()
        call.resolve()
    }

    @PluginMethod
    fun startSession(call: PluginCall) {
        EodinAnalytics.startSession()
        call.resolve()
    }

    @PluginMethod
    fun endSession(call: PluginCall) {
        EodinAnalytics.endSession()
        call.resolve()
    }

    @PluginMethod
    fun requestTrackingAuthorization(call: PluginCall) {
        val data = JSObject()
        data.put("status", "authorized")
        call.resolve(data)
    }

    @PluginMethod
    fun getATTStatus(call: PluginCall) {
        val data = JSObject()
        data.put("status", "authorized")
        call.resolve(data)
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val data = JSObject().apply {
            put("isConfigured", EodinAnalytics.isConfigured)
            put("deviceId", EodinAnalytics.getDeviceId())
            put("userId", EodinAnalytics.getUserId())
            put("sessionId", EodinAnalytics.getSessionId())
            put("isOnline", EodinAnalytics.isOnline())
            put("queueSize", EodinAnalytics.getQueueSize())
            put("attStatus", "authorized")
        }
        call.resolve(data)
    }

    // GDPR (Phase 1.7 — open-issues §4.5)

    @PluginMethod
    fun setEnabled(call: PluginCall) {
        val enabled = call.getBoolean("enabled")
        if (enabled == null) {
            call.reject("enabled (bool) is required")
            return
        }
        EodinAnalytics.setEnabled(enabled)
        call.resolve()
    }

    @PluginMethod
    fun isEnabled(call: PluginCall) {
        call.resolve(JSObject().apply { put("enabled", EodinAnalytics.isEnabled) })
    }

    @PluginMethod
    fun requestDataDeletion(call: PluginCall) {
        EodinAnalytics.requestDataDeletion { success ->
            call.resolve(JSObject().apply { put("success", success) })
        }
    }
}
