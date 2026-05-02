import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Eodin Analytics SDK for iOS
/// Tracks analytics events and sends them to the Eodin backend
public final class EodinAnalytics {

    // MARK: - Singleton

    /// Shared instance of the SDK
    public static let shared = EodinAnalytics()

    // MARK: - Configuration

    private var apiEndpoint: String?
    private var apiKey: String?
    private var appId: String?
    private var isDebug = false
    private var offlineMode = true

    // MARK: - State

    private var deviceId: String?
    private var userId: String?
    private var sessionId: String?
    private var sessionStartTime: Date?
    private var attribution: Attribution?
    private var deviceInfo: DeviceInfo?

    // MARK: - Queue

    private let queue = DispatchQueue(label: "app.eodin.analytics", qos: .utility)

    // MARK: - Storage Keys

    private let deviceIdKey = "eodin_device_id"
    private let userIdKey = "eodin_user_id"
    private let attributionKey = "eodin_attribution"
    private let sessionIdKey = "eodin_session_id"
    private let sessionStartKey = "eodin_session_start"

    // MARK: - Private Init

    private init() {}

    // MARK: - Public Configuration

    /// Configure the Analytics SDK
    /// - Parameters:
    ///   - apiEndpoint: The base URL of the Eodin API
    ///   - apiKey: Your API key for the service
    ///   - appId: Your app ID (e.g., "fridgify", "arden")
    ///   - debug: Enable debug logging
    ///   - offlineMode: Enable offline event storage (default: true)
    public static func configure(
        apiEndpoint: String,
        apiKey: String,
        appId: String,
        debug: Bool = false,
        offlineMode: Bool = true
    ) {
        shared.apiEndpoint = apiEndpoint.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        shared.apiKey = apiKey
        shared.appId = appId
        shared.isDebug = debug
        shared.offlineMode = offlineMode

        // Initialize
        shared.initDeviceId()
        shared.loadUserId()
        shared.loadAttribution()
        shared.initSession()
        shared.initDeviceInfo()

        // Initialize EventQueue for offline support
        if offlineMode {
            EventQueue.shared.initialize(
                apiEndpoint: shared.apiEndpoint!,
                apiKey: apiKey,
                debug: debug
            )
        }

        shared.log("Configured with endpoint: \(apiEndpoint), appId: \(appId), offlineMode: \(offlineMode)")
    }

    /// Check if SDK is properly configured
    public static var isConfigured: Bool {
        return shared.apiEndpoint != nil && shared.apiKey != nil && shared.appId != nil
    }

    /// Current device ID
    public static var deviceId: String? {
        return shared.deviceId
    }

    /// Current user ID
    public static var userId: String? {
        return shared.userId
    }

    /// Current session ID
    public static var sessionId: String? {
        return shared.sessionId
    }

    /// Current attribution
    public static var attribution: Attribution? {
        return shared.attribution
    }

    // MARK: - Public Methods

    /// Track an analytics event using the recommended `EodinEvent` enum.
    ///
    /// Equivalent to the string-based `track(_:properties:)` but provides
    /// compile-time autocomplete and aligns with the unified event reference.
    /// For app-specific domain events not in the enum, use the string variant.
    ///
    /// - Parameters:
    ///   - event: The recommended event
    ///   - properties: Optional custom properties
    public static func track(_ event: EodinEvent, properties: [String: Any]? = nil) {
        track(event.rawValue, properties: properties)
    }

    /// Track an analytics event
    /// - Parameters:
    ///   - eventName: The name of the event
    ///   - properties: Optional custom properties
    public static func track(_ eventName: String, properties: [String: Any]? = nil) {
        guard isConfigured,
              let appId = shared.appId,
              let deviceId = shared.deviceId else {
            shared.log("SDK not configured. Call configure() first.", isError: true)
            return
        }

        let event = AnalyticsEvent(
            eventName: eventName,
            appId: appId,
            deviceId: deviceId,
            userId: shared.userId,
            sessionId: shared.sessionId,
            attribution: shared.attribution,
            device: shared.deviceInfo,
            properties: properties
        )

        // Use EventQueue for offline support
        if shared.offlineMode {
            EventQueue.shared.enqueue(event)
            shared.log("Enqueued event: \(eventName) (offline mode)")
        } else {
            // Legacy direct send
            shared.sendEventDirect(event)
        }
    }

