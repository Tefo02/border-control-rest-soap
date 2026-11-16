from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_full_inspection_cycle():
    next_response = client.get("/api/inspections/next")
    assert next_response.status_code == 200
    passport = next_response.json()
    inspection_id = passport["inspection_id"]
    assert inspection_id
    assert passport["passenger_name"]
    assert passport["rest_telemetry"]["protocol"] == "REST"
    assert passport["rest_telemetry"]["status_code"] == 200

    query_payload = {"query_iso_code": passport["declared_iso_code"]}
    mainframe_response = client.post(
        f"/api/inspections/{inspection_id}/mainframe-query",
        json=query_payload
    )
    assert mainframe_response.status_code == 200
    mainframe_data = mainframe_response.json()
    assert mainframe_data["soap_telemetry"]["protocol"] == "SOAP"
    assert mainframe_data["soap_telemetry"]["status_code"] == 200

    verdict_response = client.post(
        f"/api/inspections/{inspection_id}/verdict",
        json={"decision": "APPROVE"}
    )
    assert verdict_response.status_code == 200
    verdict_data = verdict_response.json()
    assert "is_correct" in verdict_data
    assert "score_delta" in verdict_data
    assert "technical_explanation" in verdict_data

def test_api_nonexistent_session():
    response = client.post(
        "/api/inspections/non-existent-uuid/verdict",
        json={"decision": "APPROVE"}
    )
    assert response.status_code == 404

def test_api_invalid_decision_payload():
    next_response = client.get("/api/inspections/next")
    inspection_id = next_response.json()["inspection_id"]
    response = client.post(
        f"/api/inspections/{inspection_id}/verdict",
        json={"decision": "MAYBE"}
    )
    assert response.status_code == 422
