import Foundation
import CommonCrypto
#if canImport(UIKit)
import UIKit
#endif

/// Device fingerprinting utility for generating consistent device identifiers
/// Uses IDFV (Identifier for Vendor) on iOS, combined with system info for fallback
internal struct DeviceFingerprint {

    // MARK: - Storage Keys

    private static let storedFingerprintKey = "com.eodin.deviceFingerprint"

    // MARK: - Generate Fingerprint

    /// Generate a consistent device fingerprint
    /// Uses IDFV if available, falls back to a generated hash stored in UserDefaults
    /// - Returns: A SHA-256 hash string representing the device
    static func generate() -> String {
        // First, check if we have a stored fingerprint
        if let stored = UserDefaults.standard.string(forKey: storedFingerprintKey) {
            return stored
        }

        // Generate new fingerprint
        let fingerprint = createFingerprint()

        // Store for consistency
        UserDefaults.standard.set(fingerprint, forKey: storedFingerprintKey)

        return fingerprint
    }

    /// Create a new fingerprint from device characteristics
    private static func createFingerprint() -> String {
        var components: [String] = []

        // 1. IDFV (Identifier for Vendor) - most reliable on iOS
        #if canImport(UIKit) && !os(watchOS)
        if let idfv = UIDevice.current.identifierForVendor?.uuidString {
            components.append("idfv:\(idfv)")
        }
        #endif

        // 2. System info fallback
        var systemInfo = utsname()
        uname(&systemInfo)

        // Device model
        let modelData = Data(bytes: &systemInfo.machine, count: Int(_SYS_NAMELEN))
        if let model = String(bytes: modelData, encoding: .utf8)?.trimmingCharacters(in: .controlCharacters) {
            components.append("model:\(model)")
        }

        // System name and version
        #if canImport(UIKit) && !os(watchOS)
        components.append("system:\(UIDevice.current.systemName)")
        components.append("version:\(UIDevice.current.systemVersion)")
        #else
        let processInfo = ProcessInfo.processInfo
        components.append("system:macOS")
        components.append("version:\(processInfo.operatingSystemVersionString)")
        #endif

        // 3. Locale info
        components.append("locale:\(Locale.current.identifier)")
        components.append("timezone:\(TimeZone.current.identifier)")

        // 4. Screen size (if available)
        #if canImport(UIKit) && !os(watchOS)
        let screen = UIScreen.main.bounds
        components.append("screen:\(Int(screen.width))x\(Int(screen.height))")
        #endif

        // 5. Random UUID for uniqueness if IDFV is not available
        if components.first(where: { $0.hasPrefix("idfv:") }) == nil {
            // Generate and store a random UUID as fallback
            let fallbackId = UUID().uuidString
            components.append("fallback:\(fallbackId)")
        }

        // Combine and hash
        let combined = components.joined(separator: "|")
        return sha256Hash(combined)
    }

    /// Generate SHA-256 hash of input string
    private static func sha256Hash(_ input: String) -> String {
        guard let data = input.data(using: .utf8) else {
            return UUID().uuidString // Fallback
        }

        var hash = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes {
            _ = CC_SHA256($0.baseAddress, CC_LONG(data.count), &hash)
        }

        return hash.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Reset (for testing)

    /// Reset the stored fingerprint (useful for testing)
    static func reset() {
        UserDefaults.standard.removeObject(forKey: storedFingerprintKey)
    }
}
