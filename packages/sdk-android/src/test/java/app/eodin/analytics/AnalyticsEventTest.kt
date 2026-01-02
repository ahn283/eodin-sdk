package app.eodin.analytics

import app.eodin.analytics.models.AnalyticsEvent
import app.eodin.analytics.models.Attribution
import org.junit.Assert.*
import org.junit.Test
import java.util.Date

class AnalyticsEventTest {

    @Test
    fun `test event generates uuid by default`() {
        val event = AnalyticsEvent(
            eventName = "test_event",
            appId = "test-app",
            deviceId = "device-123"
        )

        assertNotNull(event.eventId)
        assertTrue(event.eventId.isNotEmpty())
    }

    @Test
    fun `test event to json contains required fields`() {
        val event = AnalyticsEvent(
            eventName = "app_open",
            appId = "fridgify",
            deviceId = "device-abc"
        )

        val json = event.toJson()

        assertEquals("app_open", json.getString("event_name"))
        assertEquals("fridgify", json.getString("app_id"))
        assertEquals("device-abc", json.getString("device_id"))
        assertTrue(json.has("event_id"))
        assertTrue(json.has("timestamp"))
    }

    @Test
    fun `test event to json with user id`() {
        val event = AnalyticsEvent(
            eventName = "purchase",
            appId = "arden",
            deviceId = "device-xyz",
            userId = "user-123"
        )

        val json = event.toJson()

        assertEquals("user-123", json.getString("user_id"))
    }

    @Test
    fun `test event to json with session id`() {
        val event = AnalyticsEvent(
            eventName = "page_view",
            appId = "fridgify",
            deviceId = "device-123",
            sessionId = "session-456"
        )

        val json = event.toJson()

        assertEquals("session-456", json.getString("session_id"))
    }

    @Test
    fun `test event to json with attribution`() {
        val attribution = Attribution(
            source = "meta",
            clickId = "fbclid123",
            clickIdType = "fbclid"
        )

        val event = AnalyticsEvent(
            eventName = "subscribe_start",
            appId = "arden",
            deviceId = "device-789",
            attribution = attribution
        )

        val json = event.toJson()

        assertTrue(json.has("attribution"))
        val attrJson = json.getJSONObject("attribution")
        assertEquals("meta", attrJson.getString("source"))
        assertEquals("fbclid123", attrJson.getString("click_id"))
    }

    @Test
    fun `test event to json with properties`() {
        val event = AnalyticsEvent(
            eventName = "button_click",
            appId = "fridgify",
            deviceId = "device-abc",
            properties = mapOf(
                "button_name" to "subscribe",
                "screen" to "home",
                "count" to 5,
                "premium" to true
            )
        )

        val json = event.toJson()

        assertTrue(json.has("properties"))
        val props = json.getJSONObject("properties")
        assertEquals("subscribe", props.getString("button_name"))
        assertEquals("home", props.getString("screen"))
        assertEquals(5, props.getInt("count"))
        assertEquals(true, props.getBoolean("premium"))
    }

    @Test
    fun `test event serialization and deserialization`() {
        val original = AnalyticsEvent(
            eventName = "test_event",
            appId = "test-app",
            deviceId = "device-123",
            userId = "user-456",
            sessionId = "session-789",
            properties = mapOf("key" to "value")
        )

        val serialized = original.serialize()
        val deserialized = AnalyticsEvent.deserialize(serialized)

        assertNotNull(deserialized)
        assertEquals(original.eventId, deserialized?.eventId)
        assertEquals(original.eventName, deserialized?.eventName)
        assertEquals(original.appId, deserialized?.appId)
        assertEquals(original.deviceId, deserialized?.deviceId)
        assertEquals(original.userId, deserialized?.userId)
        assertEquals(original.sessionId, deserialized?.sessionId)
    }

    @Test
    fun `test deserialize invalid json returns null`() {
        val invalidJson = "invalid json string"
        val result = AnalyticsEvent.deserialize(invalidJson)
        assertNull(result)
    }

    @Test
    fun `test timestamp is in iso8601 format`() {
        val event = AnalyticsEvent(
            eventName = "test",
            appId = "app",
            deviceId = "device"
        )

        val json = event.toJson()
        val timestamp = json.getString("timestamp")

        // Should match ISO 8601 format: yyyy-MM-dd'T'HH:mm:ss.SSS'Z'
        assertTrue(timestamp.matches(Regex("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z")))
    }
}
