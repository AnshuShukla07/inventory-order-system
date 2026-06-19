from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import engine, Base, get_db
from app.routers import products, customers, orders
from app import crud, schemas
from app.dependencies import verify_admin_token

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Inventory & Order Management System API",
    description="Backend API for managing products, customers, orders, and inventory tracking.",
    version="1.0.0"
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(products.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(orders.router, prefix="/api")

@app.post("/api/admin/change-password", tags=["Admin Auth"])
def change_admin_password(
    data: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    admin_user = Depends(verify_admin_token)
):
    from app.dependencies import pwd_context
    if not pwd_context.verify(data.current_password, admin_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current passcode."
        )
    admin_user.hashed_password = pwd_context.hash(data.new_password)
    db.commit()
    return {"message": "Admin passcode updated successfully."}

@app.get("/")
def read_root():
    return {
        "message": "Welcome to the Inventory & Order Management System API",
        "docs_url": "/docs"
    }

@app.get("/api/dashboard-stats", response_model=schemas.DashboardStats, tags=["Dashboard"])
def get_dashboard_stats(db: Session = Depends(get_db)):
    return crud.get_dashboard_stats(db)

# Trigger backend redeploy on Render
