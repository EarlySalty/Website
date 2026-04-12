from pydantic import BaseModel
from typing import Optional

class TokenData(BaseModel):
    user_id: str
    username: str
    role: str

class User(BaseModel):
    id: str
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    role: str = "user"

class HeroBase(BaseModel):
    name: str
    tier: str = "C"
    role: Optional[str] = None
    image_url: Optional[str] = None
    abilities_json: Optional[str] = None
    stats_json: Optional[str] = None

class HeroCreate(HeroBase):
    pass

class Hero(HeroBase):
    id: str
    abilities: list = []
    stats: dict = {}

class BuildBase(BaseModel):
    hero_id: str
    name: str
    description: Optional[str] = None
    ability_order_json: Optional[str] = None
    items_json: Optional[str] = None

class BuildCreate(BuildBase):
    pass

class Build(BuildBase):
    id: str
    author_id: str
    author_name: str
    upvotes: int = 0
    downvotes: int = 0
    status: str = "pending"
    created_at: str

class BuildVote(BaseModel):
    vote: str  # "up" or "down"

class BuildReport(BaseModel):
    reason: str

class Item(BaseModel):
    id: str
    name: str
    type: Optional[str] = None
    stats_json: Optional[str] = None
    image_url: Optional[str] = None

class TierListBase(BaseModel):
    name: str
    is_public: bool = False
    tiers_json: Optional[str] = None

class TierListCreate(TierListBase):
    pass

class TierList(TierListBase):
    id: str
    owner_id: str
    owner_name: Optional[str] = None
    secret_code: Optional[str] = None
    forked_from: Optional[str] = None
    created_at: str

class PatchNoteBase(BaseModel):
    title: str
    content: str
    version: str

class PatchNoteCreate(PatchNoteBase):
    pass

class PatchNote(PatchNoteBase):
    id: str
    created_at: str

class Report(BaseModel):
    id: str
    build_id: str
    build_name: Optional[str] = None
    reporter_id: str
    reporter_name: str
    reason: str
    status: str = "open"
    created_at: str

class AnnouncementCreate(BaseModel):
    message: str

class Announcement(BaseModel):
    id: str
    message: str
    is_active: bool = True
    created_at: str

class TierHistoryEntry(BaseModel):
    id: str
    hero_id: str
    hero_name: str
    old_tier: str
    new_tier: str
    changed_by: str
    changed_at: str