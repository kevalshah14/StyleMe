import Foundation

// MARK: - Auth

struct UserRegisterRequest: Codable {
    let displayName: String
    enum CodingKeys: String, CodingKey { case displayName = "display_name" }
}

struct UserLoginRequest: Codable {
    let userId: String
    enum CodingKeys: String, CodingKey { case userId = "user_id" }
}

struct UserResponse: Codable {
    let userId: String
    let displayName: String
    let token: String
    let wardrobeCount: Int

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case displayName = "display_name"
        case token
        case wardrobeCount = "wardrobe_count"
    }
}

// MARK: - Garment Extraction

struct GarmentExtracted: Codable {
    var garmentType: String = ""
    var subType: String = ""
    var primaryColor: String = ""
    var secondaryColors: [String] = []
    var pattern: String = ""
    var materialEstimate: String = ""
    var season: [String] = []
    var formalityLevel: Int = 5
    var styleTags: [String] = []
    var layeringRole: String = "inner"
    var versatilityScore: Int = 5
    var colorHex: String = "#808080"
    var occasionFit: [String] = []
    var pairsWellWith: [String] = []
    var description: String = ""
    var careNotes: String = ""
    var genderExpression: String = "neutral"

    enum CodingKeys: String, CodingKey {
        case garmentType = "garment_type"
        case subType = "sub_type"
        case primaryColor = "primary_color"
        case secondaryColors = "secondary_colors"
        case pattern
        case materialEstimate = "material_estimate"
        case season
        case formalityLevel = "formality_level"
        case styleTags = "style_tags"
        case layeringRole = "layering_role"
        case versatilityScore = "versatility_score"
        case colorHex = "color_hex"
        case occasionFit = "occasion_fit"
        case pairsWellWith = "pairs_well_with"
        case description
        case careNotes = "care_notes"
        case genderExpression = "gender_expression"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        garmentType = (try? c.decode(String.self, forKey: .garmentType)) ?? ""
        subType = (try? c.decode(String.self, forKey: .subType)) ?? ""
        primaryColor = (try? c.decode(String.self, forKey: .primaryColor)) ?? ""
        secondaryColors = (try? c.decode([String].self, forKey: .secondaryColors)) ?? []
        pattern = (try? c.decode(String.self, forKey: .pattern)) ?? ""
        materialEstimate = (try? c.decode(String.self, forKey: .materialEstimate)) ?? ""
        season = (try? c.decode([String].self, forKey: .season)) ?? []
        formalityLevel = (try? c.decode(Int.self, forKey: .formalityLevel)) ?? 5
        styleTags = (try? c.decode([String].self, forKey: .styleTags)) ?? []
        layeringRole = (try? c.decode(String.self, forKey: .layeringRole)) ?? "inner"
        versatilityScore = (try? c.decode(Int.self, forKey: .versatilityScore)) ?? 5
        colorHex = (try? c.decode(String.self, forKey: .colorHex)) ?? "#808080"
        occasionFit = (try? c.decode([String].self, forKey: .occasionFit)) ?? []
        pairsWellWith = (try? c.decode([String].self, forKey: .pairsWellWith)) ?? []
        description = (try? c.decode(String.self, forKey: .description)) ?? ""
        careNotes = (try? c.decode(String.self, forKey: .careNotes)) ?? ""
        genderExpression = (try? c.decode(String.self, forKey: .genderExpression)) ?? "neutral"
    }

    init() {}
}

struct GarmentUploadResponse: Codable, Identifiable {
    let garmentId: String
    let imageBase64: String
    let extracted: GarmentExtracted
    let status: String
    var id: String { garmentId }

    enum CodingKeys: String, CodingKey {
        case garmentId = "garment_id"
        case imageBase64 = "image_base64"
        case extracted, status
    }
}

// MARK: - Wardrobe Confirm

struct GarmentConfirmItem: Codable {
    let garmentId: String
    let imageBase64: String
    let garmentType: String
    var subType: String = ""
    let primaryColor: String
    var secondaryColors: [String] = []
    var pattern: String = ""
    var materialEstimate: String = ""
    var season: [String] = []
    var formalityLevel: Int = 5
    var styleTags: [String] = []
    var layeringRole: String = "inner"
    var versatilityScore: Int = 5
    var colorHex: String = "#808080"
    var occasionFit: [String] = []
    var pairsWellWith: [String] = []
    var description: String = ""

    enum CodingKeys: String, CodingKey {
        case garmentId = "garment_id"
        case imageBase64 = "image_base64"
        case garmentType = "garment_type"
        case subType = "sub_type"
        case primaryColor = "primary_color"
        case secondaryColors = "secondary_colors"
        case pattern
        case materialEstimate = "material_estimate"
        case season
        case formalityLevel = "formality_level"
        case styleTags = "style_tags"
        case layeringRole = "layering_role"
        case versatilityScore = "versatility_score"
        case colorHex = "color_hex"
        case occasionFit = "occasion_fit"
        case pairsWellWith = "pairs_well_with"
        case description
    }
}

