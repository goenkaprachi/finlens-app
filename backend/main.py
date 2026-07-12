from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from data_loader import get_pricing, get_margin_join, get_revenue_at_risk, get_summary
import uvicorn
import os

app = FastAPI(title="FinLens API")

# Allow CORS for local development and Render deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://finlens-ui.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/pricing")
def read_pricing():
    return get_pricing()

@app.get("/api/margin-join")
def read_margin_join():
    return get_margin_join()

@app.get("/api/revenue-at-risk")
def read_revenue_at_risk():
    return get_revenue_at_risk()

@app.get("/api/summary")
def read_summary():
    return get_summary()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
