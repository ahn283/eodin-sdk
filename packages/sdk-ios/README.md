# EodinDeeplink iOS SDK

Swift SDK for integrating Eodin deferred deep links into iOS applications.

## Requirements

- iOS 13.0+
- macOS 10.15+ (for development)
- Swift 5.7+

## Installation

### Swift Package Manager

Add the following to your `Package.swift` dependencies:

```swift
dependencies: [
    .package(url: "https://github.com/ahn283/eodin-sdk.git", from: "2.0.0-beta.2")
]
```

> No `v2.0.0-beta.2` tag has been pushed yet — until one exists, pin to a branch
> or commit instead, e.g. `.package(url: ..., revision: "<commit-sha>")`.

Or in Xcode:
1. File → Add Package Dependencies
2. Enter the repository URL `https://github.com/ahn283/eodin-sdk.git`
3. Select the `EodinDeeplink` product

## Quick Start

### 1. Configure the SDK

Configure the SDK as early as possible in your app's lifecycle, typically in `AppDelegate` or `App` struct:

```swift
import EodinDeeplink

// In AppDelegate
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    EodinDeeplink.configure(
        apiEndpoint: "https://api.eodin.app/api/v1",
        service: "your-service-id"  // e.g., "shopping", "food", "video"
    )

    return true
}

// Or in SwiftUI App
@main
struct MyApp: App {
    init() {
        EodinDeeplink.configure(
            apiEndpoint: "https://api.eodin.app/api/v1",
            service: "your-service-id"
        )
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### 2. Check for Deferred Parameters

Check for deferred deep link parameters when appropriate (e.g., after onboarding or on first launch):

```swift
// Callback-based (iOS 13+)
EodinDeeplink.checkDeferredParams { result in
    switch result {
    case .success(let params):
        if params.hasParams, let path = params.path {
            // Navigate to the deep link destination
            print("Deferred deep link path: \(path)")
            navigateToDeeplink(path: path)
        }
    case .failure(let error):
        switch error {
        case .noParamsFound:
            // Normal case - user installed without clicking a link
            print("No deferred params (fresh install)")
        default:
            print("Error checking deferred params: \(error.localizedDescription)")
        }
    }
}

// Async/await (iOS 13+)
Task {
    do {
        let params = try await EodinDeeplink.checkDeferredParams()
        if let path = params.path {
            await navigateToDeeplink(path: path)
        }
    } catch EodinDeeplink.EodinError.noParamsFound {
        // Normal - no deferred link
    } catch {
        print("Error: \(error)")
    }
}
```

## API Reference

### Configuration

```swift
/// Configure the SDK
/// - Parameters:
///   - apiEndpoint: Base URL of Eodin API (e.g., "https://api.eodin.app/api/v1")
///   - service: Your service identifier registered with Eodin
static func configure(apiEndpoint: String, service: String)

/// Check if SDK is configured and ready
static var isReady: Bool { get }
```

### Deferred Parameters

```swift
/// Check for deferred deep link parameters
/// - Parameter completion: Callback with Result<DeferredParamsResult, EodinError>
static func checkDeferredParams(completion: @escaping (Result<DeferredParamsResult, EodinError>) -> Void)

/// Async version (iOS 13+)
static func checkDeferredParams() async throws -> DeferredParamsResult
```

### Data Types

```swift
struct DeferredParamsResult {
    /// Deep link path (e.g., "product/12345")
    let path: String?

    /// Resource ID from original link
    let resourceId: String?

    /// Additional metadata
    let metadata: [String: Any]?

    /// Whether parameters were found
    var hasParams: Bool { get }
}

enum EodinError: Error {
    case notConfigured       // SDK not configured
    case networkError(Error) // Network request failed
    case invalidResponse     // Invalid server response
    case noParamsFound       // No deferred params (normal for fresh installs)
    case serverError(Int, String?) // Server returned error
}
```

## How It Works

1. User clicks an Eodin deep link (`link.eodin.app/your-service/resource-id`)
2. The web landing page records the click (destination + the visitor's IP) and
   redirects the user to the App Store
3. After installation, the SDK calls the deferred-params API scoped to your
   `service`
4. The **server matches the install to the original click by IP** within a short
   time window and returns the stored parameters
5. The SDK resolves `checkDeferredParams()` with the path, and your app navigates

### Matching mechanism (iOS = server-side probabilistic)

iOS has no equivalent of Android's Play Install Referrer, so matching is
**probabilistic, performed server-side on the click IP**. It is best-effort, not
100% deterministic — design your UX so a miss simply lands the user on the normal
home screen. To reduce ambiguity the server only attributes when the IP maps to a
single recent click. See
[`docs/deeplink-reliability/phase3-design.md`](https://github.com/ahn283/eodin-sdk/blob/main/docs/deeplink-reliability/phase3-design.md).

The SDK sends a hashed device signal (derived from IDFV + device
characteristics) alongside the request. It:
- Does NOT require user permission (no ATT prompt for deferred deep linking)
- Is NOT the advertising identifier (IDFA)
- Is not relied upon for the primary match (the server uses the click IP)

> **Call once.** The iOS SDK does not keep a client-side "claimed" flag — the
> **server atomically claims** each click on the first successful match, so a
> later call returns `.noParamsFound` rather than re-attributing the same install.

## Best Practices

1. **Call early but not too early**: Check deferred params after any required permissions or onboarding
2. **Handle no params gracefully**: Most installs won't have deferred params
3. **Navigate appropriately**: Use your app's navigation system to handle the deep link path
4. **Test thoroughly**: Use the Eodin admin dashboard to verify integration

## Example Integration

```swift
class AppCoordinator {
    func checkDeferredDeeplink() {
        guard EodinDeeplink.isReady else { return }

        EodinDeeplink.checkDeferredParams { [weak self] result in
            switch result {
            case .success(let params):
                if let path = params.path {
                    self?.handleDeeplink(path: path)
                }
            case .failure(.noParamsFound):
                // Expected for organic installs
                break
            case .failure(let error):
                // Log but don't block user
                print("Deferred link error: \(error)")
            }
        }
    }

    private func handleDeeplink(path: String) {
        // Parse path and navigate
        // e.g., "product/12345" → show product detail
        let components = path.split(separator: "/")
        guard components.count >= 2 else { return }

        switch components[0] {
        case "product":
            showProduct(id: String(components[1]))
        case "category":
            showCategory(id: String(components[1]))
        default:
            break
        }
    }
}
```

## License

MIT License