    /// Send event directly without queue (legacy mode)
    private func sendEventDirect(_ event: AnalyticsEvent) {
        guard let endpoint = apiEndpoint, let apiKey = apiKey else { return }
        guard let url = URL(string: "\(endpoint)/events/collect") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")

        do {
            let body = ["events": [event]]
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            log("Failed to encode event: \(error)", isError: true)
            return
        }

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                self?.log("Event send error: \(error)", isError: true)
                return
            }

            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                self?.log("Event sent: \(event.eventName)")
            } else {
                self?.log("Event send failed", isError: true)
            }
        }.resume()
    }

    /// Identify a user
    /// - Parameter userId: The unique user identifier
    public static func identify(_ userId: String) {
        shared.userId = userId
        UserDefaults.standard.set(userId, forKey: shared.userIdKey)
        shared.log("Identified user: \(userId)")
    }

    /// Clear user identification
    public static func clearIdentity() {
        shared.userId = nil
        UserDefaults.standard.removeObject(forKey: shared.userIdKey)
        shared.log("Cleared user identity")
    }

    /// Set attribution data
    /// - Parameter attribution: The attribution data
    public static func setAttribution(_ attribution: Attribution) {
        shared.attribution = attribution

        if let data = try? JSONEncoder().encode(attribution) {
            UserDefaults.standard.set(data, forKey: shared.attributionKey)
        }

        shared.log("Set attribution: \(attribution)")
    }

    /// Flush pending events to the server
    public static func flush() {
        if shared.offlineMode {
            EventQueue.shared.flush()
        }
    }

    /// Whether currently online (only available in offline mode)
    public static var isOnline: Bool {
        return shared.offlineMode ? EventQueue.shared.isOnline : true
    }

    /// Current queue size (only available in offline mode)
    public static var queueSize: Int {
        return shared.offlineMode ? EventQueue.shared.queueSize : 0
    }

    /// Start a new session
    public static func startSession() {
        shared.sessionId = UUID().uuidString
        shared.sessionStartTime = Date()

        UserDefaults.standard.set(shared.sessionId, forKey: shared.sessionIdKey)
        UserDefaults.standard.set(shared.sessionStartTime?.timeIntervalSince1970, forKey: shared.sessionStartKey)

        shared.log("Started new session: \(shared.sessionId ?? "nil")")

        track("session_start")
    }

    /// End the current session
    public static func endSession() {
        if shared.sessionId != nil {
            track("session_end")
            shared.log("Ended session: \(shared.sessionId ?? "nil")")
        }

        UserDefaults.standard.removeObject(forKey: shared.sessionIdKey)
        UserDefaults.standard.removeObject(forKey: shared.sessionStartKey)
        shared.sessionId = nil
        shared.sessionStartTime = nil
    }

    // MARK: - Private Methods

    private func initDeviceId() {
        if let storedId = UserDefaults.standard.string(forKey: deviceIdKey) {
            deviceId = storedId
        } else {
            deviceId = UUID().uuidString
            UserDefaults.standard.set(deviceId, forKey: deviceIdKey)
        }
        log("Device ID: \(deviceId ?? "nil")")
    }

    private func loadUserId() {
        userId = UserDefaults.standard.string(forKey: userIdKey)
        if let userId = userId {
            log("Loaded user ID: \(userId)")
        }
    }

    private func loadAttribution() {
        if let data = UserDefaults.standard.data(forKey: attributionKey),
           let stored = try? JSONDecoder().decode(Attribution.self, from: data) {
            attribution = stored
            log("Loaded attribution: \(stored)")
        }
    }

    private func initSession() {
        let storedSessionId = UserDefaults.standard.string(forKey: sessionIdKey)
        let sessionStart = UserDefaults.standard.double(forKey: sessionStartKey)

        if let storedId = storedSessionId, sessionStart > 0 {
            let startDate = Date(timeIntervalSince1970: sessionStart)
            let elapsed = Date().timeIntervalSince(startDate)

            // Session valid for 30 minutes
            if elapsed < 30 * 60 {
                sessionId = storedId
                sessionStartTime = startDate
                log("Resumed session: \(sessionId ?? "nil")")
                return
            }
        }

        // Start new session
        EodinAnalytics.startSession()
    }

    private func initDeviceInfo() {
        #if os(iOS)
        // Use ATTManager to get device info with ATT status and IDFA
        deviceInfo = ATTManager.shared.getDeviceInfo()
        #elseif os(macOS)
        deviceInfo = DeviceInfo(
            os: "macos",
            osVersion: ProcessInfo.processInfo.operatingSystemVersionString,
            model: "Mac",
            locale: Locale.current.identifier
        )
        #endif

        log("Device info: \(String(describing: deviceInfo))")
    }

    /// Refresh device info (call after ATT status changes)
    public static func refreshDeviceInfo() {
        #if os(iOS)
        shared.deviceInfo = ATTManager.shared.getDeviceInfo()
        shared.log("Refreshed device info: \(String(describing: shared.deviceInfo))")
        #endif
    }

    /// Request ATT authorization and update device info
    /// - Parameter completion: Callback with the ATT status
    public static func requestTrackingAuthorization(completion: @escaping (ATTStatus) -> Void) {
        #if os(iOS)
        ATTManager.shared.requestAuthorization { status in
            // Refresh device info to capture IDFA if authorized
            refreshDeviceInfo()
            completion(status)
        }
        #else
        completion(.unknown)
        #endif
    }

    /// Request ATT authorization (async version)
    @available(iOS 13.0, *)
    public static func requestTrackingAuthorization() async -> ATTStatus {
        await withCheckedContinuation { continuation in
            requestTrackingAuthorization { status in
                continuation.resume(returning: status)
            }
        }
    }

    /// Current ATT status
    public static var attStatus: ATTStatus {
        #if os(iOS)
        return ATTManager.shared.status
        #else
        return .unknown
        #endif
    }

    /// Current IDFA (nil if not authorized)
    public static var idfa: String? {
        #if os(iOS)
        return ATTManager.shared.idfa
        #else
        return nil
        #endif
    }

    private func log(_ message: String, isError: Bool = false) {
        #if DEBUG
        if isError {
            print("[EodinAnalytics ERROR] \(message)")
        } else if isDebug {
            print("[EodinAnalytics] \(message)")
        }
        #endif
    }

    // MARK: - Testing Support

    /// Reset SDK state (for testing purposes)
    @available(*, deprecated, message: "For testing only")
    public static func reset() {
        shared.apiEndpoint = nil
        shared.apiKey = nil
        shared.appId = nil
        shared.deviceId = nil
        shared.userId = nil
        shared.sessionId = nil
        shared.attribution = nil
        shared.deviceInfo = nil
        shared.offlineMode = true

        // Reset EventQueue
        EventQueue.shared.reset()
    }
}
