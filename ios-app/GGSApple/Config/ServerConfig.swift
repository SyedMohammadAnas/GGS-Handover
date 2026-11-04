import Foundation

/// The only file you edit to point the app at your own server.
///
/// Run `ios-app/scripts/configure-server.sh` (it reads `client-config.txt` produced by the
/// installer) or edit the five values below by hand. Each line ends with a `// CONFIG:` tag
/// that the script uses to find it — keep the tags.
///
/// The anon key is a public, client-side key (safe to ship in the app). Never put the
/// service-role key or any password in this file.
enum ServerConfig {
    /// Supabase gateway URL (sign-in and database).
    static let supabaseURL = "https://sb.example.com" // CONFIG:SUPABASE_URL
    /// Supabase anon (public) key.
    static let supabaseAnonKey = "REPLACE_WITH_ANON_KEY" // CONFIG:SUPABASE_ANON_KEY
    /// Express API URL (sessions and 3D model downloads).
    static let apiURL = "https://api.example.com" // CONFIG:API_URL
    /// LiveKit signalling URL (wss:// in domain mode, ws://<LAN-IP>:7880 in LAN mode).
    static let liveKitURL = "wss://lk.example.com" // CONFIG:LIVEKIT_URL
    /// Expert web console URL (shown to customers in share text).
    static let expertWebURL = "https://app.example.com" // CONFIG:EXPERT_URL
}
