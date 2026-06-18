from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.config import settings
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_admin_token(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized. Invalid or missing admin passcode."
        )
        
    token = authorization.split(" ")[1]
    
    # Fetch admin user
    admin_user = db.query(models.User).filter(models.User.username == "admin").first()
    
    # Initialize if not present
    if not admin_user:
        hashed_pw = pwd_context.hash(settings.ADMIN_API_KEY)
        admin_user = models.User(username="admin", hashed_password=hashed_pw)
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
    # Verify passcode
    try:
        is_valid = pwd_context.verify(token, admin_user.hashed_password)
    except Exception:
        is_valid = False
        
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized. Invalid or missing admin passcode."
        )
        
    return admin_user

