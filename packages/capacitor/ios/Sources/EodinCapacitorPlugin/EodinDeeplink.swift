import Foundation
#if canImport(UIKit)
import UIKit
#endif


/// Eodin Deferred Deep Link SDK for iOS
/// Enables apps to retrieve deferred deep link parameters after installation
public final class EodinDeeplink {

    // MARK: - Singleton

    /// Shared instance of the SDK
    public static let shared = EodinDeeplink()

    // MARK: - Configuration

    private var apiEndpoint: String?
    private var serviceId: String?
    private var isConfigured = false

    // MARK: - Private Init

    private init() {}

    // MARK: - Public Configuration

    /// Configure the SDK with API endpoint and service identifier
    /// - Parameters:
    ///   - apiEndpoint: The base URL of the Eodin API (e.g., "https://api.eodin.app/api/v1")
    ///   - service: The service identifier registered with Eodin (e.g., "shopping")
    public static func configure(apiEndpoint: String, service: String) {
        do {
            try EndpointValidator.validate(apiEndpoint)
        } catch {
            preconditionFailure("EodinDeeplink.configure: \(error.localizedDescription)")
        }
        shared.apiEndpoint = apiEndpoint.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        shared.serviceId = service
        shared.isConfigured = true

        #if DEBUG
        print("[EodinDeeplink] Configured with endpoint: \(apiEndpoint), service: \(service)")
        #endif
    }

    /// Check if SDK is properly configured
    public static var isReady: Bool {
        return shared.isConfigured
    }

    // MARK: - Deferred Parameters

    /// Result type for deferred parameters check
    public struct DeferredParamsResult {
        /// The deep link path to navigate to (e.g., "product/12345")
        public let path: String?

        /// The resource ID from the original link
        public let resourceId: String?

        /// Additional metadata if any
        public let metadata: [String: Any]?

        /// Whether parameters were found
        public var hasParams: Bool {
            return path != nil
        }
    }

    /// Error types for SDK operations
    public enum EodinError: Error, LocalizedError {
        case notConfigured
        case networkError(Error)
        case invalidResponse
        case noParamsFound
        case serverError(Int, String?)

        public var errorDescription: String? {
            switch self {
            case .notConfigured:
                return "EodinDeeplink SDK is not configured. Call EodinDeeplink.configure() first."
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            case .invalidResponse:
                return "Invalid response from server"
            case .noParamsFound:
                return "No deferred parameters found for this device"
            case .serverError(let code, let message):
                return "Server error (\(code)): \(message ?? "Unknown error")"
            }
        }
    }

    /// Check for deferred deep link parameters
    /// Call this method on app launch or when user completes onboarding
    /// - Parameter completion: Callback with Result containing DeferredParamsResult or EodinError
    public static func checkDeferredParams(completion: @escaping (Result<DeferredParamsResult, EodinError>) -> Void) {
        guard shared.isConfigured,
              let endpoint = shared.apiEndpoint,
              let _ = shared.serviceId else {
            completion(.failure(.notConfigured))
            return
        }

        // Generate device fingerprint
        let deviceId = DeviceFingerprint.generate()

        // Build URL
        guard let url = URL(string: "\(endpoint)/deferred-params?deviceId=\(deviceId)") else {
            completion(.failure(.invalidResponse))
            return
        }

        #if DEBUG
        print("[EodinDeeplink] Checking deferred params with deviceId: \(deviceId)")
        #endif

        // Make request
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 10

        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            // Handle network error
            if let error = error {
                DispatchQueue.main.async {
                    completion(.failure(.networkError(error)))
                }
                return
            }

            // Check HTTP response
            guard let httpResponse = response as? HTTPURLResponse else {
                DispatchQueue.main.async {
                    completion(.failure(.invalidResponse))
                }
                return
            }

            // Handle HTTP status codes
            switch httpResponse.statusCode {
            case 200:
                // Success - parse response
                guard let data = data else {
                    DispatchQueue.main.async {
                        completion(.failure(.invalidResponse))
                    }
                    return
                }

                do {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        let path = json["deeplinkPath"] as? String
                        let resourceId = json["resourceId"] as? String
                        let metadata = json["metadata"] as? [String: Any]

                        let result = DeferredParamsResult(
                            path: path,
                            resourceId: resourceId,
                            metadata: metadata
                        )

                        #if DEBUG
                        print("[EodinDeeplink] Found deferred params: path=\(path ?? "nil"), resourceId=\(resourceId ?? "nil")")
                        #endif

                        // Store attribution if available (fire-and-forget)
                        if let metadata = metadata, EodinAnalytics.isConfigured {
                            Self.storeAttributionAsync(metadata: metadata)
                        }

                        DispatchQueue.main.async {
                            completion(.success(result))
                        }
                    } else {
                        DispatchQueue.main.async {
                            completion(.failure(.invalidResponse))
                        }
                    }
                } catch {
                    DispatchQueue.main.async {
                        completion(.failure(.invalidResponse))
                    }
                }

            case 404:
                // No params found - this is normal for fresh installs without deferred link
                #if DEBUG
                print("[EodinDeeplink] No deferred params found (404)")
                #endif

                DispatchQueue.main.async {
                    completion(.failure(.noParamsFound))
                }

            default:
                // Server error
                var message: String?
                if let data = data,
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    message = json["message"] as? String
                }

