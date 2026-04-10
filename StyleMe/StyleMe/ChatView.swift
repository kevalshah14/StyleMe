import SwiftUI

struct ChatView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var messages: [ChatBubbleMessage] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @FocusState private var isInputFocused: Bool

    private let suggestions = [
        "What should I wear to a job interview?",
        "Date night outfit ideas",
        "Casual weekend look",
        "Best outfit for rainy weather"
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Neo.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: 16) {
                                if messages.isEmpty {
                                    welcomeSection
                                }

                                ForEach(messages) { message in
                                    MessageBubble(message: message)
                                        .id(message.id)
                                }

                                if isLoading {
                                    HStack {
                                        TypingIndicator()
                                        Spacer()
                                    }
                                    .padding(.horizontal, 16)
                                    .id("typing")
                                }
                            }
                            .padding(.vertical, 16)
                        }
                        .scrollDismissesKeyboard(.interactively)
                        .onChange(of: messages.count) { _, _ in
                            withAnimation {
                                if let last = messages.last {
                                    proxy.scrollTo(last.id, anchor: .bottom)
                                }
                            }
                        }
                        .onChange(of: isLoading) { _, loading in
                            if loading {
                                withAnimation { proxy.scrollTo("typing", anchor: .bottom) }
                            }
                        }
                    }

                    inputBar
                }
            }
            .navigationTitle("Chat")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: - Welcome

    private var welcomeSection: some View {
        VStack(spacing: 24) {
            VStack(spacing: 10) {
                HStack(spacing: 12) {
                    Circle().fill(Neo.yellow).frame(width: 12, height: 12)
                    Rectangle().fill(Neo.accent).frame(width: 12, height: 12)
                    RoundedRectangle(cornerRadius: 2).fill(Neo.blue).frame(width: 12, height: 12)
                }

                Text("HI \(auth.displayName?.uppercased() ?? "THERE")!")
                    .font(.system(size: 24, weight: .black))
                    .tracking(1)
                    .foregroundColor(Neo.ink)

                Text("I'm your AI stylist. Ask me\nanything about outfits & style!")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Neo.muted)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, 40)

            VStack(alignment: .leading, spacing: 10) {
                Text("TRY ASKING")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(1)
                    .foregroundColor(Neo.muted)
                    .padding(.horizontal, 4)

                ForEach(suggestions, id: \.self) { suggestion in
                    Button {
                        inputText = suggestion
                        sendMessage()
                    } label: {
                        Text(suggestion)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Neo.ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(Neo.surface)
                            .overlay(Rectangle().stroke(Neo.border, lineWidth: 1.5))
                            .shadow(color: Neo.ink.opacity(0.06), radius: 0, x: 2, y: 2)
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        VStack(spacing: 0) {
            Rectangle().fill(Neo.border.opacity(0.2)).frame(height: 1)

            HStack(spacing: 12) {
                TextField("Ask your stylist...", text: $inputText, axis: .vertical)
                    .lineLimit(1...5)
                    .focused($isInputFocused)
                    .font(.system(size: 15, weight: .medium))
                    .padding(12)
                    .background(Neo.surface)
                    .overlay(Rectangle().stroke(Neo.border, lineWidth: 2))

                Button { sendMessage() } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(canSend ? Neo.accent : Neo.muted)
                        .overlay(Rectangle().stroke(Neo.ink, lineWidth: 2))
                }
                .disabled(!canSend)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Neo.background)
        }
    }

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    // MARK: - Send

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }

        let userMsg = ChatBubbleMessage(role: "user", content: text)
        messages.append(userMsg)
        inputText = ""
        isInputFocused = false
        isLoading = true

        let history = messages.dropLast().map { ["role": $0.role, "content": $0.content] }

        Task {
            do {
                let response = try await APIService.shared.chat(
                    message: text, history: Array(history))
                let reply = ChatBubbleMessage(role: "assistant", content: response.reply)
                await MainActor.run {
                    messages.append(reply)
                    isLoading = false
                }
            } catch {
                let errorMsg = ChatBubbleMessage(
                    role: "assistant",
                    content: "Sorry, I couldn't process that right now. Please try again.")
                await MainActor.run {
                    messages.append(errorMsg)
                    isLoading = false
                }
            }
        }
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: ChatBubbleMessage
    private var isUser: Bool { message.role == "user" }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if isUser { Spacer(minLength: 60) }

            if !isUser {
                Rectangle()
                    .fill(Neo.accent)
                    .frame(width: 28, height: 28)
                    .overlay(
                        Text("S")
                            .font(.system(size: 14, weight: .black))
                            .foregroundColor(.white)
                    )
                    .overlay(Rectangle().stroke(Neo.ink, lineWidth: 1.5))
            }

            Text(message.content)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Neo.ink)
                .padding(12)
                .background(isUser ? Neo.yellowSoft : Neo.surface)
                .overlay(
                    Rectangle().stroke(
                        isUser ? Neo.yellow.opacity(0.5) : Neo.border,
                        lineWidth: 1.5
                    )
                )
                .shadow(color: Neo.ink.opacity(0.06), radius: 0, x: 2, y: 2)

            if isUser {
                Circle()
                    .fill(Neo.yellow)
                    .frame(width: 28, height: 28)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.system(size: 12))
                            .foregroundColor(Neo.ink)
                    )
                    .overlay(Circle().stroke(Neo.ink, lineWidth: 1.5))
            }

            if !isUser { Spacer(minLength: 60) }
        }
        .padding(.horizontal, 16)
    }
}

// MARK: - Typing Indicator

struct TypingIndicator: View {
    @State private var animating = false

    var body: some View {
        HStack(spacing: 10) {
            Rectangle()
                .fill(Neo.accent)
                .frame(width: 28, height: 28)
                .overlay(
                    Text("S")
                        .font(.system(size: 14, weight: .black))
                        .foregroundColor(.white)
                )
                .overlay(Rectangle().stroke(Neo.ink, lineWidth: 1.5))

            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(Neo.muted)
                        .frame(width: 8, height: 8)
                        .offset(y: animating ? -4 : 0)
                        .animation(
                            .easeInOut(duration: 0.4)
                                .repeatForever(autoreverses: true)
                                .delay(Double(i) * 0.15),
                            value: animating
                        )
                }
            }
            .padding(12)
            .background(Neo.surface)
            .overlay(Rectangle().stroke(Neo.border, lineWidth: 1.5))
            .onAppear { animating = true }
        }
    }
}
