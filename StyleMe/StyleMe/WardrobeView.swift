import SwiftUI

struct WardrobeView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var items: [GarmentResponse] = []
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var error: String?

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Neo.background.ignoresSafeArea()

                ScrollView {
                    if isLoading && items.isEmpty {
                        loadingState
                    } else if items.isEmpty {
                        emptyState
                    } else {
                        LazyVGrid(columns: columns, spacing: 16) {
                            ForEach(items) { item in
                                GarmentCardView(item: item, onDelete: {
                                    Task { await deleteItem(item.garmentId) }
                                })
                            }
                        }
                        .padding(16)
                    }
                }
                .refreshable { await loadWardrobe() }
            }
            .navigationTitle("Wardrobe")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button(role: .destructive) {
                            auth.logout()
                        } label: {
                            Label("Logout", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Circle()
                            .fill(Neo.yellow)
                            .frame(width: 32, height: 32)
                            .overlay(
                                Text(String(auth.displayName?.prefix(1) ?? "U").uppercased())
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(Neo.ink)
                            )
                            .overlay(Circle().stroke(Neo.ink, lineWidth: 1.5))
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Search your closet...")
            .task { await loadWardrobe() }
            .task(id: searchText) {
                try? await Task.sleep(for: .milliseconds(300))
                await loadWardrobe(search: searchText.isEmpty ? nil : searchText)
            }
        }
    }

    // MARK: - States

    private var loadingState: some View {
        VStack(spacing: 16) {
            ProgressView().tint(Neo.accent)
            Text("LOADING WARDROBE...")
                .font(.system(size: 12, weight: .bold))
                .tracking(1)
                .foregroundColor(Neo.muted)
        }
        .padding(.top, 120)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "square.grid.2x2")
                .font(.system(size: 48))
                .foregroundColor(Neo.muted)

            Text("YOUR WARDROBE IS EMPTY")
                .font(.system(size: 16, weight: .black))
                .foregroundColor(Neo.ink)

            Text("Upload some clothes to get started")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Neo.muted)
        }
        .padding(.top, 120)
    }

    // MARK: - Actions

    private func loadWardrobe(search: String? = nil) async {
        isLoading = true
        do {
            let response = try await APIService.shared.getWardrobe(search: search)
            items = response.items
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func deleteItem(_ id: String) async {
        do {
            try await APIService.shared.deleteGarment(id)
            items.removeAll { $0.garmentId == id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Garment Card

struct GarmentCardView: View {
    let item: GarmentResponse
    var onDelete: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
                if let image = ImageHelper.fromBase64(item.imageBase64) {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(height: 180)
                        .clipped()
                } else {
                    Rectangle()
                        .fill(Neo.pinkSoft)
                        .frame(height: 180)
                        .overlay(
                            Image(systemName: "photo")
                                .font(.system(size: 32))
                                .foregroundColor(Neo.muted)
                        )
                }

                ColorDot(hex: item.colorHex)
                    .padding(8)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(item.garmentType.uppercased())
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.5)
                    .foregroundColor(Neo.ink)

                if !item.primaryColor.isEmpty {
                    Text(item.primaryColor)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Neo.muted)
                }

                if !item.styleTags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(item.styleTags.prefix(2), id: \.self) { tag in
                            NeoTag(text: tag)
                        }
                    }
                }
            }
            .padding(10)
        }
        .neoCard(padding: 0)
        .contextMenu {
            if let onDelete {
                Button(role: .destructive) { onDelete() } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
        }
    }
}
