package app.eodin.deeplink

/**
 * Result container for deferred deep link parameters.
 *
 * @property path The deep link path to navigate to (e.g., "product/12345")
 * @property resourceId The resource ID from the original link
 * @property metadata Additional metadata if any
 */
data class DeferredParamsResult(
    val path: String?,
    val resourceId: String?,
    val metadata: Map<String, Any>?
) {
    /**
     * Whether deferred parameters were found.
     */
    val hasParams: Boolean
        get() = path != null
}
