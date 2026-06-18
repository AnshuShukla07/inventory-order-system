from fastapi import Header, HTTPException, status
from app.config import settings

def verify_admin_token(authorization: str = Header(None)):
    # If ADMIN_API_KEY is not set (e.g. empty string), we skip security for easier local testing.
    # But if it is set, we strictly enforce it.
    if not settings.ADMIN_API_KEY:
        return
        
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        
    if token != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized. Invalid or missing admin passcode."
        )