struct GarmentConfirmRequest: Codable {
    let items: [GarmentConfirmItem]
}

struct ConfirmResponse: Codable {
    let saved: Int
    let garmentIds: [String]
    let failed: Int
    let failedIds: [String]

    enum CodingKeys: String, CodingKey {
        case saved
        case garmentIds = "garment_ids"
        case failed
        case failedIds = "failed_ids"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        saved = (try? c.decode(Int.self, forKey: .saved)) ?? 0
        garmentIds = (try? c.decode([String].self, forKey: .garmentIds)) ?? []
        failed = (try? c.decode(Int.self, forKey: .failed)) ?? 0
        failedIds = (try? c.decode([String].self, forKey: .failedIds)) ?? []
    }
}

// MARK: - Wardrobe Response

struct GarmentResponse: Codable, Identifiable {
    var garmentId: String = ""
    var garmentType: String = ""
    var subType: String = ""
    var primaryColor: String = ""
    var colorHex: String = "#808080"
    var pattern: String = ""
    var formalityLevel: Int = 5
    var season: [String] = []
    var styleTags: [String] = []
    var layeringRole: String = ""
    var versatilityScore: Int = 5
    var occasionFit: [String] = []
    var description: String = ""
    var imageBase64: String = ""
    var timesWorn: Int = 0

    var id: String { garmentId }

    enum CodingKeys: String, CodingKey {
        case garmentId = "garment_id"
        case garmentType = "garment_type"
        case subType = "sub_type"
        case primaryColor = "primary_color"
        case colorHex = "color_hex"
        case pattern
        case formalityLevel = "formality_level"
        case season
        case styleTags = "style_tags"
        case layeringRole = "layering_role"
        case versatilityScore = "versatility_score"
        case occasionFit = "occasion_fit"
        case description
        case imageBase64 = "image_base64"
        case timesWorn = "times_worn"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        garmentId = (try? c.decode(String.self, forKey: .garmentId)) ?? ""
        garmentType = (try? c.decode(String.self, forKey: .garmentType)) ?? ""
        subType = (try? c.decode(String.self, forKey: .subType)) ?? ""
        primaryColor = (try? c.decode(String.self, forKey: .primaryColor)) ?? ""
        colorHex = (try? c.decode(String.self, forKey: .colorHex)) ?? "#808080"
        pattern = (try? c.decode(String.self, forKey: .pattern)) ?? ""
        formalityLevel = (try? c.decode(Int.self, forKey: .formalityLevel)) ?? 5
        season = (try? c.decode([String].self, forKey: .season)) ?? []
        styleTags = (try? c.decode([String].self, forKey: .styleTags)) ?? []
        layeringRole = (try? c.decode(String.self, forKey: .layeringRole)) ?? ""
        versatilityScore = (try? c.decode(Int.self, forKey: .versatilityScore)) ?? 5
        occasionFit = (try? c.decode([String].self, forKey: .occasionFit)) ?? []
        description = (try? c.decode(String.self, forKey: .description)) ?? ""
        imageBase64 = (try? c.decode(String.self, forKey: .imageBase64)) ?? ""
        timesWorn = (try? c.decode(Int.self, forKey: .timesWorn)) ?? 0
    }

    init() {}
}

struct WardrobeResponse: Codable {
    let items: [GarmentResponse]
    let total: Int

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        items = (try? c.decode([GarmentResponse].self, forKey: .items)) ?? []
        total = (try? c.decode(Int.self, forKey: .total)) ?? 0
    }
}

// MARK: - Chat

struct ChatRequest: Codable {
    let message: String
    let history: [[String: String]]
}

struct WebSource: Codable {
    var title: String = ""
    var url: String = ""

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        url = (try? c.decode(String.self, forKey: .url)) ?? ""
    }
}

struct ChatAPIResponse: Codable {
    let reply: String
    var wardrobeItemsUsed: Int = 0
    var webSources: [WebSource] = []

    enum CodingKeys: String, CodingKey {
        case reply
        case wardrobeItemsUsed = "wardrobe_items_used"
        case webSources = "web_sources"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        reply = (try? c.decode(String.self, forKey: .reply)) ?? ""
        wardrobeItemsUsed = (try? c.decode(Int.self, forKey: .wardrobeItemsUsed)) ?? 0
        webSources = (try? c.decode([WebSource].self, forKey: .webSources)) ?? []
    }
}

// MARK: - Local UI Message

struct ChatBubbleMessage: Identifiable {
    let id = UUID()
    let role: String
    let content: String
    let timestamp = Date()
}
