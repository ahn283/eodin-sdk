/// Recommended event names for `EodinAnalytics.track()`.
///
/// Aligns with `docs/logging/unified-event-reference.md` v1.1.
/// Use this enum for IDE autocomplete and cross-app consistency. Free-form
/// string event names continue to work for backward compatibility and for
/// app-specific domain events not covered here.
///
/// ## Example
///
/// ```dart
/// EodinAnalytics.trackEvent(EodinEvent.appOpen);
/// EodinAnalytics.trackEvent(
///   EodinEvent.subscribeStart,
///   properties: {'plan': 'monthly', 'price': 9900, 'currency': 'KRW'},
/// );
///
/// // Free-form string still works:
/// EodinAnalytics.track('recipe_view', properties: {'recipe_id': 'abc'});
/// ```
enum EodinEvent {
  // Lifecycle
  appInstall('app_install'),
  appOpen('app_open'),
  sessionResume('session_resume'),
  sessionStart('session_start'),
  sessionEnd('session_end'),

  // Authentication / Identity
  signUp('sign_up'),
  signIn('sign_in'),
  signOut('sign_out'),
  accountDelete('account_delete'),

  // Onboarding
  onboardingStart('onboarding_start'),
  onboardingStep('onboarding_step'),
  onboardingComplete('onboarding_complete'),
  onboardingSkip('onboarding_skip'),

  // Core / Monetization
  coreAction('core_action'),
  paywallView('paywall_view'),
  paywallDismiss('paywall_dismiss'),
  subscribeStart('subscribe_start'),
  trialStart('trial_start'),
  subscribeRenew('subscribe_renew'),
  subscriptionRestore('subscription_restore'),
  iapPurchase('iap_purchase'),
  dailyLimitReached('daily_limit_reached'),
  dailyLimitDismiss('daily_limit_dismiss'),
  dailyLimitUpgradeTap('daily_limit_upgrade_tap'),
  passView('pass_view'),
  passPurchase('pass_purchase'),
  passExpire('pass_expire'),

  // Advertising — naming pattern: ad_<action> or ad_<format>_<action>
  adRewardedView('ad_rewarded_view'),
  adInterstitialView('ad_interstitial_view'),
  adNativeView('ad_native_view'),
  adClick('ad_click'),
  adLoadFailed('ad_load_failed'),
  adFreePass('ad_free_pass'),

  // Social / Viral
  share('share'),
  inviteShare('invite_share'),
  inviteClaim('invite_claim'),
  friendAdd('friend_add'),

  // iOS ATT
  attPrompt('att_prompt'),
  attResponse('att_response');

  const EodinEvent(this.eventName);

  /// Wire-format event name (snake_case, matches unified-event-reference).
  final String eventName;
}
