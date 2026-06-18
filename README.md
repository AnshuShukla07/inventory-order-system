# Inventory & Order Management System

A simplified full-stack Inventory & Order Management System for managing products, customers, and orders. Features a modern glassmorphic React dashboard frontend, a secure FastAPI Python backend, and PostgreSQL data persistence. Fully containerized with Docker.

---

## Technical Stack

- **Backend**: FastAPI, SQLAlchemy ORM, SQLite/PostgreSQL, Pydantic
- **Frontend**: Vite + React, TypeScript, Vanilla CSS (Premium dark glassmorphic design)
- **Database**: PostgreSQL (Production) / SQLite (Development/Testing fallback)
- **Containerization**: Docker & Docker Compose

---

## Core Business Rules Implemented

1. **Unique Product SKUs**: Handled via database level unique constraints and Pydantic validators.
2. **Unique Customer Emails**: Handled via database level unique constraints and email format validators.
3. **Transactional Inventory Checks**: Order placement runs within an isolated SQL transaction. Products are locked (`with_for_update`) during checkout to prevent concurrent race conditions (overselling).
4. **Automatic Stock Reduction**: Product stock decreases automatically when orders are placed.
5. **Insufficient Stock Prevention**: Orders are strictly blocked, rolling back transactions if requested quantities exceed available inventory.
6. **Order Cancellations**: Restores the previously deducted product stock to the inventory balance.

---

## Getting Started

### 1. Running with Docker (Recommended)

Make sure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

From the root directory, spin up all services:

```bash
docker compose up --build
```

- **Frontend Application**: `http://localhost:3000`
- **Backend API Docs (Swagger)**: `http://localhost:8000/docs`
- **PostgreSQL Database**: `localhost:5432`

---

### 2. Running Locally (Without Docker)

#### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the root of the project (or inside `backend`) overriding `DATABASE_URL` if you want to use SQLite:
   ```ini
   DATABASE_URL=sqlite:///./inventory.db
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```

#### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Run the React development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## Running Automated Tests

Run the test suite to verify the business logic rules:

```bash
cd backend
python -m pytest app/test_main.py
```

---

## Deployment Guide (Free Hosting Platforms)

To deploy this application with public URLs:

### 1. Database (PostgreSQL)
Use a free database provider like **Neon** (neon.tech) or **Supabase** (supabase.com):
- Create a new PostgreSQL instance.
- Obtain the database connection URL (`postgresql://...`).

### 2. Backend (FastAPI)
Deploy on **Render** (render.com) or **Railway** (railway.app):
- Create a Web Service connected to your GitHub repository.
- Specify Build Command: `pip install -r backend/requirements.txt`
- Specify Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (set directory to `backend`)
- Add Environment Variable: `DATABASE_URL` pointing to your Neon/Supabase instance.

### 3. Frontend (React)
Deploy on **Vercel** (vercel.com) or **Netlify** (netlify.com):
- Create a project importing your repository.
- Set Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Add Environment Variable: `VITE_API_URL` pointing to your deployed FastAPI backend URL.
