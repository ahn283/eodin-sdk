import Foundation

/// Errors thrown by `EndpointValidator.validate(_:)`.
public enum EndpointValidationError: Error, LocalizedError, Equatable {
    case invalidUrl(String)
    case insecureScheme(String)

    public var errorDescription: String? {
        switch self {
        case .invalidUrl(let value):
            return "Endpoint must be a valid absolute URL (got: \(value))"
        case .insecureScheme(let value):
            return "Endpoint must use HTTPS — only http://localhost / 127.0.0.1 allowed in all builds; http://10.0.2.2 allowed in DEBUG builds only (got: \(value))"
        }
    }
}

/// S8 보안 정책 (Phase 1.6): SDK 의 모든 API endpoint 는 HTTPS 만 허용.
///
/// dev / emulator 워크플로우 유지를 위해 loopback 주소의 `http://` 허용:
/// - `localhost` / `127.0.0.1` — 모든 빌드 (release 포함). iOS ATS 가
///   release 에서도 보호하므로 위험 작음
/// - `10.0.2.2` — **DEBUG 빌드만**. Android emulator → host 전용 주소이므로
///   release IPA 에 들어가면 사용자 단말의 사설망 IP 와 충돌 가능 (코드리뷰 H1)
///
/// cross-platform 정합 (M2): 입력은 trim + scheme lowercase 비교.
public enum EndpointValidator {
    public static func validate(_ endpoint: String) throws {
        let trimmed = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw EndpointValidationError.invalidUrl(endpoint)
        }
        guard let url = URL(string: trimmed),
              let rawScheme = url.scheme,
              let host = url.host,
              !host.isEmpty else {
            throw EndpointValidationError.invalidUrl(endpoint)
        }
        let scheme = rawScheme.lowercased()
        let lowerHost = host.lowercased()
        if scheme == "https" { return }
        if scheme == "http", isAllowedLoopback(lowerHost) { return }
        throw EndpointValidationError.insecureScheme(endpoint)
    }

    static func isAllowedLoopback(_ host: String) -> Bool {
        if host == "localhost" || host == "127.0.0.1" { return true }
        // Android emulator → host. release IPA 에 들어가면 사설망 IP 와 충돌
        // 가능하므로 DEBUG build 만 허용.
        #if DEBUG
        if host == "10.0.2.2" { return true }
        #endif
        return false
    }
}
