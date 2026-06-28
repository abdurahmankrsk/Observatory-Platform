from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, Field


class CelestialObject(BaseModel):
    """Base model for any celestial object returned by the API."""
    id: str
    name: str
    type: str  # 'planet' | 'exoplanet' | 'asteroid' | 'star' | 'nebula' | 'galaxy'
    ra: Optional[float] = Field(None, description="Right Ascension in degrees")
    dec: Optional[float] = Field(None, description="Declination in degrees")
    distance_ly: Optional[float] = Field(None, description="Distance in light-years")
    distance_au: Optional[float] = Field(None, description="Distance in AU (solar system objects)")
    description: Optional[str] = None
    fun_fact: Optional[str] = None


class ExoplanetData(BaseModel):
    """Exoplanet-specific physical parameters."""
    radius_earth: Optional[float] = Field(None, description="Radius in Earth radii")
    mass_earth: Optional[float] = Field(None, description="Mass in Earth masses")
    orbital_period_days: Optional[float] = None
    semi_major_axis_au: Optional[float] = None
    star_temperature_k: Optional[float] = None
    star_radius_solar: Optional[float] = None
    equilibrium_temp_k: Optional[float] = None
    is_habitable: bool = False


class ExoplanetResponse(CelestialObject):
    """Full exoplanet response with all parameters."""
    exoplanet: Optional[ExoplanetData] = None


class AsteroidCloseApproach(BaseModel):
    """Close approach data for an asteroid."""
    date: str
    relative_velocity_km_s: float
    miss_distance_km: float
    miss_distance_au: float


class AsteroidData(BaseModel):
    """Asteroid-specific parameters."""
    diameter_min_km: Optional[float] = None
    diameter_max_km: Optional[float] = None
    is_potentially_hazardous: bool = False
    absolute_magnitude: Optional[float] = None


class AsteroidResponse(CelestialObject):
    """Full asteroid response."""
    asteroid: Optional[AsteroidData] = None
    close_approach: Optional[AsteroidCloseApproach] = None


class StarData(BaseModel):
    """Star-specific physical parameters."""
    temperature_k: Optional[float] = None
    radius_solar: Optional[float] = None
    luminosity_solar: Optional[float] = None
    spectral_type: Optional[str] = None


class StarResponse(CelestialObject):
    """Full star response."""
    star: Optional[StarData] = None


class SearchResponse(BaseModel):
    """Generic search response that wraps the typed object."""
    query: str
    results: List[CelestialObject]
    total: int


class IdentifyResponse(BaseModel):
    """Result of a coordinate (cone-search) identification."""
    found: bool
    object: Optional[CelestialObject] = None
    query_ra: float
    query_dec: float
    radius_deg: float
    separation_deg: Optional[float] = Field(
        None, description="Angular distance from the queried point to the match, in degrees"
    )


class PopularObject(BaseModel):
    """Quick-access popular object for the observatory panel."""
    id: str
    name: str
    type: str
    description: str
    thumbnail_emoji: str  # Quick visual identifier


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None
    code: int
