import SwiftUI
import PhotosUI

struct UploadView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var imageDataArray: [Data] = []
    @State private var extractedGarments: [GarmentUploadResponse] = []
    @State private var isUploading = false
    @State private var isConfirming = false
    @State private var error: String?
    @State private var showSuccess = false
    @State private var step: UploadStep = .pick

    enum UploadStep { case pick, review }

    var body: some View {
        NavigationStack {
            ZStack {
                Neo.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        switch step {
                        case .pick:   pickSection
                        case .review: reviewSection
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Upload")
            .alert("Added to Wardrobe!", isPresented: $showSuccess) {
                Button("OK") { reset() }
            } message: {
                Text("\(extractedGarments.count) item(s) saved to your wardrobe")
            }
        }
    }

    // MARK: - Pick

    private var pickSection: some View {
        VStack(spacing: 28) {
            VStack(spacing: 12) {
                Image(systemName: "camera.fill")
                    .font(.system(size: 36))
                    .foregroundColor(Neo.accent)
                    .padding(20)
                    .background(Neo.pinkSoft)
                    .overlay(Rectangle().stroke(Neo.border, lineWidth: Neo.borderWidth))

                Text("ADD TO YOUR CLOSET")
                    .font(.system(size: 20, weight: .black))
                    .tracking(1)
                    .foregroundColor(Neo.ink)

                Text("Select photos of your clothes\nand our AI will analyze them")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Neo.muted)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, 24)

            PhotosPicker(
                selection: $selectedPhotos,
                maxSelectionCount: 10,
                matching: .images
            ) {
                HStack(spacing: 10) {
                    Image(systemName: "photo.on.rectangle.angled")
                    Text("CHOOSE PHOTOS")
                }
                .font(.system(size: 15, weight: .heavy))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Neo.accent)
                .overlay(Rectangle().stroke(Neo.ink, lineWidth: Neo.borderWidth))
                .shadow(color: Neo.ink.opacity(0.2), radius: 0,
                        x: Neo.shadowOffset, y: Neo.shadowOffset)
            }
            .onChange(of: selectedPhotos) { _, items in
                Task { await loadImages(items) }
            }

            if !imageDataArray.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    Text("\(imageDataArray.count) PHOTO(S) SELECTED")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(0.5)
                        .foregroundColor(Neo.ink)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(imageDataArray.indices, id: \.self) { i in
                                if let img = UIImage(data: imageDataArray[i]) {
                                    Image(uiImage: img)
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                        .frame(width: 100, height: 100)
                                        .clipped()
                                        .overlay(Rectangle().stroke(Neo.border, lineWidth: 2))
                                }
                            }
                        }
                    }

                    Button {
                        Task { await uploadImages() }
                    } label: {
                        HStack(spacing: 8) {
                            if isUploading { ProgressView().tint(Neo.ink) }
                            Text(isUploading ? "ANALYZING..." : "UPLOAD & ANALYZE")
                        }
                        .font(.system(size: 15, weight: .heavy))
                        .foregroundColor(Neo.ink)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Neo.yellow)
                        .overlay(Rectangle().stroke(Neo.ink, lineWidth: Neo.borderWidth))
                        .shadow(color: Neo.ink.opacity(0.2), radius: 0,
                                x: Neo.shadowOffset, y: Neo.shadowOffset)
                    }
                    .disabled(isUploading)
                }
            }

            if let error {
                Text(error)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Neo.accent)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Neo.pinkSoft)
                    .overlay(Rectangle().stroke(Neo.accent.opacity(0.3), lineWidth: 1.5))
            }
        }
    }

    // MARK: - Review

    private var reviewSection: some View {
        VStack(spacing: 20) {
            HStack {
                Text("REVIEW GARMENTS")
                    .font(.system(size: 20, weight: .black))
                    .tracking(1)
                    .foregroundColor(Neo.ink)
                Spacer()
                Button("Cancel") { reset() }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Neo.muted)
            }

            ForEach(extractedGarments) { garment in
                ExtractedGarmentCard(garment: garment)
            }

            Button {
                Task { await confirmAll() }
            } label: {
                HStack(spacing: 8) {
                    if isConfirming { ProgressView().tint(.white) }
                    Text(isConfirming ? "SAVING..." : "ADD ALL TO WARDROBE")
                }
                .font(.system(size: 15, weight: .heavy))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Neo.mint)
                .overlay(Rectangle().stroke(Neo.ink, lineWidth: Neo.borderWidth))
                .shadow(color: Neo.ink.opacity(0.2), radius: 0,
                        x: Neo.shadowOffset, y: Neo.shadowOffset)
            }
            .disabled(isConfirming)

            if let error {
                Text(error)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Neo.accent)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Neo.pinkSoft)
                    .overlay(Rectangle().stroke(Neo.accent.opacity(0.3), lineWidth: 1.5))
            }
        }
    }

    // MARK: - Actions

    private func loadImages(_ items: [PhotosPickerItem]) async {
        var loaded: [Data] = []
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data),
               let jpeg = image.jpegData(compressionQuality: 0.8) {
                loaded.append(jpeg)
            }
        }
        await MainActor.run { imageDataArray = loaded }
    }

    private func uploadImages() async {
        guard !imageDataArray.isEmpty else { return }
        isUploading = true
        error = nil
        do {
            let results = try await APIService.shared.uploadImages(imageDataArray)
            await MainActor.run {
                extractedGarments = results
                step = .review
                isUploading = false
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                isUploading = false
            }
        }
    }

    private func confirmAll() async {
        isConfirming = true
        error = nil
        let confirmItems = extractedGarments.map { g in
            GarmentConfirmItem(
                garmentId: g.garmentId,
                imageBase64: g.imageBase64,
                garmentType: g.extracted.garmentType,
                subType: g.extracted.subType,
                primaryColor: g.extracted.primaryColor,
                secondaryColors: g.extracted.secondaryColors,
                pattern: g.extracted.pattern,
                materialEstimate: g.extracted.materialEstimate,
                season: g.extracted.season,
                formalityLevel: g.extracted.formalityLevel,
                styleTags: g.extracted.styleTags,
                layeringRole: g.extracted.layeringRole,
                versatilityScore: g.extracted.versatilityScore,
                colorHex: g.extracted.colorHex,
                occasionFit: g.extracted.occasionFit,
                pairsWellWith: g.extracted.pairsWellWith,
                description: g.extracted.description
            )
        }
        do {
            _ = try await APIService.shared.confirmGarments(confirmItems)
            await MainActor.run {
                isConfirming = false
                showSuccess = true
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
                isConfirming = false
            }
        }
    }

    private func reset() {
        selectedPhotos = []
        imageDataArray = []
        extractedGarments = []
        step = .pick
        error = nil
    }
}

