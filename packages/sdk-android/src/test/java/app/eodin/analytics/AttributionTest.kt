package app.eodin.analytics

import app.eodin.analytics.models.Attribution
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AttributionTest {

    @Test
    fun `test empty attribution has no data`() {
        val attribution = Attribution()
        assertFalse(attribution.hasData)
    }

    @Test
    fun `test attribution with source has data`() {
        val attribution = Attribution(source = "meta")
        assertTrue(attribution.hasData)
    }

    @Test
    fun `test attribution with click id has data`() {
        val attribution = Attribution(clickId = "abc123", clickIdType = "fbclid")
        assertTrue(attribution.hasData)
    }

    @Test
    fun `test attribution with utm source has data`() {
        val attribution = Attribution(utmSource = "facebook")
        assertTrue(attribution.hasData)
    }

    @Test
    fun `test attribution to json`() {
        val attribution = Attribution(
            source = "meta",
            campaignId = "camp123",
            clickId = "fbclid123",
            clickIdType = "fbclid",
            utmSource = "facebook",
            utmMedium = "cpc",
            utmCampaign = "spring_sale"
        )

        val json = attribution.toJson()

        assertEquals("meta", json.getString("source"))
        assertEquals("camp123", json.getString("campaign_id"))
        assertEquals("fbclid123", json.getString("click_id"))
        assertEquals("fbclid", json.getString("click_id_type"))
        assertEquals("facebook", json.getString("utm_source"))
        assertEquals("cpc", json.getString("utm_medium"))
        assertEquals("spring_sale", json.getString("utm_campaign"))
    }

    @Test
    fun `test attribution serialization and deserialization`() {
        val original = Attribution(
            source = "google",
            campaignId = "gcamp456",
            clickId = "gclid456",
            clickIdType = "gclid",
            utmSource = "google",
            utmMedium = "cpc"
        )

        val serialized = original.serialize()
        val deserialized = Attribution.deserialize(serialized)

        assertNotNull(deserialized)
        assertEquals(original.source, deserialized?.source)
        assertEquals(original.campaignId, deserialized?.campaignId)
        assertEquals(original.clickId, deserialized?.clickId)
        assertEquals(original.clickIdType, deserialized?.clickIdType)
        assertEquals(original.utmSource, deserialized?.utmSource)
        assertEquals(original.utmMedium, deserialized?.utmMedium)
    }

    @Test
    fun `test attribution from json`() {
        val json = JSONObject().apply {
            put("source", "tiktok")
            put("campaign_id", "tt123")
            put("click_id", "ttclid789")
            put("click_id_type", "ttclid")
        }

        val attribution = Attribution.fromJson(json)

        assertEquals("tiktok", attribution.source)
        assertEquals("tt123", attribution.campaignId)
        assertEquals("ttclid789", attribution.clickId)
        assertEquals("ttclid", attribution.clickIdType)
    }

    @Test
    fun `test deserialize invalid json returns null`() {
        val invalidJson = "not a json"
        val result = Attribution.deserialize(invalidJson)
        assertNull(result)
    }
}
