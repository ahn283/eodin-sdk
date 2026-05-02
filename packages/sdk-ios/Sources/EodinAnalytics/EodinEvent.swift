import Foundation

/// Recommended event names for `EodinAnalytics.track()`.
///
/// Aligns with `docs/logging/unified-event-reference.md` v1.1.
/// Use this enum for compile-time safety and cross-app consistency.
/// Free-form string event names continue to work for backward compatibility
/// and for app-specific domain events not covered here.
///
/// ## Example
///
/// ```swift
/// EodinAnalytics.track(.appOpen)
/// EodinAnalytics.track(.subscribeStart, properties: [
///     "plan": "monthly",
///     "price": 9900,
///     "currency": "KRW"
/// ])
///
/// // Free-form string still works:
/// EodinAnalytics.track("recipe_view", properties: ["recipe_id": "abc"])
/// ```
public enum EodinEvent: String, CaseIterable {
    // Lifecycle
    case appInstall = "app_install"
    case appOpen = "app_open"
    case sessionResume = "session_resume"
    case sessionStart = "session_start"
    case sessionEnd = "session_end"

    // Authentication / Identity
    case signUp = "sign_up"
    case signIn = "sign_in"
    case signOut = "sign_out"
    case accountDelete = "account_delete"

    // Onboarding
    case onboardingStart = "onboarding_start"
    case onboardingStep = "onboarding_step"
    case onboardingComplete = "onboarding_complete"
    case onboardingSkip = "onboarding_skip"

    // Core / Monetization
    case coreAction = "core_action"
    case paywallView = "paywall_view"
    case paywallDismiss = "paywall_dismiss"
    case subscribeStart = "subscribe_start"
    case trialStart = "trial_start"
    case subscribeRenew = "subscribe_renew"
    case subscriptionRestore = "subscription_restore"
    case iapPurchase = "iap_purchase"
    case dailyLimitReached = "daily_limit_reached"
    case dailyLimitDismiss = "daily_limit_dismiss"
    case dailyLimitUpgradeTap = "daily_limit_upgrade_tap"
    case passView = "pass_view"
    case passPurchase = "pass_purchase"
    case passExpire = "pass_expire"

    // Advertising — naming pattern: ad_<action> or ad_<format>_<action>
    case adRewardedView = "ad_rewarded_view"
    case adInterstitialView = "ad_interstitial_view"
    case adNativeView = "ad_native_view"
    case adClick = "ad_click"
    case adLoadFailed = "ad_load_failed"
    case adFreePass = "ad_free_pass"

    // Social / Viral
    case share = "share"
    case inviteShare = "invite_share"
    case inviteClaim = "invite_claim"
    case friendAdd = "friend_add"

    // iOS ATT
    case attPrompt = "att_prompt"
    case attResponse = "att_response"

    /// Wire-format event name (snake_case, matches unified-event-reference).
    public var eventName: String { rawValue }
}
