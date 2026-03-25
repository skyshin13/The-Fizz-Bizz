export interface FermentationTypeConfig {
  id: number
  value: string
  label: string
  emoji: string
  color?: string
  description?: string
  sort_order: number
}

export interface SugarType {
  id: number
  value: string
  label: string
  description?: string
  sort_order: number
}

export type FermentationType =
  | 'kombucha'
  | 'probiotic_soda'
  | 'lacto_fermentation'
  | 'alcohol_brewing'
  | 'kimchi'
  | 'water_kefir'
  | 'milk_kefir'
  | 'mead'
  | 'cider'
  | 'beer'
  | 'wine'
  | 'general'

export type ProjectStatus = 'active' | 'completed' | 'failed' | 'paused'

export interface User {
  id: number
  email: string
  username: string
  display_name?: string
  phone_number?: string
  bio?: string
  avatar_url?: string
  sms_notifications_enabled: boolean
  created_at: string
}

export interface Measurement {
  id: number
  project_id: number
  logged_at: string
  specific_gravity?: number
  ph?: number
  temperature_celsius?: number
  co2_psi?: number
  brix?: number
  alcohol_by_volume?: number
  notes?: string
}

export interface Observation {
  id: number
  project_id: number
  user_id: number
  content: string
  tags?: string[]
  photo_url?: string
  created_at: string
}

export interface Project {
  id: number
  user_id: number
  name: string
  fermentation_type: FermentationType
  status: ProjectStatus
  description?: string
  batch_size_liters?: number
  start_date?: string
  end_date?: string
  target_end_date?: string
  initial_gravity?: number
  final_gravity?: number
  initial_ph?: number
  fermentation_temp_celsius?: number
  vessel_type?: string
  notes?: string
  cover_photo_url?: string
  is_public: boolean
  created_at: string
  measurements: Measurement[]
  observations: Observation[]
}

export interface PublicUser {
  id: number
  username: string
  display_name?: string
  bio?: string
  avatar_url?: string
  created_at: string
  public_project_count: number
}

export interface PublicProject {
  id: number
  user_id: number
  name: string
  fermentation_type: FermentationType
  status: ProjectStatus
  description?: string
  cover_photo_url?: string
  created_at: string
  author_username: string
  author_display_name?: string
  measurement_count: number
}

export interface FriendRequest {
  id: number
  requester_id: number
  receiver_id: number
  status: 'pending' | 'accepted'
  created_at: string
  friend: PublicUser
}

export interface PublicUserProfile extends PublicUser {
  public_projects: PublicProject[]
  friendship_id?: number
  friendship_status?: 'pending' | 'accepted'
  is_requester?: boolean
}

export interface Reminder {
  id: number
  project_id: number
  user_id: number
  reminder_type: string
  message: string
  interval_hours: number
  next_trigger_at?: string
  is_active: boolean
  sms_enabled: boolean
  phone_number?: string
  created_at: string
}

export interface YeastProfile {
  id: number
  name: string
  strain_code?: string
  brand?: string
  yeast_type?: string
  fermentation_type?: FermentationType
  description?: string
  attenuation_min?: number
  attenuation_max?: number
  flocculation?: string
  temp_range_min_c?: number
  temp_range_max_c?: number
  alcohol_tolerance?: number
  flavor_notes?: string
  is_public: boolean
  created_at: string
  times_used?: number
  user_projects?: string[]
}

export interface RecipeIngredient {
  id: number
  recipe_id: number
  name: string
  quantity?: number
  unit?: string
  notes?: string
  is_optional: boolean
  order_index: number
}

export interface Recipe {
  id: number
  creator_id?: number
  name: string
  fermentation_type: FermentationType
  description?: string
  difficulty?: string
  batch_size_liters?: number
  estimated_duration_days?: number
  instructions?: string
  tips?: string
  is_public: boolean
  cover_photo_url?: string
  created_at: string
  ingredients: RecipeIngredient[]
}
