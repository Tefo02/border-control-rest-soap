import random
import uuid
from typing import Optional
from app.adapters.rest_adapter import RestCountriesAdapter
from app.adapters.soap_adapter import SoapCountryInfoAdapter
from app.domain.models import (
    FaultSimulationResult,
    InspectionCase,
    InspectionPassport,
    InterpolQueryResult,
    MainframeQueryResult,
    ProtocolTelemetry,
    VerdictResult,
)
from app.game.repository import InspectionRepository
from app.game.strategies import (
    CapitalMismatchStrategy,
    CurrencyMismatchStrategy,
    DialingCodeMismatchStrategy,
    ExpiredPassportStrategy,
    FraudStrategy,
    InterpolWatchlistStrategy,
    InvalidIsoFaultStrategy,
    LegitimateStrategy,
    SpeechContradictionStrategy,
)

CURATED_ISO_CODES = [
    "BR", "JP", "DE", "FR", "CA", "IT", "ES", "PT", "GB", "US",
    "MX", "AR", "CL", "AU", "NZ", "ZA", "EG", "IN", "CN", "KR",
    "GR", "NL", "BE", "CH", "SE", "NO", "FI", "DK", "IE", "PL"
]

PASSENGER_PROFILES = [
    {"name": "Alex Mercer", "age": 34, "birth": "1992-06-14", "purpose": "Software Engineering Conference"},
    {"name": "Elena Rostova", "age": 29, "birth": "1997-03-22", "purpose": "Tourism & Architecture Tour"},
    {"name": "Kenji Sato", "age": 41, "birth": "1985-11-09", "purpose": "Automotive Supply Chain Audit"},
    {"name": "Carlos Mendoza", "age": 38, "birth": "1988-08-30", "purpose": "Import/Export Cargo Inspection"},
    {"name": "Fatima Al-Mansoor", "age": 31, "birth": "1995-01-17", "purpose": "Medical Fellowship Program"},
    {"name": "Liam O'Connor", "age": 45, "birth": "1981-05-04", "purpose": "Agricultural Equipment Sales"},
    {"name": "Astrid Lindholm", "age": 27, "birth": "1999-09-12", "purpose": "Renewable Energy Research"},
    {"name": "Mateo Silva", "age": 36, "birth": "1990-12-03", "purpose": "International Film Festival"},
    {"name": "Chloe Dubois", "age": 33, "birth": "1993-07-25", "purpose": "Gastronomy & Wine Tasting Tour"},
    {"name": "Viktor Vance", "age": 52, "birth": "1974-02-19", "purpose": "Financial Investment Consulting"}
]

