// swift-tools-version:5.7
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "EodinSDK",
    platforms: [
        .iOS(.v13),
        .macOS(.v10_15)
    ],
    products: [
        // Full SDK with both Deeplink and Analytics
        .library(
            name: "EodinSDK",
            targets: ["EodinDeeplink", "EodinAnalytics"]
        ),
        // Individual modules for selective import
        .library(
            name: "EodinDeeplink",
            targets: ["EodinDeeplink"]
        ),
        .library(
            name: "EodinAnalytics",
            targets: ["EodinAnalytics"]
        ),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "EodinDeeplink",
            dependencies: [],
            path: "Sources/EodinDeeplink"
        ),
        .target(
            name: "EodinAnalytics",
            dependencies: [],
            path: "Sources/EodinAnalytics"
        ),
        .testTarget(
            name: "EodinDeeplinkTests",
            dependencies: ["EodinDeeplink"],
            path: "Tests/EodinDeeplinkTests"
        ),
    ]
)
