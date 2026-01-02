package app.eodin.analytics.models

import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/**
 * Represents an analytics event.
 */
data class AnalyticsEvent(
    /** Unique event ID (UUID) */
    val eventId: String = UUID.randomUUID().toString(),

    /** Event name (e.g., 'app_open', 'subscribe_start') */
    val eventName: String,

    /** App ID (e.g., 'fridgify', 'arden') */
    val appId: String,

    /** Device ID (UUID) */
    val deviceId: String,

    /** User ID (optional) */
    val userId: String? = null,

    /** Session ID (UUID) */
    val sessionId: String? = null,

    /** Event timestamp */
    val timestamp: Date = Date(),

    /** Attribution data */
    val attribution: Attribution? = null,

    /** Device information */
    val device: DeviceInfo? = null,

    /** Custom properties */
    val properties: Map<String, Any>? = null
) {
    /**
     * Convert to JSON for API requests.
     */
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("event_id", eventId)
            put("event_name", eventName)
            put("app_id", appId)
            put("device_id", deviceId)
            userId?.let { put("user_id", it) }
            sessionId?.let { put("session_id", it) }
            put("timestamp", formatTimestamp(timestamp))
            attribution?.let { put("attribution", it.toJson()) }
            device?.let { put("device", it.toJson()) }
            properties?.let { put("properties", propertiesToJson(it)) }
        }
    }

    /**
     * Serialize to JSON string for storage.
     */
    fun serialize(): String = toJson().toString()

    private fun formatTimestamp(date: Date): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        return formatter.format(date)
    }

    private fun propertiesToJson(props: Map<String, Any>): JSONObject {
        return JSONObject().apply {
            props.forEach { (key, value) ->
                when (value) {
                    is Boolean -> put(key, value)
                    is Int -> put(key, value)
                    is Long -> put(key, value)
                    is Double -> put(key, value)
                    is Float -> put(key, value.toDouble())
                    is String -> put(key, value)
                    is List<*> -> put(key, JSONArray(value))
                    is Map<*, *> -> put(key, JSONObject(value as Map<*, *>))
                    else -> put(key, value.toString())
                }
            }
        }
    }

    companion object {
        /**
         * Deserialize from JSON string.
         */
        fun deserialize(jsonString: String): AnalyticsEvent? {
            return try {
                val json = JSONObject(jsonString)
                val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                formatter.timeZone = TimeZone.getTimeZone("UTC")

                AnalyticsEvent(
                    eventId = json.getString("event_id"),
                    eventName = json.getString("event_name"),
                    appId = json.getString("app_id"),
                    deviceId = json.getString("device_id"),
                    userId = json.optString("user_id", null),
                    sessionId = json.optString("session_id", null),
                    timestamp = formatter.parse(json.getString("timestamp")) ?: Date(),
                    attribution = json.optJSONObject("attribution")?.let { Attribution.fromJson(it) },
                    device = null, // DeviceInfo is collected fresh
                    properties = json.optJSONObject("properties")?.let { parseProperties(it) }
                )
            } catch (e: Exception) {
                null
            }
        }

        private fun parseProperties(json: JSONObject): Map<String, Any> {
            val map = mutableMapOf<String, Any>()
            json.keys().forEach { key ->
                json.opt(key)?.let { value ->
                    map[key] = value
                }
            }
            return map
        }
    }
}
