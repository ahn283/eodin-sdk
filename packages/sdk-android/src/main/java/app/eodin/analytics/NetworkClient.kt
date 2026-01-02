package app.eodin.analytics

import app.eodin.analytics.models.AnalyticsEvent
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Network client for sending analytics events to the Eodin API.
 */
internal class NetworkClient(
    private val apiEndpoint: String,
    private val apiKey: String,
    private val isDebug: Boolean = false
) {
    private val executor = Executors.newSingleThreadExecutor()

    /**
     * Result of sending events.
     */
    data class SendResult(
        val success: Boolean,
        val received: Int = 0,
        val duplicates: Int = 0,
        val errors: List<String> = emptyList(),
        val errorMessage: String? = null
    )

    /**
     * Send events to the API.
     *
     * @param events List of events to send
     * @param callback Callback with the result
     */
    fun sendEvents(events: List<AnalyticsEvent>, callback: (SendResult) -> Unit) {
        executor.submit {
            try {
                val result = sendEventsSync(events)
                callback(result)
            } catch (e: Exception) {
                log("Failed to send events: ${e.message}", isError = true)
                callback(SendResult(success = false, errorMessage = e.message))
            }
        }
    }

    /**
     * Send events synchronously.
     *
     * @param events List of events to send
     * @return SendResult
     */
    fun sendEventsSync(events: List<AnalyticsEvent>): SendResult {
        if (events.isEmpty()) {
            return SendResult(success = true, received = 0)
        }

        val url = URL("$apiEndpoint/events/collect")
        val connection = url.openConnection() as HttpURLConnection

        try {
            connection.apply {
                requestMethod = "POST"
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                setRequestProperty("X-API-Key", apiKey)
                connectTimeout = 30000
                readTimeout = 30000
            }

            // Build request body
            val eventsArray = JSONArray()
            events.forEach { event ->
                eventsArray.put(event.toJson())
            }

            val requestBody = JSONObject().apply {
                put("events", eventsArray)
            }

            log("Sending ${events.size} events to $url")

            // Write request
            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(requestBody.toString())
                writer.flush()
            }

            val responseCode = connection.responseCode

            if (responseCode == HttpURLConnection.HTTP_OK) {
                val response = readResponse(connection)
                val json = JSONObject(response)

                val received = json.optInt("received", 0)
                val duplicates = json.optInt("duplicates", 0)
                val errors = mutableListOf<String>()

                json.optJSONArray("errors")?.let { errorsArray ->
                    for (i in 0 until errorsArray.length()) {
                        errors.add(errorsArray.getString(i))
                    }
                }

                log("Events sent successfully: received=$received, duplicates=$duplicates")

                return SendResult(
                    success = true,
                    received = received,
                    duplicates = duplicates,
                    errors = errors
                )
            } else {
                val errorResponse = try {
                    readErrorResponse(connection)
                } catch (e: Exception) {
                    "Unknown error"
                }

                log("Failed to send events: $responseCode - $errorResponse", isError = true)

                return SendResult(
                    success = false,
                    errorMessage = "HTTP $responseCode: $errorResponse"
                )
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun readResponse(connection: HttpURLConnection): String {
        return BufferedReader(InputStreamReader(connection.inputStream)).use { reader ->
            reader.readText()
        }
    }

    private fun readErrorResponse(connection: HttpURLConnection): String {
        return BufferedReader(InputStreamReader(connection.errorStream)).use { reader ->
            reader.readText()
        }
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

    companion object {
        private const val TAG = "EodinAnalytics"
    }
}
