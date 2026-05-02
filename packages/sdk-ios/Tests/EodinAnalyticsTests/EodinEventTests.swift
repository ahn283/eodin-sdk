import XCTest
@testable import EodinAnalytics

final class EodinEventTests: XCTestCase {
    func testEventNameIsSnakeCase() {
        XCTAssertEqual(EodinEvent.appOpen.eventName, "app_open")
        XCTAssertEqual(EodinEvent.subscribeStart.eventName, "subscribe_start")
        XCTAssertEqual(EodinEvent.accountDelete.eventName, "account_delete")
        XCTAssertEqual(EodinEvent.adRewardedView.eventName, "ad_rewarded_view")
        XCTAssertEqual(EodinEvent.adInterstitialView.eventName, "ad_interstitial_view")
        XCTAssertEqual(EodinEvent.dailyLimitReached.eventName, "daily_limit_reached")
        XCTAssertEqual(EodinEvent.dailyLimitUpgradeTap.eventName, "daily_limit_upgrade_tap")
        XCTAssertEqual(EodinEvent.passPurchase.eventName, "pass_purchase")
    }

    func testAllValuesAreSnakeCase() {
        let pattern = "^[a-z][a-z0-9]*(_[a-z0-9]+)*$"
        let regex = try! NSRegularExpression(pattern: pattern)
        for event in EodinEvent.allCases {
            let name = event.eventName
            let range = NSRange(location: 0, length: name.utf16.count)
            XCTAssertNotNil(
                regex.firstMatch(in: name, range: range),
                "\(name) is not snake_case"
            )
            XCTAssertLessThanOrEqual(name.count, 40, "\(name) exceeds 40 chars")
        }
    }

    func testAllValuesAreUnique() {
        let names = EodinEvent.allCases.map { $0.eventName }
        XCTAssertEqual(Set(names).count, names.count, "duplicate eventName")
    }

    func testDoesNotContainForbiddenV1Names() {
        // Phase 0.4 audit: these v1 names violate naming rules.
        // EodinEvent enum should NOT include them; v2 migration replaces.
        let forbidden: Set<String> = [
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
        ]
        let used = Set(EodinEvent.allCases.map { $0.eventName })
        XCTAssertTrue(used.intersection(forbidden).isEmpty)
    }
}
