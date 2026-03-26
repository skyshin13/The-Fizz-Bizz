from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Any
from datetime import datetime
from app.models.models import FermentationType, ProjectStatus


# ─── Auth Schemas ───────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    username: str
    password: str
    display_name: Optional[str] = None
    phone_number: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v):
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username must be alphanumeric (underscores/hyphens allowed)")
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be 3–32 characters")
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


# ─── User Schemas ────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    email: EmailStr
    username: str
    display_name: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None


class UserOut(UserBase):
    id: int
    avatar_url: Optional[str] = None
    sms_notifications_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    sms_notifications_enabled: Optional[bool] = None


# ─── Measurement Schemas ─────────────────────────────────────────────────────

class MeasurementCreate(BaseModel):
    specific_gravity: Optional[float] = None
    ph: Optional[float] = None
    temperature_celsius: Optional[float] = None
    co2_psi: Optional[float] = None
    brix: Optional[float] = None
    notes: Optional[str] = None


class MeasurementOut(MeasurementCreate):
    id: int
    project_id: int
    logged_at: datetime
    alcohol_by_volume: Optional[float] = None

    class Config:
        from_attributes = True


# ─── Observation Schemas ──────────────────────────────────────────────────────

class ObservationCreate(BaseModel):
    content: str
    tags: Optional[List[str]] = None
    photo_url: Optional[str] = None


class ObservationOut(ObservationCreate):
    id: int
    project_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Photo Schemas ────────────────────────────────────────────────────────────

class PhotoOut(BaseModel):
    id: int
    project_id: int
    url: str
    caption: Optional[str] = None
    taken_at: datetime

    class Config:
        from_attributes = True


# ─── Reminder Schemas ─────────────────────────────────────────────────────────

class ReminderCreate(BaseModel):
    reminder_type: str
    message: str
    interval_hours: int
    sms_enabled: bool = False
    phone_number: Optional[str] = None


class ReminderOut(ReminderCreate):
    id: int
    project_id: int
    user_id: int
    next_trigger_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Project Schemas ──────────────────────────────────────────────────────────

class ProjectYeastOut(BaseModel):
    yeast_id: int
    name: str
    strain_code: Optional[str] = None
    brand: Optional[str] = None
    yeast_type: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    name: str
    fermentation_type: FermentationType
    description: Optional[str] = None
    recipe_id: Optional[int] = None
    batch_size_liters: Optional[float] = None
    start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    initial_gravity: Optional[float] = None
    initial_ph: Optional[float] = None
    fermentation_temp_celsius: Optional[float] = None
    vessel_type: Optional[str] = None
    notes: Optional[str] = None
    cover_photo_url: Optional[str] = None
    is_public: bool = False
    yeast_id: Optional[int] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[ProjectStatus] = None
    description: Optional[str] = None
    final_gravity: Optional[float] = None
    end_date: Optional[datetime] = None
    notes: Optional[str] = None
    is_public: Optional[bool] = None


class ProjectOut(BaseModel):
    id: int
    user_id: int
    name: str
    fermentation_type: FermentationType
    status: ProjectStatus
    description: Optional[str] = None
    batch_size_liters: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    initial_gravity: Optional[float] = None
    final_gravity: Optional[float] = None
    initial_ph: Optional[float] = None
    fermentation_temp_celsius: Optional[float] = None
    vessel_type: Optional[str] = None
    notes: Optional[str] = None
    cover_photo_url: Optional[str] = None
    is_public: bool = False
    created_at: datetime
    measurements: List[MeasurementOut] = []
    observations: List[ObservationOut] = []
    yeast_strain: Optional[ProjectYeastOut] = None

    class Config:
        from_attributes = True


# ─── Yeast Schemas ────────────────────────────────────────────────────────────

class YeastProfileCreate(BaseModel):
    name: str
    strain_code: Optional[str] = None
    brand: Optional[str] = None
    yeast_type: Optional[str] = None
    fermentation_type: Optional[FermentationType] = None
    description: Optional[str] = None
    attenuation_min: Optional[float] = None
    attenuation_max: Optional[float] = None
    flocculation: Optional[str] = None
    temp_range_min_c: Optional[float] = None
    temp_range_max_c: Optional[float] = None
    alcohol_tolerance: Optional[float] = None
    flavor_notes: Optional[str] = None


