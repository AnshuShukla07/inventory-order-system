from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app import crud, schemas, database
from app.dependencies import verify_admin_token

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)

@router.get("/", response_model=List[schemas.Product])
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return crud.get_products(db, skip=skip, limit=limit)

@router.get("/{product_id}", response_model=schemas.Product)
def read_product(product_id: int, db: Session = Depends(database.get_db)):
    db_product = crud.get_product(db, product_id=product_id)
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    return db_product

@router.post("/", response_model=schemas.Product, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_admin_token)])
def create_product(product: schemas.ProductCreate, db: Session = Depends(database.get_db)):
    return crud.create_product(db=db, product=product)

@router.put("/{product_id}", response_model=schemas.Product, dependencies=[Depends(verify_admin_token)])
def update_product(product_id: int, product_update: schemas.ProductUpdate, db: Session = Depends(database.get_db)):
    return crud.update_product(db=db, product_id=product_id, product_update=product_update)

@router.delete("/{product_id}", response_model=schemas.Product, dependencies=[Depends(verify_admin_token)])
def delete_product(product_id: int, db: Session = Depends(database.get_db)):
    return crud.delete_product(db=db, product_id=product_id)
