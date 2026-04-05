export interface User {
  user_id: string;
  display_name: string;
  token: string;
  wardrobe_count?: number;
}

export interface GarmentExtracted {
  garment_type: string;
  sub_type: string;
  primary_color: string;
  secondary_colors: string[];
  pattern: string;
  material_estimate: string;
  season: string[];
  formality_level: number;
  style_tags: string[];
  layering_role: string;
  versatility_score: number;
  color_hex: string;
  occasion_fit: string[];
  pairs_well_with: string[];
  description: string;
  care_notes: string;
  gender_expression: string;
}

export interface GarmentUploadItem {
  garment_id: string;
  image_base64: string;
  extracted: GarmentExtracted;
  status: string;
}

export interface GarmentConfirmItem {
  garment_id: string;
  image_base64: string;
  garment_type: string;
  sub_type: string;
  primary_color: string;
  secondary_colors: string[];
  pattern: string;
  material_estimate: string;
  season: string[];
  formality_level: number;
  style_tags: string[];
  layering_role: string;
  versatility_score: number;
  color_hex: string;
  occasion_fit: string[];
  pairs_well_with: string[];
  description: string;
}

export interface EventInput {
  event_description: string;
  dress_code?: string;
  time_of_day?: string;
  weather?: string;
  vibe: string[];
  constraints?: string;
  num_outfits: number;
}

export interface OutfitItem {
  garment_id: string;
  garment_type: string;
  description: string;
  image_base64: string;
  styling_note: string;
}

export interface ColorHarmony {
  palette: string[];
  analysis: string;
}

export interface OutfitRecommendation {
  outfit_id: string;
  name: string;
  items: OutfitItem[];
  accessory_suggestions: string[];
  color_harmony: ColorHarmony;
  confidence: number;
  explanation: string;
  overall_styling: string;
}

export interface StyleDNA {
  style_archetypes: string[];
  dominant_colors: { color: string; hex: string; percentage: number }[];
  formality_range: { min: number; max: number; average: number };
  formality_distribution: Record<string, number>;
  season_coverage: Record<string, number>;
  category_breakdown: Record<string, number>;
  total_items: number;
  wardrobe_gaps: string[];
}

export interface WardrobeMatch {
  garment_id: string;
  source_id: string;
  garment_type: string;
  primary_color: string;
  description: string;
  image_base64: string;
  formality_level: number;
  season: string[];
  style_tags: string[];
  score: number | null;
}

export interface WardrobeMatchResponse {
  query: string;
  matches: WardrobeMatch[];
  count: number;
}

export interface ChatSource {
  type: string;
  color: string;
  garment_id: string;
  score: number | null;
}

export interface ChatResponse {
  reply: string;
  wardrobe_items_used: number;
  sources: ChatSource[];
  matches: WardrobeMatch[];
}
