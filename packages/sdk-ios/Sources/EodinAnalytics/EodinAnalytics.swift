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

    // MARK: - State

    private var deviceId: String?
    private var userId: String?
    private var sessionId: String?
    private var sessionStartTime: Date?
    private var attribution: Attribution?
    private var deviceInfo: DeviceInfo?

    // MARK: - Event Queue

    private var eventQueue: [AnalyticsEvent] = []
    private let maxBatchSize = 20
    private let flushInterval: TimeInterval = 30
    private var lastFlushTime: Date?
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
    public static func configure(
        apiEndpoint: String,
        apiKey: String,
        appId: String,
        debug: Bool = false
    ) {
        shared.apiEndpoint = apiEndpoint.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        shared.apiKey = apiKey
        shared.appId = appId
        shared.isDebug = debug

        // Initialize
        shared.initDeviceId()
        shared.loadUserId()
        shared.loadAttribution()
        shared.initSession()
        shared.initDeviceInfo()

        shared.log("Configured with endpoint: \(apiEndpoint), appId: \(appId)")
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

        shared.queue.async {
            shared.eventQueue.append(event)
            shared.log("Queued event: \(eventName) (queue size: \(shared.eventQueue.count))")

            if shared.shouldFlush() {
                shared.performFlush()
            }
        }
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
        shared.queue.async {
            shared.performFlush()
        }
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

    private func shouldFlush() -> Bool {
        if eventQueue.count >= maxBatchSize {
            return true
        }

        if let lastFlush = lastFlushTime {
            let elapsed = Date().timeIntervalSince(lastFlush)
            if elapsed >= flushInterval && !eventQueue.isEmpty {
                return true
            }
        }

        return false
    }

    private func performFlush() {
        guard !eventQueue.isEmpty else {
            log("No events to flush")
            return
        }

        guard let endpoint = apiEndpoint,
              let apiKey = apiKey else {
            log("SDK not configured. Cannot flush.", isError: true)
            return
        }

        let eventsToSend = Array(eventQueue.prefix(maxBatchSize))
        eventQueue.removeFirst(min(maxBatchSize, eventQueue.count))

        log("Flushing \(eventsToSend.count) events")

        // Build request
        guard let url = URL(string: "\(endpoint)/events/collect") else {
            log("Invalid URL", isError: true)
            eventQueue.insert(contentsOf: eventsToSend, at: 0)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")

        do {
            let body = ["events": eventsToSend]
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            log("Failed to encode events: \(error)", isError: true)
            eventQueue.insert(contentsOf: eventsToSend, at: 0)
            return
        }

        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }

            if let error = error {
                self.log("Flush error: \(error)", isError: true)
                self.queue.async {
                    self.eventQueue.insert(contentsOf: eventsToSend, at: 0)
                }
                return
            }

            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 200 {
                    if let data = data,
                       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        self.log("Flush successful: received=\(json["received"] ?? "?"), duplicates=\(json["duplicates"] ?? "?")")
                    }
                } else {
                    self.log("Flush failed: \(httpResponse.statusCode)", isError: true)
                    self.queue.async {
                        self.eventQueue.insert(contentsOf: eventsToSend, at: 0)
                    }
                }
            }

            self.lastFlushTime = Date()
        }

        task.resume()
    }

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
        let device = UIDevice.current
        deviceInfo = DeviceInfo(
            os: "ios",
            osVersion: device.systemVersion,
            model: device.model,
            locale: Locale.current.identifier
        )
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
        shared.eventQueue.removeAll()
        shared.lastFlushTime = nil
    }
}
