from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class Detection(BaseModel):
    label: str
    confidence: float
    bbox: List[int]  # [x, y, width, height]

class Schedule(BaseModel):
    priority: str        # low, medium, high, urgent
    suggested_window: datetime
    duration_minutes: int
    status: str = "pending"
    notes: Optional[str] = None

class AnalysisResponse(BaseModel):
    id: str
    zone_id: str
    zone_name: str
    submitted_by: str
    cleanliness_score: int       # 0-100 (lower = dirtier)
    severity: str                # low, medium, high, critical
    humans_detected: bool
    humans_removed: bool
    zone_map_url: Optional[str]
    detections: List[Detection]
    schedule: Schedule
    analyzed_at: datetime

class CleaningSession(BaseModel):
    analysis_id: str
    assigned_to: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    outcome: Optional[str] = None  # completed, incomplete, escalated
    notes: Optional[str] = None