import Foundation

/// Central runtime config for Instant customer app (experts use Assist AR web).
enum AppConfig {
    // MARK: - Supabase (values come from ServerConfig.swift)

    static let supabaseURL = URL(string: ServerConfig.supabaseURL)!
    static let supabaseAnonKey = ServerConfig.supabaseAnonKey

    // MARK: - Defaults — bump configEpoch when ServerConfig URLs change

    /// Bump this when the server addresses change so stale Debug overrides are cleared on phones.
    static let configEpoch = 1

    /// Express API (sessions + 3D model downloads).
    static let defaultAPIURL = URL(string: ServerConfig.apiURL)!
    /// LiveKit signalling URL.
    static let defaultLiveKitURL = ServerConfig.liveKitURL

    // MARK: - Product

    static let appDisplayName = "Instant"
    /// Expert web console.
    static let expertWebURL = URL(string: ServerConfig.expertWebURL)!
    static let isPremium = false
}

/// UserDefaults overrides for debug backend URL sheet.
@MainActor
enum RuntimeConfig {
    private static let apiKey = "runtime.apiURL"
    private static let liveKitKey = "runtime.liveKitURL"
    private static let epochKey = "runtime.configEpoch"

    /// Call once at launch so phones drop stale Debug overrides after a config epoch bump.
    static func migrateIfNeeded() {
        let stored = UserDefaults.standard.integer(forKey: epochKey)
        if stored == AppConfig.configEpoch {
            return
        }
        // Drop old overrides that pointed at Vercel or Homelab LiveKit.
        clearOverrides()
        UserDefaults.standard.set(AppConfig.configEpoch, forKey: epochKey)
        print("[Config] migrated to epoch=\(AppConfig.configEpoch) api=\(apiURL.absoluteString) livekit=\(liveKitURL)")
    }

    static var apiURL: URL {
        if let raw = UserDefaults.standard.string(forKey: apiKey),
           let url = URL(string: raw), !raw.isEmpty {
            return url
        }
        return AppConfig.defaultAPIURL
    }

    static var liveKitURL: String {
        let raw = UserDefaults.standard.string(forKey: liveKitKey) ?? ""
        return raw.isEmpty ? AppConfig.defaultLiveKitURL : raw
    }

    static func setAPIURL(_ value: String) {
        UserDefaults.standard.set(value.trimmingCharacters(in: .whitespacesAndNewlines), forKey: apiKey)
        print("[Config] API_URL override=\(apiURL.absoluteString)")
    }

    static func setLiveKitURL(_ value: String) {
        UserDefaults.standard.set(value.trimmingCharacters(in: .whitespacesAndNewlines), forKey: liveKitKey)
        print("[Config] LIVEKIT_URL override=\(liveKitURL)")
    }

    static func clearOverrides() {
        UserDefaults.standard.removeObject(forKey: apiKey)
        UserDefaults.standard.removeObject(forKey: liveKitKey)
        print("[Config] cleared URL overrides → api=\(AppConfig.defaultAPIURL.absoluteString) livekit=\(AppConfig.defaultLiveKitURL)")
    }

    static func markEpochCurrent() {
        UserDefaults.standard.set(AppConfig.configEpoch, forKey: epochKey)
    }
}
