import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app
from decimal import Decimal

# Setup SQLite test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_api.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override database dependency in FastAPI app
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

# Default auth headers for modifying requests
auth_headers = {"Authorization": "Bearer admin123"}

@pytest.fixture(autouse=True)
def run_around_tests():
    # Setup: Create database tables
    Base.metadata.create_all(bind=engine)
    yield
    # Teardown: Drop database tables
    Base.metadata.drop_all(bind=engine)

def test_unauthorized_actions_rejected():
    # Attempt to create product without auth header
    res_product = client.post(
        "/api/products/",
        json={"sku": "PROD-1", "name": "Test Product", "price": 10.99, "stock_quantity": 50}
    )
    assert res_product.status_code == 401
    
    # Attempt to create customer without auth header
    res_customer = client.post(
        "/api/customers/",
        json={"name": "Alice", "email": "alice@example.com"}
    )
    assert res_customer.status_code == 401

def test_create_product_success():
    # Test valid product creation
    response = client.post(
        "/api/products/",
        json={"sku": "PROD-1", "name": "Test Product", "description": "Desc", "price": 10.99, "stock_quantity": 50},
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["sku"] == "PROD-1"
    assert data["name"] == "Test Product"
    assert float(data["price"]) == 10.99
    assert data["stock_quantity"] == 50

def test_create_product_sku_uniqueness():
    # Create first product
    client.post(
        "/api/products/",
        json={"sku": "PROD-1", "name": "First Product", "price": 10.00, "stock_quantity": 10},
        headers=auth_headers
    )
    # Attempt to create second product with duplicate SKU
    response = client.post(
        "/api/products/",
        json={"sku": "PROD-1", "name": "Second Product", "price": 12.00, "stock_quantity": 5},
        headers=auth_headers
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_create_customer_success():
    # Test valid customer creation
    response = client.post(
        "/api/customers/",
        json={"name": "Alice", "email": "alice@example.com", "phone": "1234567890"},
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Alice"
    assert data["email"] == "alice@example.com"

def test_create_customer_email_uniqueness():
    # Create first customer
    client.post(
        "/api/customers/",
        json={"name": "Alice", "email": "alice@example.com"},
        headers=auth_headers
    )
    # Attempt to create second customer with same email
    response = client.post(
        "/api/customers/",
        json={"name": "Bob", "email": "alice@example.com"},
        headers=auth_headers
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_order_creation_success_and_stock_reduction():
    # 1. Create a customer
    res_cust = client.post("/api/customers/", json={"name": "Alice", "email": "alice@example.com"}, headers=auth_headers)
    cust_id = res_cust.json()["id"]

    # 2. Create products with stock
    res_p1 = client.post("/api/products/", json={"sku": "P1", "name": "Product 1", "price": 10.00, "stock_quantity": 100}, headers=auth_headers)
    res_p2 = client.post("/api/products/", json={"sku": "P2", "name": "Product 2", "price": 20.00, "stock_quantity": 50}, headers=auth_headers)
    p1_id = res_p1.json()["id"]
    p2_id = res_p2.json()["id"]

    # 3. Create an order
    order_payload = {
        "customer_id": cust_id,
        "items": [
            {"product_id": p1_id, "quantity": 10},
            {"product_id": p2_id, "quantity": 5}
        ]
    }
    response = client.post("/api/orders/", json=order_payload, headers=auth_headers)
    assert response.status_code == 201
    order_data = response.json()
    assert float(order_data["total_amount"]) == (10.00 * 10) + (20.00 * 5) # 200.00
    assert order_data["status"] == "Pending"

    # 4. Verify stock is reduced
    res_check_p1 = client.get(f"/api/products/{p1_id}")
    res_check_p2 = client.get(f"/api/products/{p2_id}")
    assert res_check_p1.json()["stock_quantity"] == 90 # 100 - 10
    assert res_check_p2.json()["stock_quantity"] == 45 # 50 - 5

def test_order_creation_fails_insufficient_stock():
    # 1. Create customer
    res_cust = client.post("/api/customers/", json={"name": "Alice", "email": "alice@example.com"}, headers=auth_headers)
    cust_id = res_cust.json()["id"]

    # 2. Create product with low stock
    res_p = client.post("/api/products/", json={"sku": "P1", "name": "Low Stock Product", "price": 10.00, "stock_quantity": 5}, headers=auth_headers)
    p_id = res_p.json()["id"]

    # 3. Create order exceeding stock
    order_payload = {
        "customer_id": cust_id,
        "items": [
            {"product_id": p_id, "quantity": 6} # requested 6, only 5 available
        ]
    }
    response = client.post("/api/orders/", json=order_payload, headers=auth_headers)
    assert response.status_code == 400
    assert "Insufficient stock" in response.json()["detail"]

    # 4. Verify stock remains unchanged
    res_check_p = client.get(f"/api/products/{p_id}")
    assert res_check_p.json()["stock_quantity"] == 5

def test_order_cancellation_restores_stock():
    # 1. Setup customer and product
    res_cust = client.post("/api/customers/", json={"name": "Alice", "email": "alice@example.com"}, headers=auth_headers)
    cust_id = res_cust.json()["id"]
    res_p = client.post("/api/products/", json={"sku": "P1", "name": "Prod", "price": 10.00, "stock_quantity": 10}, headers=auth_headers)
    p_id = res_p.json()["id"]

    # 2. Create order
    res_order = client.post("/api/orders/", json={"customer_id": cust_id, "items": [{"product_id": p_id, "quantity": 4}]}, headers=auth_headers)
    order_id = res_order.json()["id"]
    
    # Stock should be 6
    assert client.get(f"/api/products/{p_id}").json()["stock_quantity"] == 6

    # 3. Cancel order
    res_cancel = client.put(f"/api/orders/{order_id}/status", json={"status": "Cancelled"}, headers=auth_headers)
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "Cancelled"

    # 4. Verify stock is restored
    assert client.get(f"/api/products/{p_id}").json()["stock_quantity"] == 10

def test_change_admin_passcode():
    # 1. Verify current passcode works
    res_product_ok = client.post(
        "/api/products/",
        json={"sku": "PROD-TEMP-1", "name": "Temp Prod", "price": 5.99, "stock_quantity": 10},
        headers={"Authorization": "Bearer admin123"}
    )
    assert res_product_ok.status_code == 201

    # 2. Change admin passcode
    res_change = client.post(
        "/api/admin/change-password",
        json={"current_password": "admin123", "new_password": "newpasscode456"},
        headers={"Authorization": "Bearer admin123"}
    )
    assert res_change.status_code == 200
    assert "Admin passcode updated successfully" in res_change.json()["message"]

    # 3. Verify old passcode is now rejected
    res_product_fail = client.post(
        "/api/products/",
        json={"sku": "PROD-TEMP-2", "name": "Temp Prod 2", "price": 5.99, "stock_quantity": 10},
        headers={"Authorization": "Bearer admin123"}
    )
    assert res_product_fail.status_code == 401

    # 4. Verify new passcode works
    res_product_new = client.post(
        "/api/products/",
        json={"sku": "PROD-TEMP-3", "name": "Temp Prod 3", "price": 5.99, "stock_quantity": 10},
        headers={"Authorization": "Bearer newpasscode456"}
    )
    assert res_product_new.status_code == 201
