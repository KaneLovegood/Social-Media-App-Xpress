// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.3.1"),
        .package(name: "CapacitorFirebaseAuthentication", path: "..\..\..\node_modules\.pnpm\@capacitor-firebase+authent_b07e0de7ee4a869885c8ab6e8e3b4ebc\node_modules\@capacitor-firebase\authentication"),
        .package(name: "CapacitorApp", path: "..\..\..\node_modules\.pnpm\@capacitor+app@8.1.0_@capacitor+core@8.3.1\node_modules\@capacitor\app"),
        .package(name: "CapacitorDevice", path: "..\..\..\node_modules\.pnpm\@capacitor+device@8.0.2_@capacitor+core@8.3.1\node_modules\@capacitor\device"),
        .package(name: "CapacitorPreferences", path: "..\..\..\node_modules\.pnpm\@capacitor+preferences@8.0.1_@capacitor+core@8.3.1\node_modules\@capacitor\preferences")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorFirebaseAuthentication", package: "CapacitorFirebaseAuthentication"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorDevice", package: "CapacitorDevice"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences")
            ]
        )
    ]
)
