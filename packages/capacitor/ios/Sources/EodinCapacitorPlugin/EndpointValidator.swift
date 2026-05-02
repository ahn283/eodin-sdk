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

/// S8 보안 정책 (Phase 1.6) — bundled copy for `@eodin/capacitor` plugin.
/// 본 파일은 `packages/sdk-ios/Sources/EodinAnalytics/EndpointValidator.swift` 와
/// 동일한 정책. 두 파일은 byte-for-byte 동일을 유지해야 함 (drift 가드 권장 —
/// 코드리뷰 N1 후속 ticket). Phase 5.4b 이후 standalone SDK 로 통합되면 제거.
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
        #if DEBUG
        if host == "10.0.2.2" { return true }
        #endif
        return false
    }
}
