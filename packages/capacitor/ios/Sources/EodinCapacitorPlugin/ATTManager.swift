import Foundation
#if canImport(AppTrackingTransparency)
import AppTrackingTransparency
#endif
#if canImport(AdSupport)
import AdSupport
#endif

/// ATT (App Tracking Transparency) status values
public enum ATTStatus: String, Codable {
    case notDetermined = "not_determined"
    case restricted = "restricted"
    case denied = "denied"
    case authorized = "authorized"
    case unknown = "unknown"
}

/// Manager for App Tracking Transparency (ATT) on iOS 14.5+
public final class ATTManager {

    // MARK: - Singleton

    /// Shared instance
    public static let shared = ATTManager()

    private init() {}

    // MARK: - Properties

    /// Current ATT status
    public var status: ATTStatus {
        #if canImport(AppTrackingTransparency)
        if #available(iOS 14, *) {
            switch ATTrackingManager.trackingAuthorizationStatus {
            case .notDetermined:
                return .notDetermined
            case .restricted:
                return .restricted
            case .denied:
                return .denied
            case .authorized:
                return .authorized
            @unknown default:
                return .unknown
            }
        }
        #endif
        return .unknown
    }

    /// Whether tracking is authorized
    public var isAuthorized: Bool {
        return status == .authorized
    }

    /// IDFA (only available when authorized)
    public var idfa: String? {
        guard isAuthorized else { return nil }

        #if canImport(AdSupport)
        let idfa = ASIdentifierManager.shared().advertisingIdentifier.uuidString
        // Check if IDFA is valid (not all zeros)
        if idfa != "00000000-0000-0000-0000-000000000000" {
            return idfa
        }
        #endif

        return nil
    }

    // MARK: - Request Authorization

    /// Request tracking authorization from the user.
    /// - Parameter completion: Callback with the resulting status
    /// - Note: Must be called on the main thread. The ATT prompt will be shown to the user.
    public func requestAuthorization(completion: @escaping (ATTStatus) -> Void) {
        #if canImport(AppTrackingTransparency)
        if #available(iOS 14, *) {
            // Track that we're showing the prompt
            EodinAnalytics.track("att_prompt")

            ATTrackingManager.requestTrackingAuthorization { authStatus in
                let status: ATTStatus
                switch authStatus {
                case .notDetermined:
                    status = .notDetermined
                case .restricted:
                    status = .restricted
                case .denied:
                    status = .denied
                case .authorized:
                    status = .authorized
                @unknown default:
                    status = .unknown
                }

                // Track the user's response
                EodinAnalytics.track("att_response", properties: [
                    "status": status.rawValue
                ])

                DispatchQueue.main.async {
                    completion(status)
                }
            }
            return
        }
        #endif

        // iOS < 14 or ATT not available - tracking is authorized by default
        completion(.authorized)
    }

    /// Request tracking authorization (async version)
    @available(iOS 13.0, *)
    public func requestAuthorization() async -> ATTStatus {
        await withCheckedContinuation { continuation in
            requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
    }

    // MARK: - Device Info Helper

    /// Get DeviceInfo with current ATT status and IDFA (if authorized)
    public func getDeviceInfo() -> DeviceInfo {
        #if os(iOS)
        if #available(iOS 14, *) {
            return DeviceInfo(
                os: "ios",
                osVersion: UIDevice.current.systemVersion,
                model: UIDevice.current.model,
                locale: Locale.current.identifier,
                attStatus: status.rawValue,
                idfa: idfa
            )
        } else {
            return DeviceInfo(
                os: "ios",
                osVersion: UIDevice.current.systemVersion,
                model: UIDevice.current.model,
                locale: Locale.current.identifier,
                attStatus: nil,
                idfa: idfa // Can still get IDFA on older iOS
            )
        }
        #else
        return DeviceInfo(
            os: "ios",
            osVersion: ProcessInfo.processInfo.operatingSystemVersionString,
            model: "Unknown",
            locale: Locale.current.identifier
        )
        #endif
    }
}

#if os(iOS)
import UIKit
#endif
