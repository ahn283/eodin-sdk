package app.eodin.analytics

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import app.eodin.analytics.models.AnalyticsEvent
import app.eodin.analytics.models.Attribution
import app.eodin.analytics.models.DeviceInfo
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Eodin Analytics SDK for Android.
 *
 * Tracks analytics events and sends them to the Eodin backend.
 *
 * Usage:
 * ```kotlin
 * // Configure in Application.onCreate()
 * EodinAnalytics.configure(
 *     context = this,
 *     apiEndpoint = "https://link.eodin.app/api/v1",
 *     apiKey = "your-api-key",
 *     appId = "your-app-id"
 * )
 *
 * // Track events
 * EodinAnalytics.track("button_clicked", mapOf("button_name" to "subscribe"))
 *
 * // Identify user
 * EodinAnalytics.identify("user-123")
 * ```
 */
object EodinAnalytics {

    // Configuration
    private var apiEndpoint: String? = null
    private var apiKey: String? = null
    private var appId: String? = null
    private var applicationContext: Context? = null
    private var isDebug = false
    private var offlineMode = true

    // State
    private var deviceId: String? = null
    private var userId: String? = null
    private var sessionId: String? = null
    private var sessionStartTime: Long = 0
    private var attribution: Attribution? = null
    private var deviceInfo: DeviceInfo? = null

    // Event queue
    private val eventQueue = CopyOnWriteArrayList<AnalyticsEvent>()
    private var networkClient: NetworkClient? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    // Constants
    private const val MAX_BATCH_SIZE = 20
    private const val FLUSH_INTERVAL_MS = 30_000L
    private const val SESSION_TIMEOUT_MS = 30 * 60 * 1000L // 30 minutes

    // Storage keys
    private const val PREFS_NAME = "eodin_analytics_prefs"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_SESSION_ID = "session_id"
    private const val KEY_SESSION_START = "session_start"
    private const val KEY_ATTRIBUTION = "attribution"

    private const val TAG = "EodinAnalytics"

    // Flush timer
    private var flushRunnable: Runnable? = null

    /**
     * Configure the Analytics SDK.
     *
     * @param context Application context
     * @param apiEndpoint The base URL of the Eodin API
     * @param apiKey Your API key for the service
     * @param appId Your app ID (e.g., "fridgify", "arden")
     * @param debug Enable debug logging
     * @param offlineMode Enable offline event storage (default: true)
     */
    @JvmStatic
    fun configure(
        context: Context,
        apiEndpoint: String,
        apiKey: String,
        appId: String,
        debug: Boolean = false,
        offlineMode: Boolean = true
    ) {
        this.applicationContext = context.applicationContext
        this.apiEndpoint = apiEndpoint.trimEnd('/')
        this.apiKey = apiKey
        this.appId = appId
        this.isDebug = debug
        this.offlineMode = offlineMode

        // Initialize network client (for legacy mode)
        networkClient = NetworkClient(
            apiEndpoint = this.apiEndpoint!!,
            apiKey = apiKey,
            isDebug = debug
        )

        // Initialize state
        initDeviceId()
        loadUserId()
        loadAttribution()
        initSession()
        initDeviceInfo()

        // Initialize EventQueue for offline support
        if (offlineMode) {
            EventQueue.initialize(
                context = context.applicationContext,
                apiEndpoint = this.apiEndpoint!!,
                apiKey = apiKey,
                debug = debug
            )
        } else {
            // Start flush timer for legacy mode
            startFlushTimer()
        }

        log("Configured with endpoint: $apiEndpoint, appId: $appId, offlineMode: $offlineMode")
    }

    /**
     * Check if SDK is properly configured.
     */
    @JvmStatic
    val isConfigured: Boolean
        get() = apiEndpoint != null && apiKey != null && appId != null

    /**
     * Current device ID.
     */
    @JvmStatic
    fun getDeviceId(): String? = deviceId

    /**
     * Current user ID.
     */
    @JvmStatic
    fun getUserId(): String? = userId

    /**
     * Current session ID.
     */
    @JvmStatic
    fun getSessionId(): String? = sessionId

    /**
     * Current attribution.
     */
    @JvmStatic
    fun getAttribution(): Attribution? = attribution

    /**
     * Track an analytics event.
     *
     * @param eventName The name of the event
     * @param properties Optional custom properties
     */
    @JvmStatic
    fun track(eventName: String, properties: Map<String, Any>? = null) {
        if (!isConfigured || applicationContext == null) {
            log("SDK not configured. Call configure() first.", isError = true)
            return
        }

        val event = AnalyticsEvent(
            eventName = eventName,
            appId = appId!!,
            deviceId = deviceId!!,
            userId = userId,
            sessionId = sessionId,
            attribution = attribution,
            device = deviceInfo,
            properties = properties
        )

        // Use EventQueue for offline support
        if (offlineMode) {
            EventQueue.enqueue(event)
            log("Enqueued event: $eventName (offline mode)")
        } else {
            // Legacy mode
            eventQueue.add(event)
            log("Queued event: $eventName (queue size: ${eventQueue.size})")

            if (shouldFlush()) {
                flush()
            }
        }
    }

    /**
     * Identify a user.
     *
     * @param userId The unique user identifier
     */
    @JvmStatic
    fun identify(userId: String) {
        this.userId = userId
        getPrefs()?.edit()?.putString(KEY_USER_ID, userId)?.apply()
        log("Identified user: $userId")
    }

    /**
     * Clear user identification.
     */
    @JvmStatic
    fun clearIdentity() {
        this.userId = null
        getPrefs()?.edit()?.remove(KEY_USER_ID)?.apply()
        log("Cleared user identity")
    }

