import Foundation
import SwiftUI
import Combine

// MARK: - Auth Manager

class AuthManager: ObservableObject {
    @Published var token: String?
    @Published var userId: String?
    @Published var displayName: String?
    @Published var isAuthenticated = false

    private let tokenKey = "styleme_token"
    private let userIdKey = "styleme_user_id"
    private let nameKey = "styleme_display_name"

    init() {
        token = UserDefaults.standard.string(forKey: tokenKey)
        userId = UserDefaults.standard.string(forKey: userIdKey)
        displayName = UserDefaults.standard.string(forKey: nameKey)
        isAuthenticated = token != nil
    }

    @MainActor
    func save(response: UserResponse) {
        token = response.token
        userId = response.userId
        displayName = response.displayName
        isAuthenticated = true
        UserDefaults.standard.set(response.token, forKey: tokenKey)
        UserDefaults.standard.set(response.userId, forKey: userIdKey)
        UserDefaults.standard.set(response.displayName, forKey: nameKey)
    }

    func register(name: String) async throws {
        let response = try await APIService.shared.register(name: name)
        await save(response: response)
    }

    @MainActor
    func logout() {
        token = nil
        userId = nil
        displayName = nil
        isAuthenticated = false
        UserDefaults.standard.removeObject(forKey: tokenKey)
        UserDefaults.standard.removeObject(forKey: userIdKey)
        UserDefaults.standard.removeObject(forKey: nameKey)
    }
}

// MARK: - API Service

class APIService {
    static let shared = APIService()

    /// Simulator: http://localhost:8000
    /// Physical device: http://<your-mac-local-ip>:8000
    /// NOTE: enable NSAllowsLocalNetworking in Info.plist (target → Info tab in Xcode)
    var baseURL = "http://localhost:8000"

    private var token: String? {
        UserDefaults.standard.string(forKey: "styleme_token")
    }

    // MARK: Generic request

    private func request(_ method: String, _ path: String, body: Data? = nil, auth: Bool = false) async throws -> Data {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if auth, let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIError.unknown }
        guard (200...299).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? ""
            throw APIError.server(http.statusCode, msg)
        }
        return data
    }

    // MARK: Auth

    func register(name: String) async throws -> UserResponse {
        let body = try JSONEncoder().encode(UserRegisterRequest(displayName: name))
        let data = try await request("POST", "/api/auth/register", body: body)
        return try JSONDecoder().decode(UserResponse.self, from: data)
    }

    // MARK: Upload (multipart)

    func uploadImages(_ images: [Data]) async throws -> [GarmentUploadResponse] {
        guard let url = URL(string: "\(baseURL)/api/upload") else {
            throw APIError.invalidURL
        }
        let boundary = "Boundary-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()
        for (i, imageData) in images.enumerated() {
            body.append("--\(boundary)\r\n")
            body.append("Content-Disposition: form-data; name=\"files\"; filename=\"image\(i).jpg\"\r\n")
            body.append("Content-Type: image/jpeg\r\n\r\n")
            body.append(imageData)
            body.append("\r\n")
        }
        body.append("--\(boundary)--\r\n")
        req.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? ""
            throw APIError.server((response as? HTTPURLResponse)?.statusCode ?? 0, msg)
        }
        return try JSONDecoder().decode([GarmentUploadResponse].self, from: data)
    }

    // MARK: Wardrobe

    func getWardrobe(search: String? = nil) async throws -> WardrobeResponse {
        var path = "/api/wardrobe"
        if let search, !search.isEmpty,
           let q = search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            path += "?search=\(q)"
        }
        let data = try await request("GET", path, auth: true)
        return try JSONDecoder().decode(WardrobeResponse.self, from: data)
    }

    func confirmGarments(_ items: [GarmentConfirmItem]) async throws -> ConfirmResponse {
        let body = try JSONEncoder().encode(GarmentConfirmRequest(items: items))
        let data = try await request("POST", "/api/wardrobe/confirm", body: body, auth: true)
        return try JSONDecoder().decode(ConfirmResponse.self, from: data)
    }

    func deleteGarment(_ id: String) async throws {
        _ = try await request("DELETE", "/api/wardrobe/\(id)", auth: true)
    }

    // MARK: Chat

    func chat(message: String, history: [[String: String]]) async throws -> ChatAPIResponse {
        let body = try JSONEncoder().encode(ChatRequest(message: message, history: history))
        let data = try await request("POST", "/api/chat", body: body, auth: true)
        return try JSONDecoder().decode(ChatAPIResponse.self, from: data)
    }
}

// MARK: - Errors

enum APIError: LocalizedError {
    case invalidURL
    case server(Int, String)
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .server(let code, let msg): return "Error \(code): \(msg)"
        case .unknown: return "Something went wrong"
        }
    }
}

// MARK: - Data helper for multipart

private extension Data {
    mutating func append(_ string: String) {
        if let data = string.data(using: .utf8) { append(data) }
    }
}
