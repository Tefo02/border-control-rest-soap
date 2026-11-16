from typing import Optional
from pydantic import BaseModel, Field

class ProtocolTelemetry(BaseModel):
    protocol: str
    operation: str
    endpoint_url: str
    latency_ms: float
    bytes_sent: int
    bytes_received: int
    raw_request: str
    raw_response: str
    status_code: int

class CountryRecord(BaseModel):
    iso_code: str
    name: str
    capital: str
    currency_code: str
    currency_name: str
    phone_code: str
    continent_code: str
    flag_url: str
    languages: list[str] = Field(default_factory=list)

class WantedCriminalProfile(BaseModel):
    criminal_id: str
    passenger_name: str
    avatar_url: str
    crime_description: str
    alias_hint: str

class ShiftSessionState(BaseModel):
    shift_id: str
    day_number: int
    total_passengers: int
    current_passenger_index: int
    is_shift_completed: bool
    wanted_list: list[WantedCriminalProfile]
    rest_telemetry: ProtocolTelemetry

class InspectionPassport(BaseModel):
    inspection_id: str
    shift_id: Optional[str] = None
    passenger_index: int = 1
    total_passengers: int = 8
    passenger_name: str
    avatar_url: str
    passport_number: str
    birth_date: str
    age: int
    issue_date: str
    expiration_date: str
    is_expired: bool
    travel_purpose: str
    dialogue_speech: str
    interrogation_responses: dict[str, str] = Field(default_factory=dict)
    declared_iso_code: str
    declared_country_name: str
    declared_capital: str
    declared_currency_code: str
    declared_phone_code: str
    flag_url: str
    is_wanted_interpol: bool = False
    rest_telemetry: ProtocolTelemetry

class MainframeQueryResult(BaseModel):
    inspection_id: str
    canonical_record: Optional[CountryRecord]
    soap_telemetry: ProtocolTelemetry

class InterpolQueryResult(BaseModel):
    inspection_id: str
    passport_number: str
    passenger_name: str
    is_wanted: bool
    wanted_reason: Optional[str] = None
    wanted_list: list[WantedCriminalProfile] = Field(default_factory=list)
    rest_telemetry: ProtocolTelemetry

class FaultSimulationResult(BaseModel):
    soap_fault_telemetry: ProtocolTelemetry
    rest_error_telemetry: ProtocolTelemetry

class InspectionCase(BaseModel):
    inspection_id: str
    canonical_record: CountryRecord
    passport: InspectionPassport
    is_fraud: bool
    fraud_reason: str
    fraud_type: str
    violation_category: str

class VerdictSubmission(BaseModel):
    decision: str
    violation_category: Optional[str] = None

class VerdictResult(BaseModel):
    inspection_id: str
    decision: str
    is_correct: bool
    is_exact_category_match: bool = False
    is_fraud: bool
    fraud_type: str
    expected_category: str
    fraud_reason: str
    score_delta: int
    traveler_reaction: str
    technical_explanation: str
    is_shift_completed: bool = False
