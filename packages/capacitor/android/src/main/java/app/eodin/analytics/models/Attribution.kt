package app.eodin.analytics.models

import org.json.JSONObject

/**
 * Attribution data from advertising platforms.
 *
 * Captures click IDs and UTM parameters for attribution tracking.
 */
data class Attribution(
    /** Attribution source */
    val source: String? = null,

    /** Campaign ID */
    val campaignId: String? = null,

    /** Ad set ID */
    val adsetId: String? = null,

    /** Ad ID */
    val adId: String? = null,

    /** Click ID (fbclid, gclid, ttclid, li_fat_id) */
    val clickId: String? = null,

    /** Click ID type (meta, google, tiktok, linkedin) */
    val clickIdType: String? = null,

    /** UTM source */
    val utmSource: String? = null,

    /** UTM medium */
    val utmMedium: String? = null,

    /** UTM campaign */
    val utmCampaign: String? = null,

    /** UTM content */
    val utmContent: String? = null,

    /** UTM term */
    val utmTerm: String? = null
) {
    /**
     * Whether this attribution has any data.
     */
    val hasData: Boolean
        get() = source != null || campaignId != null || clickId != null ||
                utmSource != null || utmCampaign != null

    /**
     * Convert to JSON for API requests.
     */
    fun toJson(): JSONObject {
        return JSONObject().apply {
            source?.let { put("source", it) }
            campaignId?.let { put("campaign_id", it) }
            adsetId?.let { put("adset_id", it) }
            adId?.let { put("ad_id", it) }
            clickId?.let { put("click_id", it) }
            clickIdType?.let { put("click_id_type", it) }
            utmSource?.let { put("utm_source", it) }
            utmMedium?.let { put("utm_medium", it) }
            utmCampaign?.let { put("utm_campaign", it) }
            utmContent?.let { put("utm_content", it) }
            utmTerm?.let { put("utm_term", it) }
        }
    }

    /**
     * Serialize to JSON string for storage.
     */
    fun serialize(): String = toJson().toString()

    companion object {
        /**
         * Deserialize from JSON string.
         */
        fun deserialize(jsonString: String): Attribution? {
            return try {
                fromJson(JSONObject(jsonString))
            } catch (e: Exception) {
                null
            }
        }

        /**
         * Create from JSON object.
         */
        fun fromJson(json: JSONObject): Attribution {
            return Attribution(
                source = json.optString("source", null),
                campaignId = json.optString("campaign_id", null),
                adsetId = json.optString("adset_id", null),
                adId = json.optString("ad_id", null),
                clickId = json.optString("click_id", null),
                clickIdType = json.optString("click_id_type", null),
                utmSource = json.optString("utm_source", null),
                utmMedium = json.optString("utm_medium", null),
                utmCampaign = json.optString("utm_campaign", null),
                utmContent = json.optString("utm_content", null),
                utmTerm = json.optString("utm_term", null)
            )
        }
    }
}
