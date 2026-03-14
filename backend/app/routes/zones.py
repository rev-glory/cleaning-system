from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.models.zone import ZoneCreate, ZoneResponse
from app.routes.auth import get_current_user, require_manager
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/zones", tags=["zones"])

@router.post("/", response_model=ZoneResponse)
async def create_zone(zone: ZoneCreate, current_user: dict = Depends(require_manager)):
    db = get_db()

    existing = await db.zones.find_one({
        "name": zone.name,
        "building_name": zone.building_name
    })
    if existing:
        raise HTTPException(status_code=400, detail="Zone already exists in this building")

    doc = {
        "name": zone.name,
        "floor": zone.floor,
        "type": zone.type,
        "building_name": zone.building_name,
        "created_at": datetime.utcnow()
    }

    result = await db.zones.insert_one(doc)

    return ZoneResponse(
        id=str(result.inserted_id),
        name=doc["name"],
        floor=doc["floor"],
        type=doc["type"],
        building_name=doc["building_name"],
        created_at=doc["created_at"]
    )

@router.get("/", response_model=list[ZoneResponse])
async def get_zones(current_user: dict = Depends(get_current_user)):
    db = get_db()
    zones = await db.zones.find().to_list(100)
    return [
        ZoneResponse(
            id=str(z["_id"]),
            name=z["name"],
            floor=z["floor"],
            type=z["type"],
            building_name=z["building_name"],
            created_at=z["created_at"]
        )
        for z in zones
    ]

@router.get("/{zone_id}", response_model=ZoneResponse)
async def get_zone(zone_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()

    try:
        zone = await db.zones.find_one({"_id": ObjectId(zone_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid zone ID")

    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    return ZoneResponse(
        id=str(zone["_id"]),
        name=zone["name"],
        floor=zone["floor"],
        type=zone["type"],
        building_name=zone["building_name"],
        created_at=zone["created_at"]
    )

@router.delete("/{zone_id}")
async def delete_zone(zone_id: str, current_user: dict = Depends(require_manager)):
    db = get_db()

    try:
        result = await db.zones.delete_one({"_id": ObjectId(zone_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid zone ID")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zone not found")

    return {"message": "Zone deleted successfully"}