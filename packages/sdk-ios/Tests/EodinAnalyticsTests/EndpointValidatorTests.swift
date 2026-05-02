import XCTest
@testable import EodinAnalytics

final class EndpointValidatorTests: XCTestCase {
    // MARK: - Accepted

    func testHttpsPasses() throws {
        XCTAssertNoThrow(try EndpointValidator.validate("https://api.eodin.app/api/v1"))
        XCTAssertNoThrow(try EndpointValidator.validate("https://api-staging.eodin.app/api/v1"))
        XCTAssertNoThrow(try EndpointValidator.validate("https://api.eodin.app:443/api/v1"))
    }

    func testHttpLoopbackPasses() throws {
        XCTAssertNoThrow(try EndpointValidator.validate("http://localhost:3005/api/v1"))
        XCTAssertNoThrow(try EndpointValidator.validate("http://127.0.0.1:3005/api/v1"))
    }

    func test10_0_2_2InDebugBuild() throws {
        // XCTest runs in DEBUG configuration → 10.0.2.2 should pass.
        XCTAssertNoThrow(try EndpointValidator.validate("http://10.0.2.2:3005/api/v1"))
    }

    func testCaseInsensitiveScheme() throws {
        XCTAssertNoThrow(try EndpointValidator.validate("HTTPS://api.eodin.app/api/v1"))
        XCTAssertNoThrow(try EndpointValidator.validate("Http://localhost:3005/api/v1"))
    }

    func testWhitespaceTrimmed() throws {
        XCTAssertNoThrow(try EndpointValidator.validate("  https://api.eodin.app/api/v1  "))
    }

    // MARK: - Rejected

    func testPlainHttpNonLoopbackThrows() {
        XCTAssertThrowsError(try EndpointValidator.validate("http://api.eodin.app/api/v1")) { error in
            XCTAssertEqual(error as? EndpointValidationError, .insecureScheme("http://api.eodin.app/api/v1"))
        }
        XCTAssertThrowsError(try EndpointValidator.validate("http://attacker.example.com/collect"))
    }

    func testEmptyThrows() {
        XCTAssertThrowsError(try EndpointValidator.validate(""))
        XCTAssertThrowsError(try EndpointValidator.validate("   "))
    }

    func testNonUrlThrows() {
        XCTAssertThrowsError(try EndpointValidator.validate("not-a-url"))
        XCTAssertThrowsError(try EndpointValidator.validate("https://"))
    }

    func testUnsupportedSchemeThrows() {
        XCTAssertThrowsError(try EndpointValidator.validate("ftp://api.eodin.app"))
        XCTAssertThrowsError(try EndpointValidator.validate("ws://api.eodin.app"))
        XCTAssertThrowsError(try EndpointValidator.validate("file:///etc/passwd"))
    }

    func testConfusableHostStillPasses() throws {
        // 현재 동작 — host 화이트리스트는 v2.x 보류 (open-issues §4.6)
        XCTAssertNoThrow(try EndpointValidator.validate("https://api.eodin.app.attacker.com"))
    }
}
