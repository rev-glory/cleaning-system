from datetime import datetime, timedelta

def compute_score(detections: list[dict]) -> tuple[int, str]:
    if not detections:
        return 95, "low"

    # Weight by confidence
    total_weight = sum(d["confidence"] for d in detections)

    # More detections + higher confidence = lower score (dirtier)
    penalty = min(total_weight * 15, 90)
    score = max(5, int(100 - penalty))

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
        notes = "High waste detected. Clean within the hour."
    elif severity == "medium":
        window = now + timedelta(hours=3)
        duration = 15
        priority = "medium"
        notes = "Moderate cleanliness issue. Schedule cleaning soon."
    else:
        window = now + timedelta(hours=8)
        duration = 10
        priority = "low"
        notes = "Space is mostly clean. Routine cleaning sufficient."

    return {
        "priority": priority,
        "suggested_window": window,
        "duration_minutes": duration,
        "status": "pending",
        "notes": notes
    }