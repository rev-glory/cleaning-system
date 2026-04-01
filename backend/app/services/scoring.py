from datetime import datetime, timedelta

def compute_score(detections: list[dict]) -> tuple[int, str]:
    if not detections:
        return 95, "low"

    # Only count detections that are on the floor or are mess indicators
    floor_detections = [
        d for d in detections
        if d.get("on_floor", True) and d.get("is_litter", False)
    ]

    # If nothing on floor — clean regardless of total detections
    if not floor_detections:
        # Small penalty for shelf/background objects
        other_penalty = len(detections) * 1.5
        score = max(75, int(100 - other_penalty))
        return score, "low"

    # Score based on floor detections only
    total_penalty = 0
    for d in floor_detections:
        confidence = d.get("confidence", 0.5)
        area_ratio = d.get("area_ratio", 0.01)
        weight = d.get("weight", 1.0)

        if area_ratio > 0.15:
            size_mult = 2.5
        elif area_ratio > 0.05:
            size_mult = 1.8
        else:
            size_mult = 1.0

        total_penalty += confidence * size_mult * weight * 10

    total_penalty = min(total_penalty, 95)
    score = max(5, int(100 - total_penalty))

    if score >= 75:
        severity = "low"
    elif score >= 50:
        severity = "medium"
    elif score >= 25:
        severity = "high"
    else:
        severity = "critical"

    return score, severity


def build_schedule(score: int, severity: str) -> dict:
    now = datetime.utcnow()
    if severity == "critical":
        window = now + timedelta(minutes=30)
        duration = 30
        priority = "urgent"
        notes = "Critical cleanliness level. Immediate attention required."
    elif severity == "high":
        window = now + timedelta(hours=1)
        duration = 20
        priority = "high"
        notes = "High clutter on floor detected. Clean within the hour."
    elif severity == "medium":
        window = now + timedelta(hours=3)
        duration = 15
        priority = "medium"
        notes = "Moderate floor clutter. Schedule cleaning soon."
    else:
        window = now + timedelta(hours=8)
        duration = 10
        priority = "low"
        notes = "Space is mostly clear. Routine cleaning sufficient."

    return {
        "priority": priority,
        "suggested_window": window,
        "duration_minutes": duration,
        "status": "pending",
        "notes": notes
    }