class YeastProfileOut(YeastProfileCreate):
    id: int
    creator_id: Optional[int] = None
    is_public: bool
    created_at: datetime
    times_used: Optional[int] = 0
    user_projects: Optional[List[str]] = []

    class Config:
        from_attributes = True


# ─── Recipe Schemas ───────────────────────────────────────────────────────────

class RecipeIngredientCreate(BaseModel):
    name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    is_optional: bool = False
    order_index: int = 0


class RecipeIngredientOut(RecipeIngredientCreate):
    id: int
    recipe_id: int

    class Config:
        from_attributes = True


class RecipeCreate(BaseModel):
    name: str
    fermentation_type: FermentationType
    description: Optional[str] = None
    difficulty: Optional[str] = "beginner"
    batch_size_liters: Optional[float] = None
    estimated_duration_days: Optional[int] = None
    instructions: Optional[str] = None
    tips: Optional[str] = None
    ingredients: List[RecipeIngredientCreate] = []


class RecipeOut(BaseModel):
    id: int
    creator_id: Optional[int] = None
    name: str
    fermentation_type: FermentationType
    description: Optional[str] = None
    difficulty: Optional[str] = None
    batch_size_liters: Optional[float] = None
    estimated_duration_days: Optional[int] = None
    instructions: Optional[str] = None
    tips: Optional[str] = None
    is_public: bool
    cover_photo_url: Optional[str] = None
    created_at: datetime
    ingredients: List[RecipeIngredientOut] = []

    class Config:
        from_attributes = True


# ─── Lookup Schemas ──────────────────────────────────────────────────────────

class FermentationTypeConfigOut(BaseModel):
    id: int
    value: str
    label: str
    emoji: str
    color: Optional[str] = None
    description: Optional[str] = None
    sort_order: int

    class Config:
        from_attributes = True


class SugarTypeOut(BaseModel):
    id: int
    value: str
    label: str
    description: Optional[str] = None
    sort_order: int

    class Config:
        from_attributes = True


# ─── Calculations ────────────────────────────────────────────────────────────

class ABVCalculationRequest(BaseModel):
    original_gravity: float
    final_gravity: float


class ABVCalculationResponse(BaseModel):
    abv_percent: float
    attenuation_percent: float
    calories_per_12oz: float


class PrimingSugarRequest(BaseModel):
    batch_size_liters: float
    current_gravity: float
    target_co2_volumes: float   # typical: 2.5 for beer, 3.5 for soda
    fermentation_temp_celsius: float
    sugar_type: str = "table_sugar"  # "table_sugar", "corn_sugar", "honey", "DME"


class PrimingSugarResponse(BaseModel):
    sugar_grams: float
    sugar_oz: float
    sugar_type: str
    notes: str


class CO2ActivityResponse(BaseModel):
    status: str          # "active", "stalling", "ready_to_bottle", "ready_to_burp"
    message: str
    slope: Optional[float] = None
    recommendation: str


# ─── Social Schemas ───────────────────────────────────────────────────────────

class PublicUserOut(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    public_project_count: int = 0

    class Config:
        from_attributes = True


class PublicProjectOut(BaseModel):
    id: int
    user_id: int
    name: str
    fermentation_type: FermentationType
    status: ProjectStatus
    description: Optional[str] = None
    cover_photo_url: Optional[str] = None
    created_at: datetime
    author_username: str
    author_display_name: Optional[str] = None
    measurement_count: int = 0

    class Config:
        from_attributes = True


class FriendshipOut(BaseModel):
    id: int
    requester_id: int
    receiver_id: int
    status: str
    created_at: datetime
    friend: PublicUserOut

    class Config:
        from_attributes = True


class PublicUserProfileOut(PublicUserOut):
    public_projects: List[PublicProjectOut] = []
    friendship_id: Optional[int] = None
    friendship_status: Optional[str] = None
    is_requester: Optional[bool] = None
