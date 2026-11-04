// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "GGSApple",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "GGSApple", targets: ["GGSApple"]),
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift", from: "2.5.0"),
        .package(path: "Vendor/client-sdk-swift"),
    ],
    targets: [
        .target(
            name: "GGSApple",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift"),
                .product(name: "LiveKit", package: "client-sdk-swift"),
            ],
            path: "GGSApple",
            exclude: ["Resources/Assets.xcassets", "Resources/Info.plist"],
            swiftSettings: [
                .swiftLanguageMode(.v5),
                .define("XTOOL_WSL"),
            ]
        ),
    ]
)
