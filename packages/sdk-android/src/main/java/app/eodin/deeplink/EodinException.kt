package app.eodin.deeplink

/**
 * Exception types for Eodin SDK operations.
 */
sealed class EodinException(message: String) : Exception(message) {

    /**
     * SDK is not configured. Call EodinDeeplink.configure() first.
     */
    class NotConfigured : EodinException(
        "EodinDeeplink SDK is not configured. Call EodinDeeplink.configure() first."
    )

    /**
     * Network request failed.
     */
    class NetworkError(cause: Throwable) : EodinException(
        "Network error: ${cause.message}"
    ) {
        init {
            initCause(cause)
        }
    }

    /**
     * Invalid response from server.
     */
    class InvalidResponse : EodinException(
        "Invalid response from server"
    )

    /**
     * No deferred parameters found for this device.
     * This is expected for fresh installs without clicking a deep link.
     */
    class NoParamsFound : EodinException(
        "No deferred parameters found for this device"
    )

    /**
     * Server returned an error.
     *
     * @property code HTTP status code
     * @property serverMessage Error message from server
     */
    class ServerError(val code: Int, val serverMessage: String?) : EodinException(
        "Server error ($code): ${serverMessage ?: "Unknown error"}"
    )
}