class InspectionService:
    def __init__(
        self,
        repository: InspectionRepository,
        rest_adapter: RestCountriesAdapter,
        soap_adapter: SoapCountryInfoAdapter
    ):
        self._repository = repository
        self._rest_adapter = rest_adapter
        self._soap_adapter = soap_adapter
        self._fraud_strategies: list[FraudStrategy] = [
            CapitalMismatchStrategy(),
            CurrencyMismatchStrategy(),
            DialingCodeMismatchStrategy(),
            InvalidIsoFaultStrategy(),
            ExpiredPassportStrategy(),
            SpeechContradictionStrategy(),
            InterpolWatchlistStrategy()
        ]

    async def create_next_inspection(self) -> InspectionPassport:
        inspection_id = str(uuid.uuid4())
        chosen_iso = random.choice(CURATED_ISO_CODES)
        profile = random.choice(PASSENGER_PROFILES)
        avatar_seed = profile["name"].replace(" ", "")
        avatar_url = f"https://api.dicebear.com/9.x/notionists/svg?seed={avatar_seed}"
        passport_number = f"P{random.randint(10000000, 99999999)}"

        canonical_record, rest_telemetry = await self._rest_adapter.fetch_country(chosen_iso)

        strategy = self._select_strategy()
        context = {"profile": profile, "passport_number": passport_number}
        modifications, is_fraud, fraud_type, fraud_reason = strategy.apply(canonical_record, context)

        passport = InspectionPassport(
            inspection_id=inspection_id,
            passenger_name=profile["name"],
            avatar_url=avatar_url,
            passport_number=passport_number,
            birth_date=profile["birth"],
            age=profile["age"],
            issue_date="2021-04-10",
            expiration_date=modifications["expiration_date"],
            is_expired=modifications["is_expired"],
            travel_purpose=profile["purpose"],
            dialogue_speech=modifications["dialogue_speech"],
            interrogation_responses=modifications["interrogation_responses"],
            declared_iso_code=modifications["declared_iso_code"],
            declared_country_name=canonical_record.name,
            declared_capital=modifications["declared_capital"],
            declared_currency_code=modifications["declared_currency_code"],
            declared_phone_code=modifications["declared_phone_code"],
            flag_url=canonical_record.flag_url,
            is_wanted_interpol=modifications["is_wanted_interpol"],
            rest_telemetry=rest_telemetry
        )

        case = InspectionCase(
            inspection_id=inspection_id,
            canonical_record=canonical_record,
            passport=passport,
            is_fraud=is_fraud,
            fraud_reason=fraud_reason,
            fraud_type=fraud_type,
            violation_category=modifications["violation_category"]
        )
        self._repository.save(case)
        return passport

    def query_mainframe(self, inspection_id: str, query_iso_code: str) -> MainframeQueryResult:
        case = self._repository.get(inspection_id)
        if not case:
            raise KeyError(f"Inspection ID '{inspection_id}' not found.")

        record, soap_telemetry = self._soap_adapter.fetch_full_country_info(query_iso_code)
        return MainframeQueryResult(
            inspection_id=inspection_id,
            canonical_record=record,
            soap_telemetry=soap_telemetry
        )

    def query_interpol_watchlist(self, inspection_id: str, passport_number: str) -> InterpolQueryResult:
        case = self._repository.get(inspection_id)
        if not case:
            raise KeyError(f"Inspection ID '{inspection_id}' not found.")

        is_wanted = case.passport.is_wanted_interpol
        reason = "RED NOTICE: Suspect wanted for international wire fraud and passport forgery." if is_wanted else None

        raw_json = (
            f'{{"passport_number": "{passport_number}", "status": "WANTED", "notice": "RED", "crime": "WIRE_FRAUD"}}'
            if is_wanted
            else f'{{"passport_number": "{passport_number}", "status": "CLEARED", "records": 0}}'
        )

        telemetry = ProtocolTelemetry(
            protocol="REST",
            operation=f"GET /watchlist/{passport_number}",
            endpoint_url=f"https://interpol.api.local/v1/watchlist/{passport_number}",
            latency_ms=28.4,
            bytes_sent=142,
            bytes_received=len(raw_json.encode("utf-8")),
            raw_request=f"GET /v1/watchlist/{passport_number} HTTP/1.1\r\nHost: interpol.api.local\r\nAccept: application/json\r\n",
            raw_response=raw_json,
            status_code=200
        )

        return InterpolQueryResult(
            inspection_id=inspection_id,
            passport_number=passport_number,
            passenger_name=case.passport.passenger_name,
            is_wanted=is_wanted,
            wanted_reason=reason,
            rest_telemetry=telemetry
        )

    def simulate_protocol_faults(self) -> FaultSimulationResult:
        soap_fault_req = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FullCountryInfo xmlns="http://www.oorsprong.org/websamples.countryinfo">
      <sCountryISOCode>INVALID_SCHEMA_999</sCountryISOCode>
    </FullCountryInfo>
  </soap:Body>
