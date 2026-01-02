package app.eodin.analytics

import android.content.Context
import android.content.SharedPreferences
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Handler
import android.os.Looper
import app.eodin.analytics.models.AnalyticsEvent
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.min
import kotlin.math.pow

/**
 * Manages event queuing with offline support.
 *
 * Features:
 * - Stores events locally when offline
 * - Automatically sends events when network is restored
 * - Batches events for efficient transmission
 * - Implements exponential backoff on failure
 * - Persists events across app restarts
 */
object EventQueue {

    // Configuration
    private var apiEndpoint: String? = null
    private var apiKey: String? = null
    private var applicationContext: Context? = null
    private var isDebug = false

    // Network client
    private var networkClient: NetworkClient? = null

    // Constants
    private const val MAX_QUEUE_SIZE = 1000
    private const val MAX_BATCH_SIZE = 50
    private const val FLUSH_THRESHOLD = 20
    private const val FLUSH_INTERVAL_MS = 30_000L
    private const val MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000L // 7 days
    private const val MAX_RETRIES = 5

    // Storage
    private const val PREFS_NAME = "eodin_event_queue"
    private const val EVENTS_KEY = "events"

    // State
    private val memoryQueue = CopyOnWriteArrayList<AnalyticsEvent>()
    private val isInitialized = AtomicBoolean(false)
    private val isFlushing = AtomicBoolean(false)
    private val retryCount = AtomicInteger(0)

    // Threading
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var flushRunnable: Runnable? = null

    // Network monitoring
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    @Volatile
    var isOnline = true
        private set

    private const val TAG = "EodinEventQueue"

    /**
     * Initialize the event queue.
     */
    @JvmStatic
    fun initialize(
        context: Context,
        apiEndpoint: String,
        apiKey: String,
        debug: Boolean = false
    ) {
        if (isInitialized.get()) return

        this.applicationContext = context.applicationContext
        this.apiEndpoint = apiEndpoint
        this.apiKey = apiKey
        this.isDebug = debug

        networkClient = NetworkClient(apiEndpoint, apiKey, debug)

        // Load persisted events
        loadPersistedEvents()

        // Start network monitoring
        startNetworkMonitoring()

        // Start flush timer
        startFlushTimer()

        isInitialized.set(true)
        log("EventQueue initialized with ${memoryQueue.size} persisted events")
    }

    /**
     * Add an event to the queue.
     */
    @JvmStatic
    fun enqueue(event: AnalyticsEvent) {
        if (!isInitialized.get()) {
            log("EventQueue not initialized", isError = true)
            return
        }

        executor.submit {
            // Check queue size limit
            if (memoryQueue.size >= MAX_QUEUE_SIZE) {
                val removeCount = memoryQueue.size - MAX_QUEUE_SIZE + 1
                repeat(removeCount) {
                    if (memoryQueue.isNotEmpty()) {
                        memoryQueue.removeAt(0)
                    }
                }
                log("Queue overflow, removed $removeCount old events")
            }

            memoryQueue.add(event)
            log("Enqueued event: ${event.eventName} (queue size: ${memoryQueue.size})")

            // Persist to storage
            persistEvents()

            // Check if we should flush
            if (isOnline && memoryQueue.size >= FLUSH_THRESHOLD) {
                performFlush()
            }
        }
    }

    /**
     * Flush pending events to the server.
     */
    @JvmStatic
    fun flush() {
        executor.submit {
            performFlush()
        }
    }

    /**
     * Current queue size.
     */
    @JvmStatic
    fun getQueueSize(): Int = memoryQueue.size

    /**
     * Dispose resources.
     */
    @JvmStatic
    fun dispose() {
        flushRunnable?.let { mainHandler.removeCallbacks(it) }
        flushRunnable = null

        networkCallback?.let { callback ->
            connectivityManager?.unregisterNetworkCallback(callback)
        }
        networkCallback = null
        connectivityManager = null

        isInitialized.set(false)
        log("EventQueue disposed")
    }

    // Private methods

