/**
 * Recommended event names for `EodinAnalytics.track()`.
 *
 * Aligns with `docs/logging/unified-event-reference.md` v1.1. Use this enum
 * for IDE autocomplete and cross-app consistency. Free-form string event
 * names continue to work for backward compatibility and for app-specific
 * domain events not covered here.
 *
 * @example
 * ```ts
 * import { EodinAnalytics, EodinEvent } from '@eodin/capacitor';
 *
 * await EodinAnalytics.track(EodinEvent.AppOpen);
 * await EodinAnalytics.track(EodinEvent.SubscribeStart, {
 *   plan: 'monthly',
 *   price: 9900,
 *   currency: 'KRW',
 * });
 *
 * // Free-form string still works:
 * await EodinAnalytics.track('recipe_view', { recipe_id: 'abc' });
 * ```
 */
export const EodinEvent = {
  // Lifecycle
  AppInstall: 'app_install',
  AppOpen: 'app_open',
  SessionResume: 'session_resume',
  SessionStart: 'session_start',
  SessionEnd: 'session_end',

  // Authentication / Identity
  SignUp: 'sign_up',
  SignIn: 'sign_in',
  SignOut: 'sign_out',
  AccountDelete: 'account_delete',

  // Onboarding
  OnboardingStart: 'onboarding_start',
  OnboardingStep: 'onboarding_step',
  OnboardingComplete: 'onboarding_complete',
  OnboardingSkip: 'onboarding_skip',

  // Core / Monetization
  CoreAction: 'core_action',
  PaywallView: 'paywall_view',
  PaywallDismiss: 'paywall_dismiss',
  SubscribeStart: 'subscribe_start',
  TrialStart: 'trial_start',
  SubscribeRenew: 'subscribe_renew',
  SubscriptionRestore: 'subscription_restore',
  IapPurchase: 'iap_purchase',
  DailyLimitReached: 'daily_limit_reached',
  DailyLimitDismiss: 'daily_limit_dismiss',
  DailyLimitUpgradeTap: 'daily_limit_upgrade_tap',
  PassView: 'pass_view',
  PassPurchase: 'pass_purchase',
  PassExpire: 'pass_expire',

  // Advertising — naming pattern: ad_<action> or ad_<format>_<action>
  AdRewardedView: 'ad_rewarded_view',
  AdInterstitialView: 'ad_interstitial_view',
  AdNativeView: 'ad_native_view',
  AdClick: 'ad_click',
  AdLoadFailed: 'ad_load_failed',
  AdFreePass: 'ad_free_pass',

  // Social / Viral
  Share: 'share',
  InviteShare: 'invite_share',
  InviteClaim: 'invite_claim',
  FriendAdd: 'friend_add',

  // iOS ATT
  AttPrompt: 'att_prompt',
  AttResponse: 'att_response',
} as const;

/** Union of recommended event names. Free-form string is also accepted. */
export type EodinEventName = (typeof EodinEvent)[keyof typeof EodinEvent];
