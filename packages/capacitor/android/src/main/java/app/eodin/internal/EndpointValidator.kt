package app.eodin.internal

import app.eodin.deeplink.BuildConfig
import java.net.URI
import java.net.URISyntaxException

/**
 * S8 보안 정책 (Phase 1.6) — bundled copy for `@eodin/capacitor` plugin.
 * 본 파일은 `packages/sdk-android/.../app/eodin/internal/EndpointValidator.kt` 와
 * 동일한 정책. 두 파일은 byte-for-byte 동일을 유지해야 함 (drift 가드 권장 —
 * 코드리뷰 N1 후속 ticket). Phase 5.4b 이후 standalone SDK 로 통합되면 제거.
 */
internal object EndpointValidator {
    fun validate(endpoint: String, paramName: String = "apiEndpoint") {
        val trimmed = endpoint.trim()
        require(trimmed.isNotEmpty()) {
            "$paramName must not be empty"
        }
        val uri = try {
            URI(trimmed)
        } catch (_: URISyntaxException) {
            throw IllegalArgumentException("$paramName must be a valid absolute URL: $endpoint")
        }
        val scheme = uri.scheme?.lowercase()
        val host = uri.host?.lowercase()
        require(!scheme.isNullOrEmpty() && !host.isNullOrEmpty()) {
            "$paramName must be a valid absolute URL: $endpoint"
        }
        if (scheme == "https") return
        if (scheme == "http" && isAllowedLoopback(host)) return
        throw IllegalArgumentException(
            "$paramName must use HTTPS — only http://localhost / 127.0.0.1 allowed in all builds; http://10.0.2.2 allowed in debug builds only (got: $endpoint)"
        )
    }

    private fun isAllowedLoopback(host: String): Boolean {
        if (host == "localhost" || host == "127.0.0.1") return true
        return host == "10.0.2.2" && BuildConfig.DEBUG
    }
}
