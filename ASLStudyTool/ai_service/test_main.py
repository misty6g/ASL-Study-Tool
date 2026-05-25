import os
import pytest
from fastapi.testclient import TestClient

# Mock environment secrets before importing main
os.environ["AI_SERVICE_SECRET"] = "test_internal_secret"
os.environ["GEMINI_API_KEY"] = "mock_api_key"

from main import app

client = TestClient(app)

def test_health_endpoint():
    """Verifies that the public health check endpoint is accessible and healthy."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_extract_landmarks_unauthorized():
    """Verifies that the extract-landmarks route rejects requests missing the secret header."""
    response = client.post("/extract-landmarks")
    assert response.status_code == 401

def test_classify_sign_unauthorized():
    """Verifies that the classify-sign route rejects requests missing the secret header."""
    response = client.post("/classify-sign", json={"landmarks": [], "expected_sign": "hello"})
    assert response.status_code == 401

def test_generate_feedback_unauthorized():
    """Verifies that the generate-feedback route rejects requests missing the secret header."""
    response = client.post("/generate-feedback", json={})
    assert response.status_code == 401

def test_classify_sign_authorized_mock():
    """Verifies that the mock classification response operates properly with correct headers."""
    headers = {"X-Internal-Secret": "test_internal_secret"}
    payload = {
        "landmarks": [[[0.1, 0.2, 0.3] for _ in range(21)] for _ in range(10)],
        "expected_sign": "goodbye"
    }
    response = client.post("/classify-sign", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_sign" in data
    assert data["predicted_sign"] == "goodbye"
    assert "confidence" in data
    assert len(data["top_3"]) == 3
