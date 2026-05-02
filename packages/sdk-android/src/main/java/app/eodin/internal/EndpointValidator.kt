package app.eodin.internal

import app.eodin.deeplink.BuildConfig
import java.net.URI
import java.net.URISyntaxException

/**
 * S8 보안 정책 (Phase 1.6): SDK 의 모든 API endpoint 는 HTTPS 만 허용.
 *
 * dev / emulator 워크플로우 유지를 위해 loopback 주소의 `http://` 허용:
 * - `localhost` / `127.0.0.1` — 모든 빌드 (release 포함). cleartextTrafficPermitted
 *   기본 false 라 release 에서도 사실상 막힘
 * - `10.0.2.2` — **debug build 만**. Android emulator → host 전용 주소이므로
 *   release APK 에 들어가면 사용자 단말의 사설망 IP 와 충돌 가능 (코드리뷰 H1)
 *
 * cross-platform 정합 (M2): 입력은 trim + scheme lowercase 비교.
 *
 * `app.eodin.internal` package — public surface 가 아님. JVM `java.net.URI`
 * 사용 (Android `android.net.Uri` 는 unit test JVM 에서 동작 X).
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
        // Android emulator → host. release APK 에 들어가면 사설망 IP 와 충돌
        // 가능하므로 debug build 만 허용. BuildConfig.DEBUG 는 Android Gradle
        // 플러그인이 build type 별 자동 생성 — release AAR / APK 에서는 false.
        return host == "10.0.2.2" && BuildConfig.DEBUG
    }
}
