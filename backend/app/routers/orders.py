from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app import crud, schemas, database
from app.dependencies import verify_admin_token

router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)

@router.get("/", response_model=List[schemas.Order])
def read_orders(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return crud.get_orders(db, skip=skip, limit=limit)

@router.get("/{order_id}", response_model=schemas.Order)
def read_order(order_id: int, db: Session = Depends(database.get_db)):
    db_order = crud.get_order(db, order_id=order_id)
    if not db_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found."
        )
    return db_order

@router.post("/", response_model=schemas.Order, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_admin_token)])
def create_order(order: schemas.OrderCreate, db: Session = Depends(database.get_db)):
    return crud.create_order(db=db, order_in=order)

@router.put("/{order_id}/status", response_model=schemas.Order, dependencies=[Depends(verify_admin_token)])
def update_order_status(order_id: int, status_update: schemas.OrderUpdate, db: Session = Depends(database.get_db)):
    return crud.update_order_status(db=db, order_id=order_id, status_update=status_update)
