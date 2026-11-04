import SwiftUI

/// Email + password sign-in and customer sign-up.
struct AuthView: View {
    @Bindable var viewModel: AuthViewModel

    @State private var isCreatingAccount = false
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""

    private var canSubmit: Bool {
        !viewModel.isBusy && email.contains("@") && password.count >= (isCreatingAccount ? 8 : 1)
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                VStack(spacing: 8) {
                    Text(AppConfig.appDisplayName)
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text("Get live help from an Assist AR expert")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white.opacity(0.55))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }

                Spacer()

                VStack(spacing: 12) {
                    if isCreatingAccount {
                        field("Name (optional)", text: $name)
                            .textContentType(.name)
                    }

                    field("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)

                    SecureField("Password", text: $password)
                        .textContentType(isCreatingAccount ? .newPassword : .password)
                        .padding(14)
                        .background(Color.white.opacity(0.12))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    if isCreatingAccount {
                        Text("Use at least 8 characters.")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.5))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button {
                        Task {
                            if isCreatingAccount {
                                await viewModel.signUp(email: email, password: password, name: name)
                            } else {
                                await viewModel.signIn(email: email, password: password)
                            }
                        }
                    } label: {
                        Text(buttonTitle)
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(canSubmit ? Color.white : Color.white.opacity(0.3))
                            .foregroundStyle(.black)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .disabled(!canSubmit)

                    Button {
                        isCreatingAccount.toggle()
                        viewModel.statusMessage = ""
                    } label: {
                        Text(isCreatingAccount
                             ? "Already have an account? Sign in"
                             : "New here? Create an account")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }
                .padding(.horizontal, 28)

                if !viewModel.statusMessage.isEmpty {
                    Text(viewModel.statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.orange)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 28)
                }

                Spacer().frame(height: 40)
            }
        }
    }

    private var buttonTitle: String {
        if viewModel.isBusy { return isCreatingAccount ? "Creating…" : "Signing in…" }
        return isCreatingAccount ? "Create account" : "Sign in"
    }

    private func field(_ title: String, text: Binding<String>) -> some View {
        TextField(title, text: text)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .padding(14)
            .background(Color.white.opacity(0.12))
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
