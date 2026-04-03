import torch
import gc
import numpy as np
import cv2
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from app.database import get_db
from app.routes.auth import get_current_user
from app.services.privacy import remove_humans, scrub_faces
from app.services.detection import run_detection, draw_zone_map
from app.services.scoring import compute_score, build_schedule
from datetime import datetime, timezone
from bson import ObjectId
from PIL import Image
import cloudinary
import cloudinary.uploader
import io
from app.config import settings

router = APIRouter(prefix="/analyze", tags=["analyze"])

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)

@router.post("/")
async def analyze_image(
    zone_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    db = get_db()

    try:
        zone = await db.zones.find_one({"_id": ObjectId(zone_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid zone ID")
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Only JPEG and PNG images accepted")

    try:
        raw_bytes = await file.read()
        image = Image.open(io.BytesIO(raw_bytes))
        image = image.convert("RGB")

        # FIX 1: Downscale immediately to prevent massive RAM spikes
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        
        # FIX 2: Convert to OpenCV BGR array once
        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        # Nuke raw data immediately
        del image
        del raw_bytes

        # Pass the single cv_image around
        cv_image, humans_detected = remove_humans(cv_image)
        cv_image = scrub_faces(cv_image)
        detections = run_detection(cv_image)
        cv_image = draw_zone_map(cv_image, detections)

        score, severity = compute_score(detections)
        schedule = build_schedule(score, severity)

        # Upload zone map
        zone_map_url = None
        try:
            # FIX 3: Convert the cv_image back to PIL ONLY for saving/uploading
            final_pil = Image.fromarray(cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB))
            buf = io.BytesIO()
            final_pil.save(buf, format="JPEG", quality=85)
            buf.seek(0)
            upload_result = cloudinary.uploader.upload(
                buf,
                folder="cleaning_system/zone_maps",
                public_id=f"zone_{zone_id}_{int(datetime.now(timezone.utc).timestamp())}",
                overwrite=True
            )
            zone_map_url = upload_result.get("secure_url")
            del final_pil # Nuke final PIL image
        except Exception as e:
            print(f"Cloudinary upload warning: {e}")

        doc = {
            "zone_id": zone_id,
            "zone_name": zone["name"],
            "submitted_by": current_user["id"],
            "cleanliness_score": score,
            "severity": severity,
            "humans_detected": humans_detected,
            "humans_removed": humans_detected,
            "zone_map_url": zone_map_url,
            "detections": detections,
            "schedule": schedule,
            "analyzed_at": datetime.now(timezone.utc)
        }

        result = await db.analyses.insert_one(doc)

        response_data = {
            "id": str(result.inserted_id),
            "zone_id": zone_id,
            "zone_name": zone["name"],
            "cleanliness_score": score,
            "severity": severity,
            "humans_detected": humans_detected,
            "humans_removed": humans_detected,
            "zone_map_url": zone_map_url,
            "detections": detections,
            "schedule": schedule,
            "analyzed_at": doc["analyzed_at"]
        }

        return response_data

    finally:
        # FIX 4: Guaranteed memory cleanup even if a crash occurs
        if 'cv_image' in locals():
            del cv_image
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


@router.get("/history/{zone_id}")
async def get_zone_history(
    zone_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    analyses = await db.analyses.find(
        {"zone_id": zone_id}
    ).sort("analyzed_at", -1).to_list(50)

    return [
        {
            "id": str(a["_id"]),
            "cleanliness_score": a["cleanliness_score"],
            "severity": a["severity"],
            "detections_count": len(a.get("detections", [])),
            "schedule_status": a.get("schedule", {}).get("status") if a.get("schedule") else None,
            "schedule_priority": a.get("schedule", {}).get("priority") if a.get("schedule") else None,
            "suggested_window": a.get("schedule", {}).get("suggested_window") if a.get("schedule") else None,
            "zone_map_url": a.get("zone_map_url"),
            "analyzed_at": a["analyzed_at"]
        }
        for a in analyses
    ]


@router.patch("/session/{analysis_id}/complete")
async def complete_session(
    analysis_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    try:
        result = await db.analyses.update_one(
            {"_id": ObjectId(analysis_id)},
            {"$set": {
                "schedule.status": "completed",
                "schedule.completed_at": datetime.now(timezone.utc),
                "schedule.completed_by": current_user["id"]
            }}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid analysis ID")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return {"message": "Cleaning session marked as completed"}