</soap:Envelope>"""
        soap_fault_res = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Client</faultcode>
      <faultstring>Validation constraint violation: sCountryISOCode exceeds xs:string ISO-3166 facet length</faultstring>
      <detail>
        <ns1:SchemaFault xmlns:ns1="http://www.oorsprong.org/websamples.countryinfo">
          <errorCode>WSDL_XSD_FACET_ERROR</errorCode>
        </ns1:SchemaFault>
      </detail>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>"""
        rest_err_req = "GET https://countries-api.davegarvey.workers.dev/countries/INVALID_999 HTTP/1.1\r\nAccept: application/json\r\n"
        rest_err_res = '{\n  "error": "NOT_FOUND",\n  "status": 404,\n  "message": "Country code INVALID_999 does not exist"\n}'

        soap_telemetry = ProtocolTelemetry(
            protocol="SOAP",
            operation="FullCountryInfo (Fault)",
            endpoint_url="http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso",
            latency_ms=184.6,
            bytes_sent=len(soap_fault_req.encode("utf-8")),
            bytes_received=len(soap_fault_res.encode("utf-8")),
            raw_request=soap_fault_req,
            raw_response=soap_fault_res,
            status_code=500
        )
        rest_telemetry = ProtocolTelemetry(
            protocol="REST",
            operation="GET /countries/INVALID_999",
            endpoint_url="https://countries-api.davegarvey.workers.dev/countries/INVALID_999",
            latency_ms=41.2,
            bytes_sent=len(rest_err_req.encode("utf-8")),
            bytes_received=len(rest_err_res.encode("utf-8")),
            raw_request=rest_err_req,
            raw_response=rest_err_res,
            status_code=404
        )
        return FaultSimulationResult(
            soap_fault_telemetry=soap_telemetry,
            rest_error_telemetry=rest_telemetry
        )

    def evaluate_verdict(
        self,
        inspection_id: str,
        decision: str,
        violation_category: Optional[str] = None
    ) -> VerdictResult:
        case = self._repository.get(inspection_id)
        if not case:
            raise KeyError(f"Inspection ID '{inspection_id}' not found.")

        normalized_decision = decision.upper().strip()
        is_approval = normalized_decision == "APPROVE"
        is_denial = normalized_decision == "DENY"

        if not (is_approval or is_denial):
            raise ValueError(f"Invalid decision '{decision}'. Must be 'APPROVE' or 'DENY'.")

        expected_decision = "DENY" if case.is_fraud else "APPROVE"
        is_correct = normalized_decision == expected_decision
        normalized_category = (violation_category or "").upper().strip()
        is_exact_category_match = False

        if is_correct and not case.is_fraud:
            score_delta = 100
            is_exact_category_match = True
            traveler_reaction = "Thank you, officer! Pleasure doing business with an efficient border post."
            explanation = "Accurate clearance (+100 PTS)! All passport fields, verbal statements and WSDL records matched."
        elif is_correct and case.is_fraud:
            if not normalized_category or normalized_category == case.violation_category:
                score_delta = 150 if normalized_category == case.violation_category else 100
                is_exact_category_match = normalized_category == case.violation_category
                bonus_tag = " (+150 PTS WITH FORENSIC BONUS)" if is_exact_category_match else " (+100 PTS)"
                traveler_reaction = "Curses! You pinpointed the exact discrepancy in my documentation..."
                explanation = f"Forensic detention{bonus_tag}! Confirmed {case.fraud_reason}"
            else:
                score_delta = 75
                is_exact_category_match = False
                traveler_reaction = "Hey! I may have an issue, but not the one you wrote on that citation ticket!"
                explanation = (
                    f"Partial credit (+75 PTS): Traveler was indeed fraudulent, but you cited '{normalized_category}' "
                    f"instead of '{case.violation_category}'. Actual cause: {case.fraud_reason}"
                )
        else:
            score_delta = -50
            if case.is_fraud:
                traveler_reaction = "Haha! So long, suckers! Easiest border crossing of my life!"
                explanation = f"Security breach (-50 PTS)! You admitted a fraudulent traveler: {case.fraud_reason}"
            else:
                traveler_reaction = "This is an outrage! My passport and manifest were 100% genuine! I will call my embassy!"
                explanation = "False detention (-50 PTS)! Traveler had completely valid credentials and no warrants."

        self._repository.delete(inspection_id)

        return VerdictResult(
            inspection_id=inspection_id,
            decision=normalized_decision,
            is_correct=is_correct,
            is_exact_category_match=is_exact_category_match,
            is_fraud=case.is_fraud,
            fraud_type=case.fraud_type,
            expected_category=case.violation_category,
            fraud_reason=case.fraud_reason,
            score_delta=score_delta,
            traveler_reaction=traveler_reaction,
            technical_explanation=explanation
        )

    def _select_strategy(self) -> FraudStrategy:
        should_fraud = random.random() < 0.55
        if not should_fraud:
            return LegitimateStrategy()
        return random.choice(self._fraud_strategies)
