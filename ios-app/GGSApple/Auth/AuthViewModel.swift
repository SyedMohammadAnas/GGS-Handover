import Foundation
import Observation
import Supabase
import Auth

@MainActor
@Observable
final class AuthViewModel {
    enum Phase: Equatable {
        case bootstrapping
        case signedOut
        case signedIn(session: Session, profile: Profile?)
        case failed(String)
    }

    private(set) var phase: Phase = .bootstrapping
    var isBusy = false
    var statusMessage: String = ""

    private let auth = AuthService.shared

    func bootstrap() async {
        phase = .bootstrapping
        statusMessage = "Checking session…"
        print("[Auth] bootstrap start")

        do {
            let session = try await auth.client.auth.session
            await loadSignedIn(session: session)
        } catch {
            // No persisted session is normal on first launch.
            phase = .signedOut
            statusMessage = ""
            print("[Auth] bootstrap: \(error.localizedDescription)")
        }
    }

    func signIn(email: String, password: String) async {
        isBusy = true
        statusMessage = "Signing in…"

        do {
            let session = try await auth.signIn(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password
            )
            await loadSignedIn(session: session)
            print("[Auth] signIn success user=\(session.user.id)")
        } catch {
            statusMessage = "Wrong email or password, or the server is unreachable."
            phase = .signedOut
            print("[Auth] signIn FAILED: \(error.localizedDescription)")
        }

        isBusy = false
    }

    func signUp(email: String, password: String, name: String) async {
        guard password.count >= 8 else {
            statusMessage = "Password must be at least 8 characters."
            return
        }
        isBusy = true
        statusMessage = "Creating your account…"

        do {
            let session = try await auth.signUp(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password,
                name: name.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            if let session {
                await loadSignedIn(session: session)
            } else {
                // Accounts are auto-confirmed; if no session came back, sign in explicitly.
                await signIn(email: email, password: password)
            }
        } catch {
            statusMessage = error.localizedDescription
            phase = .signedOut
            print("[Auth] signUp FAILED: \(error.localizedDescription)")
        }

        isBusy = false
    }

    func signOut() async {
        isBusy = true
        print("[Auth] signOut")
        do {
            try await auth.signOut()
        } catch {
            print("[Auth] signOut error: \(error.localizedDescription)")
        }
        phase = .signedOut
        statusMessage = ""
        isBusy = false
    }

    private func loadSignedIn(session: Session) async {
        var profile: Profile?
        do {
            profile = try await auth.fetchProfile(userId: session.user.id)
            print("[Auth] profile role=\(profile?.role ?? "nil") publicId=\(profile?.publicId ?? "nil")")
        } catch {
            // Profile may lag behind first login trigger — still treat as signed in.
            print("[Auth] profile fetch skipped/failed: \(error.localizedDescription)")
        }
        phase = .signedIn(session: session, profile: profile)
        statusMessage = ""
    }
}
