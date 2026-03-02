import Foundation
#if canImport(Network)
import Network
#endif

/// Manages event queuing with offline support.
///
/// Features:
/// - Stores events locally when offline
/// - Automatically sends events when network is restored
/// - Batches events for efficient transmission
/// - Implements exponential backoff on failure
/// - Persists events across app restarts
public final class EventQueue {

    // MARK: - Singleton

    /// Shared instance
    public static let shared = EventQueue()

    private init() {}

    // MARK: - Configuration

    private var apiEndpoint: String?
    private var apiKey: String?
    private var isDebug = false

    // MARK: - Constants

    private let maxQueueSize = 1000
    private let maxBatchSize = 50
    private let flushThreshold = 20
    private let flushInterval: TimeInterval = 30
    private let maxEventAge: TimeInterval = 7 * 24 * 60 * 60 // 7 days
    private let maxRetries = 5

    // MARK: - State

    private var memoryQueue: [AnalyticsEvent] = []
    private var isInitialized = false
    private var isFlushing = false
    private var retryCount = 0
    private var flushTimer: Timer?

    // MARK: - Storage

    private let storageKey = "eodin_event_queue"
    private let queue = DispatchQueue(label: "app.eodin.eventqueue", qos: .utility)

    // MARK: - Network Monitoring

    #if canImport(Network)
    private var pathMonitor: NWPathMonitor?
    #endif
    private(set) var isOnline = true

    // MARK: - Public Methods

    /// Initialize the event queue
    public func initialize(
        apiEndpoint: String,
        apiKey: String,
        debug: Bool = false
    ) {
        guard !isInitialized else { return }

        self.apiEndpoint = apiEndpoint
        self.apiKey = apiKey
        self.isDebug = debug

        // Load persisted events
        loadPersistedEvents()

        // Start network monitoring
        startNetworkMonitoring()

        // Start flush timer
        startFlushTimer()

        isInitialized = true
        log("EventQueue initialized with \(memoryQueue.count) persisted events")
    }

    /// Add an event to the queue
    public func enqueue(_ event: AnalyticsEvent) {
        queue.async { [weak self] in
            guard let self = self, self.isInitialized else { return }

            // Check queue size limit
            if self.memoryQueue.count >= self.maxQueueSize {
                let removeCount = self.memoryQueue.count - self.maxQueueSize + 1
                self.memoryQueue.removeFirst(removeCount)
                self.log("Queue overflow, removed \(removeCount) old events")
            }

            self.memoryQueue.append(event)
            self.log("Enqueued event: \(event.eventName) (queue size: \(self.memoryQueue.count))")

            // Persist to storage
            self.persistEvents()

            // Check if we should flush
            if self.isOnline && self.memoryQueue.count >= self.flushThreshold {
                self.performFlush()
            }
        }
    }

    /// Flush pending events to the server
    public func flush() {
        queue.async { [weak self] in
            self?.performFlush()
        }
    }

    /// Current queue size
    public var queueSize: Int {
        return memoryQueue.count
    }

    /// Dispose resources
    public func dispose() {
        flushTimer?.invalidate()
        flushTimer = nil

        #if canImport(Network)
        pathMonitor?.cancel()
        pathMonitor = nil
        #endif

        isInitialized = false
        log("EventQueue disposed")
    }

    // MARK: - Private Methods

