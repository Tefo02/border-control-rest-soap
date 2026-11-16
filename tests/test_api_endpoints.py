from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_full_inspection_cycle():
    next_response = client.get("/api/inspections/next")
    assert next_response.status_code == 200
    passport = next_response.json()
    inspection_id = passport["inspection_id"]
    assert inspection_id
    assert "interrogation_responses" in passport

    interpol_response = client.post(
        f"/api/inspections/{inspection_id}/interpol-query",
        json={"passport_number": passport["passport_number"]}
    )
    assert interpol_response.status_code == 200

    query_payload = {"query_iso_code": passport["declared_iso_code"]}
    mainframe_response = client.post(
        f"/api/inspections/{inspection_id}/mainframe-query",
        json=query_payload
    )
    assert mainframe_response.status_code == 200

    verdict_response = client.post(
        f"/api/inspections/{inspection_id}/verdict",
        json={"decision": "DENY", "violation_category": "WSDL_MISMATCH"}
    )
    assert verdict_response.status_code == 200
    verdict_data = verdict_response.json()
    assert "traveler_reaction" in verdict_data
    assert "expected_category" in verdict_data

def test_api_fault_simulation_endpoint():
    response = client.post("/api/inspections/debug/fault-simulation")
    assert response.status_code == 200
    data = response.json()
    assert "<soap:Fault>" in data["soap_fault_telemetry"]["raw_response"]
    assert data["rest_error_telemetry"]["status_code"] == 404

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
