from sqlalchemy.orm import Session
from sqlalchemy import func
from app import models, schemas
from fastapi import HTTPException, status
from decimal import Decimal

# --- Products CRUD ---

def get_product(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def get_product_by_sku(db: Session, sku: str):
    return db.query(models.Product).filter(models.Product.sku == sku).first()

def get_products(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Product).offset(skip).limit(limit).all()

def create_product(db: Session, product: schemas.ProductCreate):
    # Check if SKU is unique
    existing = get_product_by_sku(db, product.sku)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with SKU '{product.sku}' already exists."
        )
    db_product = models.Product(
        sku=product.sku,
        name=product.name,
        description=product.description,
        price=product.price,
        stock_quantity=product.stock_quantity
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def update_product(db: Session, product_id: int, product_update: schemas.ProductUpdate):
    db_product = get_product(db, product_id)
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    
    update_data = product_update.model_dump(exclude_unset=True)
    if "sku" in update_data and update_data["sku"] != db_product.sku:
        # Check SKU uniqueness if changed
        existing = get_product_by_sku(db, update_data["sku"])
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with SKU '{update_data['sku']}' already exists."
            )
            
    for key, value in update_data.items():
        setattr(db_product, key, value)
        
    db.commit()
    db.refresh(db_product)
    return db_product

def delete_product(db: Session, product_id: int):
    db_product = get_product(db, product_id)
    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
    
    # Check if product is in any orders
    in_orders = db.query(models.OrderItem).filter(models.OrderItem.product_id == product_id).first()
    if in_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete product that is part of existing orders."
        )
        
    db.delete(db_product)
    db.commit()
    return db_product


# --- Customers CRUD ---

def get_customer(db: Session, customer_id: int):
    return db.query(models.Customer).filter(models.Customer.id == customer_id).first()

def get_customer_by_email(db: Session, email: str):
    return db.query(models.Customer).filter(models.Customer.email == email).first()

def get_customers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Customer).offset(skip).limit(limit).all()

def create_customer(db: Session, customer: schemas.CustomerCreate):
    # Check email uniqueness
    existing = get_customer_by_email(db, customer.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Customer with email '{customer.email}' already exists."
        )
    db_customer = models.Customer(
        name=customer.name,
        email=customer.email,
        phone=customer.phone
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

def update_customer(db: Session, customer_id: int, customer_update: schemas.CustomerUpdate):
    db_customer = get_customer(db, customer_id)
    if not db_customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found."
        )
        
    update_data = customer_update.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"] != db_customer.email:
        # Check email uniqueness if changed
        existing = get_customer_by_email(db, update_data["email"])
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Customer with email '{update_data['email']}' already exists."
            )
            
    for key, value in update_data.items():
        setattr(db_customer, key, value)
        
    db.commit()
    db.refresh(db_customer)
    return db_customer

def delete_customer(db: Session, customer_id: int):
    db_customer = get_customer(db, customer_id)
    if not db_customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found."
        )
        
    # Check if customer has orders
    has_orders = db.query(models.Order).filter(models.Order.customer_id == customer_id).first()
    if has_orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete customer with existing orders."
        )
        
    db.delete(db_customer)
    db.commit()
    return db_customer


# --- Orders CRUD (incorporating business logic) ---

def get_orders(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Order).order_by(models.Order.order_date.desc()).offset(skip).limit(limit).all()

def get_order(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()

def create_order(db: Session, order_in: schemas.OrderCreate):
    # Verify customer exists
    customer = get_customer(db, order_in.customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {order_in.customer_id} not found."
        )
    
    # We will use a database transaction context to ensure atomic execution.
    # Start checking and subtracting inventory.
    # We fetch products using `with_for_update` to avoid race conditions.
    db_items = []
    total_amount = Decimal("0.00")
    
    try:
        # Create order entry first (without total_amount initially)
        db_order = models.Order(
            customer_id=order_in.customer_id,
            status="Pending",
            total_amount=0.00
        )
        db.add(db_order)
        db.flush() # Get the order ID
        
        # Track products updated to prevent duplicate queries and ensure clean updates
        # If there are duplicate product_ids in the order, consolidate them
        consolidated_items = {}
        for item in order_in.items:
            consolidated_items[item.product_id] = consolidated_items.get(item.product_id, 0) + item.quantity

        for product_id, quantity in consolidated_items.items():
            # Query product with lock (FOR UPDATE)
            product = db.query(models.Product).filter(models.Product.id == product_id).with_for_update().first()
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product with ID {product_id} not found."
                )
            
            # Business rule: Ensure orders cannot be created when product stock is insufficient.
            if product.stock_quantity < quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for product '{product.name}' (SKU: {product.sku}). Available: {product.stock_quantity}, Requested: {quantity}."
                )
            
            # Business rule: Automatic stock reduction when orders are placed.
            product.stock_quantity -= quantity
            
            # Create OrderItem entry
            item_price = Decimal(str(product.price))
            db_item = models.OrderItem(
                order_id=db_order.id,
                product_id=product_id,
                quantity=quantity,
                unit_price=item_price
            )
            db_items.append(db_item)
            
            # Add to total
            total_amount += item_price * quantity
        
        db_order.total_amount = total_amount
        db.add_all(db_items)
        db.commit()
        db.refresh(db_order)
        return db_order

    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while placing the order: {str(e)}"
        )

def update_order_status(db: Session, order_id: int, status_update: schemas.OrderUpdate):
    db_order = get_order(db, order_id)
    if not db_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found."
        )
    
    # If transitioning from another state to Cancelled, we should restore stock
    old_status = db_order.status
    new_status = status_update.status
    
    if new_status == "Cancelled" and old_status != "Cancelled":
        # Restore product inventory
        for item in db_order.items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).with_for_update().first()
            if product:
                product.stock_quantity += item.quantity
    
    db_order.status = new_status
    db.commit()
    db.refresh(db_order)
    return db_order


# --- Dashboard Stats CRUD ---
def get_dashboard_stats(db: Session):
    total_products = db.query(models.Product).count()
    total_customers = db.query(models.Customer).count()
    total_orders = db.query(models.Order).count()
    
    # Sum total amount of completed/pending orders
    total_revenue_query = db.query(func.sum(models.Order.total_amount)).filter(models.Order.status != "Cancelled").scalar()
    total_revenue = Decimal(str(total_revenue_query or "0.00"))
    
    # Find low stock products (e.g. quantity < 10)
    low_stock_products = db.query(models.Product).filter(models.Product.stock_quantity < 10).all()
    
    return schemas.DashboardStats(
        total_products=total_products,
        total_customers=total_customers,
        total_orders=total_orders,
        total_revenue=total_revenue,
        low_stock_products=low_stock_products
    )