    private fun performFlush() {
        if (!isInitialized.get() || isFlushing.get() || memoryQueue.isEmpty()) {
            return
        }

        if (!isOnline) {
            log("Offline, skipping flush")
            return
        }

        isFlushing.set(true)

        // Take up to MAX_BATCH_SIZE events
        val eventsToSend = memoryQueue.take(min(MAX_BATCH_SIZE, memoryQueue.size)).toList()

        log("Flushing ${eventsToSend.size} events")

        networkClient?.sendEvents(eventsToSend) { result ->
            executor.submit {
                if (result.success) {
                    // Remove sent events
                    eventsToSend.forEach { event ->
                        memoryQueue.removeIf { it.eventId == event.eventId }
                    }
                    persistEvents()
                    retryCount.set(0)
                    log("Flush successful")

                    isFlushing.set(false)

                    // Continue flushing if more events
                    if (memoryQueue.isNotEmpty()) {
                        performFlush()
                    }
                } else {
                    val currentRetry = retryCount.incrementAndGet()
                    log("Flush failed, retry count: $currentRetry", isError = true)

                    isFlushing.set(false)

                    // Schedule retry with exponential backoff
                    if (currentRetry <= MAX_RETRIES) {
                        val delay = calculateBackoff(currentRetry)
                        log("Scheduling retry in ${delay}ms")

                        mainHandler.postDelayed({ flush() }, delay)
                    }
                }
            }
        }
    }

    private fun persistEvents() {
        val prefs = getPrefs() ?: return

        try {
            val jsonArray = JSONArray()
            memoryQueue.forEach { event ->
                jsonArray.put(event.toJson())
            }
            prefs.edit().putString(EVENTS_KEY, jsonArray.toString()).apply()
        } catch (e: Exception) {
            log("Failed to persist events: ${e.message}", isError = true)
        }
    }

    private fun loadPersistedEvents() {
        val prefs = getPrefs() ?: return

        try {
            val jsonString = prefs.getString(EVENTS_KEY, null) ?: return
            val jsonArray = JSONArray(jsonString)
            val now = System.currentTimeMillis()

            for (i in 0 until jsonArray.length()) {
                try {
                    val event = AnalyticsEvent.deserialize(jsonArray.getJSONObject(i).toString())
                    if (event != null) {
                        // Check if event is too old
                        val eventAge = now - event.timestamp.time
                        if (eventAge < MAX_EVENT_AGE_MS) {
                            memoryQueue.add(event)
                        }
                    }
                } catch (e: Exception) {
                    log("Failed to deserialize event: ${e.message}", isError = true)
                }
            }

            log("Loaded ${memoryQueue.size} persisted events")
        } catch (e: Exception) {
            log("Failed to load persisted events: ${e.message}", isError = true)
            prefs.edit().remove(EVENTS_KEY).apply()
        }
    }

    private fun startNetworkMonitoring() {
        val context = applicationContext ?: return

        connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    val wasOffline = !isOnline
                    isOnline = true
                    log("Network available")

                    if (wasOffline && memoryQueue.isNotEmpty()) {
                        log("Network restored, flushing events")
                        flush()
                    }
                }

                override fun onLost(network: Network) {
                    isOnline = false
                    log("Network lost")
                }

                override fun onCapabilitiesChanged(
                    network: Network,
                    networkCapabilities: NetworkCapabilities
                ) {
                    isOnline = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                }
            }

            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            connectivityManager?.registerNetworkCallback(request, networkCallback!!)
        }

        // Check initial connectivity
        checkConnectivity()
    }

    private fun checkConnectivity() {
        val cm = connectivityManager ?: return

        isOnline = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = cm.activeNetwork
            val capabilities = cm.getNetworkCapabilities(network)
            capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        } else {
            @Suppress("DEPRECATION")
            cm.activeNetworkInfo?.isConnected == true
        }

        log("Initial connectivity: $isOnline")
    }

    private fun startFlushTimer() {
        flushRunnable?.let { mainHandler.removeCallbacks(it) }

        flushRunnable = object : Runnable {
            override fun run() {
                if (isOnline && memoryQueue.isNotEmpty()) {
                    flush()
                }
                mainHandler.postDelayed(this, FLUSH_INTERVAL_MS)
            }
        }

        mainHandler.postDelayed(flushRunnable!!, FLUSH_INTERVAL_MS)
    }

    private fun calculateBackoff(retryCount: Int): Long {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 60s)
        val seconds = min(2.0.pow(retryCount).toLong(), 60L)
        return seconds * 1000
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
     * Reset for testing.
     */
    @JvmStatic
    @Deprecated("For testing only")
    fun reset() {
        flushRunnable?.let { mainHandler.removeCallbacks(it) }
        flushRunnable = null

        networkCallback?.let { callback ->
            connectivityManager?.unregisterNetworkCallback(callback)
        }
        networkCallback = null

        memoryQueue.clear()
        getPrefs()?.edit()?.clear()?.apply()
        isInitialized.set(false)
        isFlushing.set(false)
        retryCount.set(0)
    }
}