                DispatchQueue.main.async {
                    completion(.failure(.serverError(httpResponse.statusCode, message)))
                }
            }
        }

        task.resume()
    }

    /// Async/await version of checkDeferredParams (iOS 13+)
    @available(iOS 13.0, macOS 10.15, *)
    public static func checkDeferredParams() async throws -> DeferredParamsResult {
        return try await withCheckedThrowingContinuation { continuation in
            checkDeferredParams { result in
                switch result {
                case .success(let params):
                    continuation.resume(returning: params)
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    // MARK: - Attribution Storage

    /// Store attribution asynchronously (fire-and-forget)
    /// This prevents analytics failures from affecting the deeplink flow
    private static func storeAttributionAsync(metadata: [String: Any]) {
        DispatchQueue.global(qos: .utility).async {
            guard let attribution = extractAttribution(from: metadata), attribution.hasData else {
                return
            }

            EodinAnalytics.setAttribution(attribution)

            #if DEBUG
            print("[EodinDeeplink] Stored attribution: \(attribution)")
            #endif
        }
    }

    /// Extract attribution from metadata
    private static func extractAttribution(from metadata: [String: Any]) -> Attribution? {
        // Check if there's any attribution data
        let hasAttribution = metadata["utmSource"] != nil ||
            metadata["utm_source"] != nil ||
            metadata["source"] != nil ||
            metadata["clickId"] != nil ||
            metadata["click_id"] != nil ||
            metadata["campaignId"] != nil ||
            metadata["campaign_id"] != nil

        guard hasAttribution else { return nil }

        return Attribution(
            source: metadata["source"] as? String,
            campaignId: (metadata["campaign_id"] as? String) ?? (metadata["campaignId"] as? String),
            adsetId: (metadata["adset_id"] as? String) ?? (metadata["adsetId"] as? String),
            adId: (metadata["ad_id"] as? String) ?? (metadata["adId"] as? String),
            clickId: (metadata["click_id"] as? String) ?? (metadata["clickId"] as? String),
            clickIdType: (metadata["click_id_type"] as? String) ?? (metadata["clickIdType"] as? String),
            utmSource: (metadata["utm_source"] as? String) ?? (metadata["utmSource"] as? String),
            utmMedium: (metadata["utm_medium"] as? String) ?? (metadata["utmMedium"] as? String),
            utmCampaign: (metadata["utm_campaign"] as? String) ?? (metadata["utmCampaign"] as? String),
            utmContent: (metadata["utm_content"] as? String) ?? (metadata["utmContent"] as? String),
            utmTerm: (metadata["utm_term"] as? String) ?? (metadata["utmTerm"] as? String)
        )
    }
}
