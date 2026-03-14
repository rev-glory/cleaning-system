from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId

class ZoneCreate(BaseModel):
    name: str
    floor: str
    type: str  # restroom, corridor, canteen, lobby, open_space
    building_name: str

class ZoneResponse(BaseModel):
    id: str
    name: str
    floor: str
    type: str
    building_name: str
    created_at: datetime

    class Config:
        arbitrary_types_allowed = True