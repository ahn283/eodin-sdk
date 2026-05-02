package app.eodin.analytics

/**
 * Recommended event names for [EodinAnalytics.track].
 *
 * Aligns with `docs/logging/unified-event-reference.md` v1.1. Use this enum
 * for IDE autocomplete and cross-app consistency. Free-form string event
 * names continue to work for backward compatibility and for app-specific
 * domain events not covered here.
 *
 * ### Example
 *
 * ```kotlin
 * EodinAnalytics.track(EodinEvent.APP_OPEN)
 * EodinAnalytics.track(
 *     EodinEvent.SUBSCRIBE_START,
 *     mapOf("plan" to "monthly", "price" to 9900, "currency" to "KRW")
 * )
 *
 * // Free-form string still works:
 * EodinAnalytics.track("recipe_view", mapOf("recipe_id" to "abc"))
 * ```
 */
enum class EodinEvent(val eventName: String) {
    // Lifecycle
    APP_INSTALL("app_install"),
    APP_OPEN("app_open"),
    SESSION_RESUME("session_resume"),
    SESSION_START("session_start"),
    SESSION_END("session_end"),

    // Authentication / Identity
    SIGN_UP("sign_up"),
    SIGN_IN("sign_in"),
    SIGN_OUT("sign_out"),
    ACCOUNT_DELETE("account_delete"),

    // Onboarding
    ONBOARDING_START("onboarding_start"),
    ONBOARDING_STEP("onboarding_step"),
    ONBOARDING_COMPLETE("onboarding_complete"),
    ONBOARDING_SKIP("onboarding_skip"),

    // Core / Monetization
    CORE_ACTION("core_action"),
    PAYWALL_VIEW("paywall_view"),
    PAYWALL_DISMISS("paywall_dismiss"),
    SUBSCRIBE_START("subscribe_start"),
    TRIAL_START("trial_start"),
    SUBSCRIBE_RENEW("subscribe_renew"),
    SUBSCRIPTION_RESTORE("subscription_restore"),
    IAP_PURCHASE("iap_purchase"),
    DAILY_LIMIT_REACHED("daily_limit_reached"),
    DAILY_LIMIT_DISMISS("daily_limit_dismiss"),
    DAILY_LIMIT_UPGRADE_TAP("daily_limit_upgrade_tap"),
    PASS_VIEW("pass_view"),
    PASS_PURCHASE("pass_purchase"),
    PASS_EXPIRE("pass_expire"),

    // Advertising — naming pattern: ad_<action> or ad_<format>_<action>
    AD_REWARDED_VIEW("ad_rewarded_view"),
    AD_INTERSTITIAL_VIEW("ad_interstitial_view"),
    AD_NATIVE_VIEW("ad_native_view"),
    AD_CLICK("ad_click"),
    AD_LOAD_FAILED("ad_load_failed"),
    AD_FREE_PASS("ad_free_pass"),

    // Social / Viral
    SHARE("share"),
    INVITE_SHARE("invite_share"),
    INVITE_CLAIM("invite_claim"),
    FRIEND_ADD("friend_add"),

    // iOS ATT (no-op on Android, kept for cross-platform consistency)
    ATT_PROMPT("att_prompt"),
    ATT_RESPONSE("att_response"),
}