// MARK: - Extracted Garment Card

struct ExtractedGarmentCard: View {
    let garment: GarmentUploadResponse

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let image = ImageHelper.fromBase64(garment.imageBase64) {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(height: 200)
                    .frame(maxWidth: .infinity)
                    .clipped()
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(garment.extracted.garmentType.uppercased())
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Neo.ink)

                    if !garment.extracted.subType.isEmpty {
                        Text("· \(garment.extracted.subType)")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Neo.muted)
                    }

                    Spacer()
                    ColorDot(hex: garment.extracted.colorHex)
                }

                if !garment.extracted.description.isEmpty {
                    Text(garment.extracted.description)
                        .font(.system(size: 13))
                        .foregroundColor(Neo.muted)
                        .lineLimit(2)
                }

                FlowTags(garment: garment)
            }
            .padding(12)
        }
        .neoCard(padding: 0)
    }
}

struct FlowTags: View {
    let garment: GarmentUploadResponse

    var body: some View {
        HStack(spacing: 6) {
            if !garment.extracted.primaryColor.isEmpty {
                NeoTag(text: garment.extracted.primaryColor,
                       color: Neo.pinkSoft, textColor: Neo.accent)
            }
            if !garment.extracted.pattern.isEmpty {
                NeoTag(text: garment.extracted.pattern)
            }
            ForEach(garment.extracted.season.prefix(2), id: \.self) { s in
                NeoTag(text: s, color: Neo.mintSoft, textColor: Neo.mint)
            }
        }
    }
}
