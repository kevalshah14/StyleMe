import SwiftUI

// MARK: - Root Router

struct ContentView: View {
    @EnvironmentObject var auth: AuthManager

    var body: some View {
        Group {
            if auth.isAuthenticated {
                MainTabView()
            } else {
                OnboardingView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: auth.isAuthenticated)
    }
}

// MARK: - Onboarding

struct OnboardingView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var name = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        ZStack {
            Neo.background.ignoresSafeArea()

            VStack(spacing: 36) {
                Spacer()

                VStack(spacing: 16) {
                    HStack(spacing: 14) {
                        Circle().fill(Neo.yellow).frame(width: 20, height: 20)
                            .overlay(Circle().stroke(Neo.ink, lineWidth: 1.5))
                        Rectangle().fill(Neo.accent).frame(width: 20, height: 20)
                            .overlay(Rectangle().stroke(Neo.ink, lineWidth: 1.5))
                        RoundedRectangle(cornerRadius: 2).fill(Neo.blue).frame(width: 20, height: 20)
                            .overlay(RoundedRectangle(cornerRadius: 2).stroke(Neo.ink, lineWidth: 1.5))
                    }

                    Text("STYLEME")
                        .font(.system(size: 42, weight: .black))
                        .tracking(2)
                        .foregroundColor(Neo.ink)

                    Text("Your AI wardrobe assistant")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(Neo.muted)
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("WHAT'S YOUR NAME?")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(1)
                        .foregroundColor(Neo.muted)

                    TextField("Enter your name", text: $name)
                        .textFieldStyle(.plain)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(Neo.ink)
                        .padding(16)
                        .background(Neo.surface)
                        .overlay(Rectangle().stroke(Neo.border, lineWidth: Neo.borderWidth))
                        .shadow(color: Neo.ink.opacity(0.08), radius: 0, x: 3, y: 3)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.words)
                }
                .padding(.horizontal, 32)

                Button {
                    Task { await register() }
                } label: {
                    HStack(spacing: 8) {
                        if isLoading {
                            ProgressView().tint(.white)
                        }
                        Text(isLoading ? "Setting up..." : "Let's Go")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeoButtonStyle.accent)
                .padding(.horizontal, 32)
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isLoading)
                .opacity(name.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)

                if let error {
                    Text(error)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(Neo.accent)
                        .padding(12)
                        .background(Neo.pinkSoft)
                        .overlay(Rectangle().stroke(Neo.accent.opacity(0.3), lineWidth: 1.5))
                        .padding(.horizontal, 32)
                }

                Spacer()
                Spacer()
            }
        }
    }

    private func register() async {
        isLoading = true
        error = nil
        do {
            try await auth.register(name: name.trimmingCharacters(in: .whitespaces))
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Main Tab View

struct MainTabView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            WardrobeView()
                .tabItem {
                    Label("Wardrobe", systemImage: "square.grid.2x2.fill")
                }
                .tag(0)

            UploadView()
                .tabItem {
                    Label("Upload", systemImage: "camera.fill")
                }
                .tag(1)

            ChatView()
                .tabItem {
                    Label("Chat", systemImage: "bubble.left.and.bubble.right.fill")
                }
                .tag(2)
        }
        .tint(Neo.accent)
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthManager())
}
