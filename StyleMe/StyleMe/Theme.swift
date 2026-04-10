import SwiftUI

// MARK: - Color Helpers

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(.sRGB,
                  red: Double(r) / 255,
                  green: Double(g) / 255,
                  blue: Double(b) / 255,
                  opacity: Double(a) / 255)
    }

    init(light: Color, dark: Color) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}

// MARK: - Neo Design Tokens (matches web globals.css)

enum Neo {
    static let background = Color(light: Color(hex: "FFF8F0"), dark: Color(hex: "0E0E16"))
    static let surface    = Color(light: Color(hex: "FFFFFF"), dark: Color(hex: "161620"))
    static let ink        = Color(light: Color(hex: "1A1A2E"), dark: Color(hex: "EDEDF0"))
    static let accent     = Color(light: Color(hex: "FF3B6F"), dark: Color(hex: "FF6B8A"))
    static let blue       = Color(light: Color(hex: "5B6EFF"), dark: Color(hex: "7B8FFF"))
    static let yellow     = Color(light: Color(hex: "FFD43B"), dark: Color(hex: "FFD84D"))
    static let mint       = Color(light: Color(hex: "2DD4A8"), dark: Color(hex: "3DE4B8"))
    static let muted      = Color(light: Color(hex: "7C7C91"), dark: Color(hex: "8B8B9F"))
    static let border     = Color(light: Color(hex: "1A1A2E"), dark: Color(hex: "3A3A48"))

    static let pinkSoft   = Color(light: Color(hex: "FFF0F5"), dark: Color(hex: "2A1520"))
    static let yellowSoft = Color(light: Color(hex: "FFFBEB"), dark: Color(hex: "2A2510"))
    static let blueSoft   = Color(light: Color(hex: "EEF2FF"), dark: Color(hex: "1A1A30"))
    static let mintSoft   = Color(light: Color(hex: "ECFDF5"), dark: Color(hex: "102A20"))

    static let shadowOffset: CGFloat = 4
    static let borderWidth: CGFloat = 2.5
}

// MARK: - Neo Button Style

struct NeoButtonStyle: ButtonStyle {
    let color: Color
    let textColor: Color

    static let accent = NeoButtonStyle(color: Neo.accent, textColor: .white)
    static let yellow = NeoButtonStyle(color: Neo.yellow, textColor: Neo.ink)
    static let mint   = NeoButtonStyle(color: Neo.mint, textColor: .white)

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .heavy))
            .textCase(.uppercase)
            .tracking(0.5)
            .foregroundColor(textColor)
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
            .background(color)
            .overlay(Rectangle().stroke(Neo.ink, lineWidth: Neo.borderWidth))
            .shadow(color: Neo.ink.opacity(0.2), radius: 0,
                    x: configuration.isPressed ? 0 : Neo.shadowOffset,
                    y: configuration.isPressed ? 0 : Neo.shadowOffset)
            .offset(x: configuration.isPressed ? Neo.shadowOffset : 0,
                    y: configuration.isPressed ? Neo.shadowOffset : 0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Neo Card

struct NeoCardModifier: ViewModifier {
    var padding: CGFloat = 16
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Neo.surface)
            .overlay(Rectangle().stroke(Neo.border, lineWidth: Neo.borderWidth))
            .shadow(color: Neo.ink.opacity(0.12), radius: 0,
                    x: Neo.shadowOffset, y: Neo.shadowOffset)
    }
}

extension View {
    func neoCard(padding: CGFloat = 16) -> some View {
        modifier(NeoCardModifier(padding: padding))
    }
}

// MARK: - Small Components

struct NeoTag: View {
    let text: String
    var color: Color = Neo.blueSoft
    var textColor: Color = Neo.blue

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .bold))
            .tracking(0.5)
            .foregroundColor(textColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color)
            .overlay(Rectangle().stroke(textColor.opacity(0.3), lineWidth: 1.5))
    }
}

struct ColorDot: View {
    let hex: String
    var body: some View {
        Circle()
            .fill(Color(hex: hex))
            .frame(width: 16, height: 16)
            .overlay(Circle().stroke(Neo.border, lineWidth: 1.5))
    }
}

// MARK: - Image Helpers

enum ImageHelper {
    static func fromBase64(_ string: String) -> UIImage? {
        guard !string.isEmpty else { return nil }
        var base64 = string
        if let range = base64.range(of: "base64,") {
            base64 = String(base64[range.upperBound...])
        }
        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
            return nil
        }
        return UIImage(data: data)
    }
}
