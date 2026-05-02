package app.eodin.analytics

import org.junit.Assert.*
import org.junit.Test

class EodinEventTest {

    @Test
    fun `eventName is snake_case wire format`() {
        assertEquals("app_open", EodinEvent.APP_OPEN.eventName)
        assertEquals("subscribe_start", EodinEvent.SUBSCRIBE_START.eventName)
        assertEquals("account_delete", EodinEvent.ACCOUNT_DELETE.eventName)
        assertEquals("ad_rewarded_view", EodinEvent.AD_REWARDED_VIEW.eventName)
        assertEquals("ad_interstitial_view", EodinEvent.AD_INTERSTITIAL_VIEW.eventName)
        assertEquals("daily_limit_reached", EodinEvent.DAILY_LIMIT_REACHED.eventName)
        assertEquals("daily_limit_upgrade_tap", EodinEvent.DAILY_LIMIT_UPGRADE_TAP.eventName)
        assertEquals("pass_purchase", EodinEvent.PASS_PURCHASE.eventName)
    }

    @Test
    fun `all enum values use snake_case and are within 40 chars`() {
        val pattern = Regex("^[a-z][a-z0-9]*(_[a-z0-9]+)*$")
        for (e in EodinEvent.values()) {
            assertTrue("${e.name} -> '${e.eventName}' is not snake_case", pattern.matches(e.eventName))
            assertTrue("${e.name} -> '${e.eventName}' exceeds 40 chars", e.eventName.length <= 40)
        }
    }

    @Test
    fun `all enum values are unique`() {
        val names = EodinEvent.values().map { it.eventName }
        assertEquals("duplicate eventName", names.toSet().size, names.size)
    }

    @Test
    fun `does not contain forbidden v1 names`() {
        // Phase 0.4 audit: these v1 names violate naming rules.
        // EodinEvent enum should NOT include them; v2 migration replaces.
        val forbidden = setOf(
            "subscription_purchase_completed",
            "subscription_trial_started",
            "subscription_restored",
            "paywall_dismissed",
            "ad_clicked",
            "ad_failed",
            "rewarded_ad_attempt",
            "rewarded_ad_complete",
            "interstitial_ad_shown",
            "native_ad_shown",
            "login",
            "auth_logout",
            "auth_account_deleted",
            "onboarding_skipped"
        )
        val used = EodinEvent.values().map { it.eventName }.toSet()
        assertTrue(used.intersect(forbidden).isEmpty())
    }
}
