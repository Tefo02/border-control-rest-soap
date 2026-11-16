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

class InspectionPassport(BaseModel):
    inspection_id: str
    passenger_name: str
    avatar_url: str
    declared_iso_code: str
    declared_country_name: str
    declared_capital: str
    declared_currency_code: str
    declared_phone_code: str
    flag_url: str
    rest_telemetry: ProtocolTelemetry

class MainframeQueryResult(BaseModel):
    inspection_id: str
    canonical_record: Optional[CountryRecord]
    soap_telemetry: ProtocolTelemetry

class InspectionCase(BaseModel):
    inspection_id: str
    canonical_record: CountryRecord
    passport: InspectionPassport
    is_fraud: bool
    fraud_reason: str
    fraud_type: str

class VerdictSubmission(BaseModel):
    decision: str

class VerdictResult(BaseModel):
    inspection_id: str
    decision: str
    is_correct: bool
    is_fraud: bool
    fraud_type: str
    fraud_reason: str
    score_delta: int
    technical_explanation: str