    private func performFlush() {
        guard isInitialized, !isFlushing, !memoryQueue.isEmpty else { return }
        guard isOnline else {
            log("Offline, skipping flush")
            return
        }

        isFlushing = true

        // Take up to maxBatchSize events
        let eventsToSend = Array(memoryQueue.prefix(maxBatchSize))

        log("Flushing \(eventsToSend.count) events")

        sendEvents(eventsToSend) { [weak self] success in
            guard let self = self else { return }

            self.queue.async {
                if success {
                    // Remove sent events
                    self.memoryQueue.removeFirst(min(eventsToSend.count, self.memoryQueue.count))
                    self.persistEvents()
                    self.retryCount = 0
                    self.log("Flush successful")

                    // Continue flushing if more events
                    self.isFlushing = false
                    if !self.memoryQueue.isEmpty {
                        self.performFlush()
                    }
                } else {
                    self.retryCount += 1
                    self.log("Flush failed, retry count: \(self.retryCount)")

                    self.isFlushing = false

                    // Schedule retry with exponential backoff
                    if self.retryCount <= self.maxRetries {
                        let delay = self.calculateBackoff(self.retryCount)
                        self.log("Scheduling retry in \(Int(delay))s")

                        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                            self?.flush()
                        }
                    }
                }
            }
        }
    }

    private func sendEvents(_ events: [AnalyticsEvent], completion: @escaping (Bool) -> Void) {
        guard let endpoint = apiEndpoint, let apiKey = apiKey else {
            completion(false)
            return
        }

        guard let url = URL(string: "\(endpoint)/events/collect") else {
            completion(false)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        request.timeoutInterval = 30

        do {
            let body = ["events": events]
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            log("Failed to encode events: \(error)")
            completion(false)
            return
        }

        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                self?.log("Send error: \(error)")
                completion(false)
                return
            }

            guard let httpResponse = response as? HTTPURLResponse else {
                completion(false)
                return
            }

            if httpResponse.statusCode == 200 {
                if let data = data,
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    self?.log("Send successful: received=\(json["received"] ?? "?"), duplicates=\(json["duplicates"] ?? "?")")
                }
                completion(true)
            } else {
                self?.log("Send failed: \(httpResponse.statusCode)")
                completion(false)
            }
        }

        task.resume()
    }

    private func persistEvents() {
        do {
            let eventsData = try JSONEncoder().encode(memoryQueue)
            UserDefaults.standard.set(eventsData, forKey: storageKey)
        } catch {
            log("Failed to persist events: \(error)")
        }
    }

    private func loadPersistedEvents() {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else { return }

        do {
            var events = try JSONDecoder().decode([AnalyticsEvent].self, from: data)

            // Remove expired events
            let now = Date()
            events = events.filter { now.timeIntervalSince($0.timestamp) < maxEventAge }

            memoryQueue = events
            log("Loaded \(events.count) persisted events")
        } catch {
            log("Failed to load persisted events: \(error)")
            UserDefaults.standard.removeObject(forKey: storageKey)
        }
    }

    private func startNetworkMonitoring() {
        #if canImport(Network)
        if #available(iOS 12.0, *) {
            pathMonitor = NWPathMonitor()
            pathMonitor?.pathUpdateHandler = { [weak self] path in
                let wasOffline = !(self?.isOnline ?? true)
                self?.isOnline = path.status == .satisfied

                self?.log("Network status changed: \(self?.isOnline == true ? "online" : "offline")")

                // If we just came online, flush events
                if wasOffline && self?.isOnline == true && !(self?.memoryQueue.isEmpty ?? true) {
                    self?.log("Network restored, flushing events")
                    self?.flush()
                }
            }
            pathMonitor?.start(queue: queue)
        }
        #endif
    }

    private func startFlushTimer() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.flushTimer?.invalidate()
            self.flushTimer = Timer.scheduledTimer(withTimeInterval: self.flushInterval, repeats: true) { [weak self] _ in
                guard let self = self else { return }
                if self.isOnline && !self.memoryQueue.isEmpty {
                    self.flush()
                }
            }
        }
    }

    private func calculateBackoff(_ retryCount: Int) -> TimeInterval {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 60s)
        return min(pow(2.0, Double(retryCount)), 60.0)
    }

    private func log(_ message: String) {
        #if DEBUG
        if isDebug {
            print("[EodinEventQueue] \(message)")
        }
        #endif
    }

    // MARK: - Testing Support

    @available(*, deprecated, message: "For testing only")
    public func reset() {
        flushTimer?.invalidate()
        flushTimer = nil

        #if canImport(Network)
        pathMonitor?.cancel()
        pathMonitor = nil
        #endif

        memoryQueue.removeAll()
        UserDefaults.standard.removeObject(forKey: storageKey)
        isInitialized = false
        isFlushing = false
        retryCount = 0
    }
}
