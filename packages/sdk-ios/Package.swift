// swift-tools-version:5.7
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "EodinDeeplink",
    platforms: [
        .iOS(.v13),
        .macOS(.v10_15)
    ],
    products: [
        .library(
            name: "EodinDeeplink",
            targets: ["EodinDeeplink"]
        ),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "EodinDeeplink",
            dependencies: [],
            path: "Sources/EodinDeeplink"
        ),
        .testTarget(
            name: "EodinDeeplinkTests",
            dependencies: ["EodinDeeplink"],
            path: "Tests/EodinDeeplinkTests"
        ),
    ]
)
