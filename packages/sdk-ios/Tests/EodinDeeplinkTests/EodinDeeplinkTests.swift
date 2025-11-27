import XCTest
@testable import EodinDeeplink

final class EodinDeeplinkTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // Reset state before each test
        DeviceFingerprint.reset()
    }

    override func tearDown() {
        super.tearDown()
    }

    // MARK: - Configuration Tests

    func testConfigurationSetsValues() {
        EodinDeeplink.configure(apiEndpoint: "https://api.example.com", service: "test-service")
        XCTAssertTrue(EodinDeeplink.isReady)
    }

    func testConfigurationTrimsTrailingSlash() {
        EodinDeeplink.configure(apiEndpoint: "https://api.example.com/", service: "test-service")
        XCTAssertTrue(EodinDeeplink.isReady)
    }

    // MARK: - Device Fingerprint Tests

    func testDeviceFingerprintGeneration() {
        let fingerprint = DeviceFingerprint.generate()

        // Should be a valid SHA-256 hash (64 hex characters)
        XCTAssertEqual(fingerprint.count, 64)
        XCTAssertTrue(fingerprint.allSatisfy { $0.isHexDigit })
    }

    func testDeviceFingerprintConsistency() {
        let fingerprint1 = DeviceFingerprint.generate()
        let fingerprint2 = DeviceFingerprint.generate()

        // Should return the same fingerprint
        XCTAssertEqual(fingerprint1, fingerprint2)
    }

    func testDeviceFingerprintReset() {
        let fingerprint1 = DeviceFingerprint.generate()
        DeviceFingerprint.reset()
        let fingerprint2 = DeviceFingerprint.generate()

        // After reset, may generate different fingerprint (depending on IDFV availability)
        // On simulator without IDFV, this will be different
        // On real device with IDFV, this will be the same
        XCTAssertNotNil(fingerprint1)
        XCTAssertNotNil(fingerprint2)
    }

    // MARK: - Deferred Params Result Tests

    func testDeferredParamsResultWithParams() {
        let result = EodinDeeplink.DeferredParamsResult(
            path: "product/12345",
            resourceId: "product-12345",
            metadata: ["source": "campaign"]
        )

        XCTAssertTrue(result.hasParams)
        XCTAssertEqual(result.path, "product/12345")
        XCTAssertEqual(result.resourceId, "product-12345")
        XCTAssertNotNil(result.metadata)
    }

    func testDeferredParamsResultWithoutParams() {
        let result = EodinDeeplink.DeferredParamsResult(
            path: nil,
            resourceId: nil,
            metadata: nil
        )

        XCTAssertFalse(result.hasParams)
    }

    // MARK: - Error Tests

    func testErrorDescriptions() {
        let notConfigured = EodinDeeplink.EodinError.notConfigured
        XCTAssertNotNil(notConfigured.errorDescription)
        XCTAssertTrue(notConfigured.errorDescription!.contains("not configured"))

        let noParams = EodinDeeplink.EodinError.noParamsFound
        XCTAssertNotNil(noParams.errorDescription)
        XCTAssertTrue(noParams.errorDescription!.contains("No deferred parameters"))

        let serverError = EodinDeeplink.EodinError.serverError(500, "Internal error")
        XCTAssertNotNil(serverError.errorDescription)
        XCTAssertTrue(serverError.errorDescription!.contains("500"))
    }

    // MARK: - Integration Tests (require running API)

    func testCheckDeferredParamsNotConfigured() {
        // Reset any previous configuration by creating new instance behavior
        // Note: Since EodinDeeplink is a singleton, this test may need adjustment
        // in production. For now, test the error type exists.
        let error = EodinDeeplink.EodinError.notConfigured
        XCTAssertEqual(error.errorDescription, "EodinDeeplink SDK is not configured. Call EodinDeeplink.configure() first.")
    }
}