    /**
     * Set attribution data.
     *
     * @param attribution The attribution data
     */
    @JvmStatic
    fun setAttribution(attribution: Attribution) {
        this.attribution = attribution
        getPrefs()?.edit()?.putString(KEY_ATTRIBUTION, attribution.serialize())?.apply()
        log("Set attribution: $attribution")
    }

    /**
     * Flush pending events to the server.
     */
    @JvmStatic
    fun flush() {
        if (offlineMode) {
            EventQueue.flush()
            return
        }

        // Legacy mode
        if (eventQueue.isEmpty()) {
            log("No events to flush")
            return
        }

        val client = networkClient ?: return

        // Take events from queue
        val eventsToSend = mutableListOf<AnalyticsEvent>()
        while (eventQueue.isNotEmpty() && eventsToSend.size < MAX_BATCH_SIZE) {
            eventQueue.removeAt(0)?.let { eventsToSend.add(it) }
        }

        if (eventsToSend.isEmpty()) return

        log("Flushing ${eventsToSend.size} events")

        client.sendEvents(eventsToSend) { result ->
            if (!result.success) {
                // Re-queue failed events at the front
                log("Flush failed, re-queuing ${eventsToSend.size} events", isError = true)
                eventsToSend.reversed().forEach { event ->
                    eventQueue.add(0, event)
                }
            } else {
                log("Flush successful: received=${result.received}, duplicates=${result.duplicates}")
            }
        }
    }

    /**
     * Whether currently online (only available in offline mode).
     */
    @JvmStatic
    fun isOnline(): Boolean = if (offlineMode) EventQueue.isOnline else true

    /**
     * Current queue size (only available in offline mode).
     */
    @JvmStatic
    fun getQueueSize(): Int = if (offlineMode) EventQueue.getQueueSize() else eventQueue.size

    /**
     * Start a new session.
     */
    @JvmStatic
    fun startSession() {
        sessionId = UUID.randomUUID().toString()
        sessionStartTime = System.currentTimeMillis()

        getPrefs()?.edit()?.apply {
            putString(KEY_SESSION_ID, sessionId)
            putLong(KEY_SESSION_START, sessionStartTime)
            apply()
        }

        log("Started new session: $sessionId")

        track("session_start")
    }

    /**
     * End the current session.
     */
    @JvmStatic
    fun endSession() {
        if (sessionId != null) {
            track("session_end")
            log("Ended session: $sessionId")
        }

        getPrefs()?.edit()?.apply {
            remove(KEY_SESSION_ID)
            remove(KEY_SESSION_START)
            apply()
        }

        sessionId = null
        sessionStartTime = 0
    }

    // Private methods

    private fun shouldFlush(): Boolean {
        return eventQueue.size >= MAX_BATCH_SIZE
    }

    private fun startFlushTimer() {
        flushRunnable?.let { mainHandler.removeCallbacks(it) }

        flushRunnable = object : Runnable {
            override fun run() {
                if (eventQueue.isNotEmpty()) {
                    flush()
                }
                mainHandler.postDelayed(this, FLUSH_INTERVAL_MS)
            }
        }

        mainHandler.postDelayed(flushRunnable!!, FLUSH_INTERVAL_MS)
    }

    private fun initDeviceId() {
        val prefs = getPrefs() ?: return

        val storedId = prefs.getString(KEY_DEVICE_ID, null)
        if (storedId != null) {
            deviceId = storedId
        } else {
            deviceId = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()
        }

        log("Device ID: $deviceId")
    }

    private fun loadUserId() {
        userId = getPrefs()?.getString(KEY_USER_ID, null)
        if (userId != null) {
            log("Loaded user ID: $userId")
        }
    }

    private fun loadAttribution() {
        val attributionJson = getPrefs()?.getString(KEY_ATTRIBUTION, null)
        if (attributionJson != null) {
            attribution = Attribution.deserialize(attributionJson)
            log("Loaded attribution: $attribution")
        }
    }

    private fun initSession() {
        val prefs = getPrefs() ?: return

        val storedSessionId = prefs.getString(KEY_SESSION_ID, null)
        val storedStartTime = prefs.getLong(KEY_SESSION_START, 0)

        if (storedSessionId != null && storedStartTime > 0) {
            val elapsed = System.currentTimeMillis() - storedStartTime

            // Session valid for 30 minutes
            if (elapsed < SESSION_TIMEOUT_MS) {
                sessionId = storedSessionId
                sessionStartTime = storedStartTime
                log("Resumed session: $sessionId")
                return
            }
        }

        // Start new session
        startSession()
    }

    private fun initDeviceInfo() {
        applicationContext?.let { context ->
            deviceInfo = DeviceInfo.collect(context)
            log("Device info: $deviceInfo")
        }
    }

    private fun getPrefs(): SharedPreferences? {
        return applicationContext?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    private fun log(message: String, isError: Boolean = false) {
        if (isDebug || isError) {
            if (isError) {
                android.util.Log.e(TAG, message)
            } else {
                android.util.Log.d(TAG, message)
            }
        }
    }

    /**
     * Reset SDK state (for testing purposes).
     */
    @JvmStatic
    @Deprecated("For testing only")
    fun reset() {
        flushRunnable?.let { mainHandler.removeCallbacks(it) }
        flushRunnable = null

        apiEndpoint = null
        apiKey = null
        appId = null
        applicationContext = null
        deviceId = null
        userId = null
        sessionId = null
        sessionStartTime = 0
        attribution = null
        deviceInfo = null
        eventQueue.clear()
        networkClient = null
        offlineMode = true

        // Reset EventQueue
        @Suppress("DEPRECATION")
        EventQueue.reset()
    }
}
