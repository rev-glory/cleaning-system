from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.database import get_db
from app.models.user import UserCreate, UserResponse, TokenResponse
from app.services.auth import hash_password, verify_password, create_access_token, decode_token
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate):
    db = get_db()
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    if user.role not in ["staff", "manager"]:
        raise HTTPException(status_code=400, detail="Role must be staff or manager")
    doc = {
        "name": user.name,
        "email": user.email,
        "password_hash": hash_password(user.password),
        "role": user.role,
        "created_at": datetime.utcnow()
    }
    result = await db.users.insert_one(doc)
    return UserResponse(
        id=str(result.inserted_id),
        name=doc["name"],
        email=doc["email"],
        role=doc["role"],
        created_at=doc["created_at"]
    )

@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    db = get_db()
    user = await db.users.find_one({"email": form.username})
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"]
    })
    return TokenResponse(access_token=token)

# get_current_user must be defined BEFORE get_me and require_manager
async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "name": user["name"]
    }

async def require_manager(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return current_user

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user