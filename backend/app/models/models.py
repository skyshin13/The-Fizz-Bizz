from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text,
    ForeignKey, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum


class FermentationType(str, enum.Enum):
    KOMBUCHA = "kombucha"
    PROBIOTIC_SODA = "probiotic_soda"
    LACTO_FERMENTATION = "lacto_fermentation"
    ALCOHOL_BREWING = "alcohol_brewing"
    KIMCHI = "kimchi"
    WATER_KEFIR = "water_kefir"
    MILK_KEFIR = "milk_kefir"
    MEAD = "mead"
    CIDER = "cider"
    BEER = "beer"
    WINE = "wine"
    GENERAL = "general"


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class FriendshipStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    supabase_id = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    display_name = Column(String)
    phone_number = Column(String)
    sms_notifications_enabled = Column(Boolean, default=False)
    avatar_url = Column(String)
    bio = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    projects = relationship("FermentationProject", back_populates="owner")
    yeast_profiles = relationship("YeastProfile", back_populates="creator")
    recipes = relationship("Recipe", back_populates="creator")
    reminders = relationship("Reminder", back_populates="user")
    sent_requests = relationship("Friendship", foreign_keys="[Friendship.requester_id]", back_populates="requester")
    received_requests = relationship("Friendship", foreign_keys="[Friendship.receiver_id]", back_populates="receiver")


class FermentationProject(Base):
    __tablename__ = "fermentation_projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    fermentation_type = Column(SAEnum(FermentationType), nullable=False)
    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.ACTIVE)
    description = Column(Text)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=True)
    batch_size_liters = Column(Float)
    start_date = Column(DateTime(timezone=True))
    end_date = Column(DateTime(timezone=True))
    target_end_date = Column(DateTime(timezone=True))
    initial_gravity = Column(Float)  # OG for ABV calculation
    final_gravity = Column(Float)    # FG for ABV calculation
    initial_ph = Column(Float)
    fermentation_temp_celsius = Column(Float)
    vessel_type = Column(String)     # e.g. "mason jar", "carboy", "bucket"
    notes = Column(Text)
    cover_photo_url = Column(String)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="projects")
    recipe = relationship("Recipe", back_populates="projects")
    measurements = relationship("MeasurementLog", back_populates="project", cascade="all, delete-orphan")
    observations = relationship("ObservationNote", back_populates="project", cascade="all, delete-orphan")
    photos = relationship("ProjectPhoto", back_populates="project", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="project", cascade="all, delete-orphan")
    yeast_connections = relationship("ProjectYeastConnection", back_populates="project", cascade="all, delete-orphan")


class MeasurementLog(Base):
    __tablename__ = "measurement_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("fermentation_projects.id"), nullable=False)
    logged_at = Column(DateTime(timezone=True), server_default=func.now())
    specific_gravity = Column(Float)
    ph = Column(Float)
    temperature_celsius = Column(Float)
    co2_psi = Column(Float)
    brix = Column(Float)        # sugar content in degrees Brix
    alcohol_by_volume = Column(Float)  # calculated ABV
    notes = Column(Text)

    project = relationship("FermentationProject", back_populates="measurements")


class ObservationNote(Base):
    __tablename__ = "observation_notes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("fermentation_projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(JSON)          # e.g. ["aroma", "color", "texture"]
    photo_url = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("FermentationProject", back_populates="observations")


class ProjectPhoto(Base):
    __tablename__ = "project_photos"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("fermentation_projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    url = Column(String, nullable=False)
    caption = Column(String)
    taken_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("FermentationProject", back_populates="photos")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("fermentation_projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reminder_type = Column(String)   # "ph_check", "gravity_check", "burp", "taste", "custom"
    message = Column(String)
    interval_hours = Column(Integer)  # e.g. 48 for every 48 hours
    next_trigger_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    sms_enabled = Column(Boolean, default=False)
    phone_number = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("FermentationProject", back_populates="reminders")
    user = relationship("User", back_populates="reminders")


class YeastProfile(Base):
    __tablename__ = "yeast_profiles"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    strain_code = Column(String)      # e.g. "WLP001", "Safale US-05"
    brand = Column(String)            # e.g. "White Labs", "Fermentis"
    yeast_type = Column(String)       # "ale", "lager", "wine", "bread", "wild", "SCOBY"
    fermentation_type = Column(SAEnum(FermentationType))
    description = Column(Text)
    attenuation_min = Column(Float)   # % fermentable sugars consumed
    attenuation_max = Column(Float)
    flocculation = Column(String)     # "low", "medium", "high"
    temp_range_min_c = Column(Float)
    temp_range_max_c = Column(Float)
    alcohol_tolerance = Column(Float) # max ABV %
    flavor_notes = Column(Text)
    best_for = Column(Text)
    lab_description = Column(Text)
    recommended_styles = Column(JSON)       # list of style name strings from lab website
    is_public = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User", back_populates="yeast_profiles")
    project_connections = relationship("ProjectYeastConnection", back_populates="yeast")
    recipe_ingredients = relationship("RecipeIngredient", back_populates="yeast_profile")


class ProjectYeastConnection(Base):
    __tablename__ = "project_yeast_connections"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("fermentation_projects.id"), nullable=False)
    yeast_id = Column(Integer, ForeignKey("yeast_profiles.id"), nullable=False)
    amount_grams = Column(Float)
    pitched_at = Column(DateTime(timezone=True))
    notes = Column(Text)

    project = relationship("FermentationProject", back_populates="yeast_connections")
    yeast = relationship("YeastProfile", back_populates="project_connections")


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    fermentation_type = Column(SAEnum(FermentationType), nullable=False)
    description = Column(Text)
    difficulty = Column(String)       # "beginner", "intermediate", "advanced"
    batch_size_liters = Column(Float)
    estimated_duration_days = Column(Integer)
    instructions = Column(Text)
    tips = Column(Text)
    is_public = Column(Boolean, default=True)
    cover_photo_url = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User", back_populates="recipes")
    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan")
    projects = relationship("FermentationProject", back_populates="recipe")


class FermentationTypeConfig(Base):
    __tablename__ = "fermentation_type_configs"

    id = Column(Integer, primary_key=True, index=True)
    value = Column(String, unique=True, nullable=False)   # e.g. "kombucha"
    label = Column(String, nullable=False)                # e.g. "Kombucha"
    emoji = Column(String, nullable=False)                # e.g. "🍵"
    color = Column(String)                                # e.g. "#4a6741"
    description = Column(Text)
    sort_order = Column(Integer, default=0)


class SugarType(Base):
    __tablename__ = "sugar_types"

    id = Column(Integer, primary_key=True, index=True)
    value = Column(String, unique=True, nullable=False)   # e.g. "table_sugar"
    label = Column(String, nullable=False)                # e.g. "Table Sugar (Sucrose)"
    description = Column(Text)
    sort_order = Column(Integer, default=0)


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    name = Column(String, nullable=False)
    quantity = Column(Float)
    unit = Column(String)             # "g", "kg", "ml", "L", "cups", "tbsp", "tsp", "pieces"
    notes = Column(Text)
    is_optional = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)
    yeast_profile_id = Column(Integer, ForeignKey("yeast_profiles.id"), nullable=True)

    recipe = relationship("Recipe", back_populates="ingredients")
    yeast_profile = relationship("YeastProfile", back_populates="recipe_ingredients")


class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(FriendshipStatus), default=FriendshipStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    requester = relationship("User", foreign_keys=[requester_id], back_populates="sent_requests")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_requests")
