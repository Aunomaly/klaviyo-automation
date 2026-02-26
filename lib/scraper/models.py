"""
Data models for brand extraction
"""
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List
from enum import Enum


class ColorType(str, Enum):
    PRIMARY = "primary"
    SECONDARY = "secondary"
    ACCENT = "accent"
    BACKGROUND = "background"
    TEXT = "text"


class ExtractedColor(BaseModel):
    """Represents an extracted color with its source"""
    hex: str
    rgb: tuple[int, int, int]
    source: str  # Where it was found (e.g., "css", "meta", "image")
    frequency: int = 1  # How often it appears
    type: Optional[ColorType] = None


class ExtractedFont(BaseModel):
    """Represents an extracted font family"""
    family: str
    source: str  # "css", "google_fonts", "adobe_fonts"
    weight: Optional[str] = None
    is_heading: bool = False
    is_body: bool = False


class ExtractedImage(BaseModel):
    """Represents an extracted image asset"""
    url: str
    type: str  # "logo", "favicon", "og_image", "hero", "product", "lifestyle", "content"
    width: Optional[int] = None
    height: Optional[int] = None
    alt: Optional[str] = None
    context: Optional[str] = None  # Where the image was found (for debugging/display)


class SocialLink(BaseModel):
    """Social media link"""
    platform: str  # "instagram", "facebook", "twitter", etc.
    url: str


class BrandData(BaseModel):
    """Complete extracted brand data"""
    # Basic info
    name: str
    website_url: str
    tagline: Optional[str] = None
    
    # Colors
    colors: List[ExtractedColor] = Field(default_factory=list)
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    
    # Typography
    fonts: List[ExtractedFont] = Field(default_factory=list)
    font_primary: str = "Helvetica, Arial, sans-serif"
    font_secondary: str = "Georgia, serif"
    
    # Images
    images: List[ExtractedImage] = Field(default_factory=list)
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    
    # Social
    social_links: List[SocialLink] = Field(default_factory=list)
    
    # Metadata
    extraction_success: bool = True
    extraction_errors: List[str] = Field(default_factory=list)
    
    def to_brand_insert(self) -> dict:
        """Convert to Supabase brand insert format"""
        return {
            "name": self.name,
            "website_url": self.website_url,
            "primary_color": self.primary_color,
            "secondary_color": self.secondary_color,
            "accent_color": self.accent_color,
            "font_primary": self.font_primary,
            "font_secondary": self.font_secondary,
            "logo_url": self.logo_url,
            "favicon_url": self.favicon_url,
        }
