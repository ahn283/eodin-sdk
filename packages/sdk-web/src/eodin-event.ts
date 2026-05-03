/**
 * Recommended event names for `EodinAnalytics.track()` on web.
 *
 * 4채널 SDK (Flutter / iOS / Android / Capacitor) 의 EodinEvent enum 과
 * **wire string 동일성** 유지. 메인 SDK Phase 1.6 의 EodinEvent enum 정책:
 * - 같은 의미 이벤트는 같은 wire string ('app_open' 등) 으로 5채널 통일
 * - 채널 고유 이벤트는 추가 가능 (web: page_view 등)
 *
 * Free-form string 도 그대로 허용 — 호스트 앱 도메인 이벤트 (예:
 * `track('recipe_view', { id })`) 는 enum 미경유 호출 가능.
 *
 * @example
 * ```ts
 * import { EodinAnalytics, EodinEvent } from 'eodin-web';
 *
 * EodinAnalytics.track(EodinEvent.AppOpen);
 * EodinAnalytics.track(EodinEvent.PageView, { path: '/pricing' });
 * EodinAnalytics.track('custom_event', { foo: 'bar' });
 * ```
 */
export const EodinEvent = {
  // Lifecycle (5채널 공통)
  AppInstall: 'app_install',
  AppOpen: 'app_open',
  SessionResume: 'session_resume',
  SessionStart: 'session_start',
  SessionEnd: 'session_end',

  // Web 고유 — autoTrackPageView 옵션이 활성일 때 자동 발생
  PageView: 'page_view',

  // Authentication / Identity (5채널 공통)
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

  // Advertising — naming: ad_<action> 또는 ad_<format>_<action>
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

  // iOS ATT — web 에서 사용 안 하나 wire string 유지 (cross-app 분석에서 받을 수
  // 있으므로 enum entry 보존)
  AttPrompt: 'att_prompt',
  AttResponse: 'att_response',
} as const;

/** Union of recommended event names. Free-form string 도 허용. */
export type EodinEventName = (typeof EodinEvent)[keyof typeof EodinEvent];
