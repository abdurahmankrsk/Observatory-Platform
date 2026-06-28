from fastapi.testclient import TestClient
import sys
import os

# Add the parent directory to sys.path so we can import the app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "AstroObservatory API" in response.json()["message"]

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert data["service"] == "AstroObservatory API"
