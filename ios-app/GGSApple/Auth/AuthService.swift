import Foundation
import Supabase
import Auth
import Observation

/// Thin wrapper around supabase-swift Auth for email + password accounts.
@MainActor
final class AuthService {
    static let shared = AuthService()

    let client: SupabaseClient

    private init() {
        client = SupabaseClient(
            supabaseURL: AppConfig.supabaseURL,
            supabaseKey: AppConfig.supabaseAnonKey,
            options: SupabaseClientOptions(
                auth: .init(
                    // Opt into upcoming supabase-swift default (PR #822).
                    emitLocalSessionAsInitialSession: true
                )
            )
        )
    }

    /// Current session if restored from keychain.
    func currentSession() async -> Session? {
        try? await client.auth.session
    }

    /// Email + password sign-in.
    @discardableResult
    func signIn(email: String, password: String) async throws -> Session {
        try await client.auth.signIn(email: email, password: password)
    }

    /// Create a customer account. The server marks every self-registered account as a customer.
    /// Returns a session immediately (accounts are auto-confirmed on this server).
    @discardableResult
    func signUp(email: String, password: String, name: String) async throws -> Session? {
        let response = try await client.auth.signUp(
            email: email,
            password: password,
            data: name.isEmpty ? nil : ["full_name": .string(name)]
        )
        return response.session
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }

    /// Fetch `profiles` row for the signed-in user.
    func fetchProfile(userId: UUID) async throws -> Profile {
        try await client
            .from("profiles")
            .select()
            .eq("id", value: userId.uuidString)
            .single()
            .execute()
            .value
    }
}

struct Profile: Codable, Equatable {
    let id: UUID
    let role: String?
    let publicId: String?
    let displayName: String?

    enum CodingKeys: String, CodingKey {
        case id
        case role
        case publicId = "public_id"
        case displayName = "display_name"
    }
}
