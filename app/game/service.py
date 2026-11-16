import asyncio
import json
import random
import uuid
from typing import Optional
from app.adapters.random_user_adapter import REGIONAL_CULTURAL_NAMES, RandomUserAdapter
from app.adapters.rest_adapter import RestCountriesAdapter
from app.adapters.soap_adapter import SoapCountryInfoAdapter
from app.domain.models import (
    FaultSimulationResult,
    InspectionCase,
    InspectionPassport,
    InterpolQueryResult,
    MainframeQueryResult,
    ProtocolTelemetry,
    ShiftSessionState,
    VerdictResult,
    WantedCriminalProfile,
)
from app.game.repository import InspectionRepository
from app.game.strategies import (
    BirthAgeMismatchStrategy,
    CapitalMismatchStrategy,
    CurrencyMismatchStrategy,
    DialingCodeMismatchStrategy,
    ExpiredPassportStrategy,
    FraudStrategy,
    InterpolWatchlistStrategy,
    InvalidIsoFaultStrategy,
    LegitimateStrategy,
    PhotoMismatchStrategy,
    SpeechContradictionStrategy,
)

CURATED_ISO_CODES = [
    "BR", "JP", "DE", "FR", "CA", "IT", "ES", "PT", "GB", "US",
    "MX", "AR", "CL", "AU", "NZ", "ZA", "EG", "IN", "CN", "KR",
    "GR", "NL", "BE", "CH", "SE", "NO", "FI", "DK", "IE", "PL"
]

TRAVEL_PURPOSES = [
    "Software Engineering Conference",
    "Tourism & Architecture Tour",
    "Automotive Supply Chain Audit",
    "Import/Export Cargo Inspection",
    "Medical Fellowship Program",
    "Agricultural Equipment Sales",
    "Renewable Energy Research",
    "International Film Festival",
    "Gastronomy & Wine Tasting Tour",
    "Financial Investment Consulting",
    "Classical Music Conservatory",
    "Maritime Logistics Summit",
    "Robotics & Automation Symposium",
    "Mineral Extraction Advisory"
]

WANTED_CRIMES = [
    "International Wire Fraud",
    "Diplomatic Document Forgery",
    "Industrial Espionage",
    "Contraband Currency Smuggling",
    "Satellite Mainframe Intrusion",
    "Identity Theft Syndicate",
    "Offshore Money Laundering",
    "Encrypted Courier Interception",
    "Sovereign Bond Counterfeiting"
]

class InspectionService:
    def __init__(
        self,
        repository: InspectionRepository,
        rest_adapter: RestCountriesAdapter,
        soap_adapter: SoapCountryInfoAdapter,
        random_user_adapter: Optional[RandomUserAdapter] = None
    ):
        self._repository = repository
        self._rest_adapter = rest_adapter
        self._soap_adapter = soap_adapter
        self._random_user_adapter = random_user_adapter or RandomUserAdapter()
        self._non_wanted_strategies: list[FraudStrategy] = [
            CapitalMismatchStrategy(),
            CurrencyMismatchStrategy(),
            DialingCodeMismatchStrategy(),
            InvalidIsoFaultStrategy(),
            ExpiredPassportStrategy(),
            SpeechContradictionStrategy(),
            PhotoMismatchStrategy(),
            BirthAgeMismatchStrategy()
        ]
        self._interpol_strategy = InterpolWatchlistStrategy()
        self._active_shift: Optional[ShiftSessionState] = None
        self._wanted_slots: dict[int, dict] = {}
        self._used_non_wanted_names: set[str] = set()

    def start_new_shift(self, day_number: int = 1) -> ShiftSessionState:
        shift_id = str(uuid.uuid4())
        total_passengers = random.randint(6, 10)
        wanted_isos = random.sample(CURATED_ISO_CODES, k=3)
        wanted_crimes = random.sample(WANTED_CRIMES, k=3)
        wanted_entries: list[dict] = []
        wanted_models: list[WantedCriminalProfile] = []
        used_names: set[str] = set()

        for idx, iso_code in enumerate(wanted_isos):
            candidates = REGIONAL_CULTURAL_NAMES.get(iso_code, REGIONAL_CULTURAL_NAMES["BR"])
            first, last = random.choice(candidates)
            full_name = f"{first} {last}"
            used_names.add(full_name)
            age = random.randint(26, 54)
            birth = f"{2026 - age}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
            purpose = random.choice(TRAVEL_PURPOSES)
            crime = wanted_crimes[idx]
            seed = full_name.replace(" ", "")

            entry = {
                "name": full_name,
                "age": age,
                "birth": birth,
                "purpose": purpose,
                "crime": crime,
                "iso": iso_code
            }
            wanted_entries.append(entry)
            wanted_models.append(
                WantedCriminalProfile(
                    criminal_id=f"WNT-{100 + idx}",
                    passenger_name=full_name,
                    avatar_url=f"https://api.dicebear.com/9.x/notionists/svg?seed={seed}",
                    crime_description=crime,
                    alias_hint=f"NAT: {iso_code} // DOB: {birth}"
                )
            )

        wanted_count = random.choice([1, 2])
        chosen_slots = random.sample(range(1, total_passengers + 1), k=wanted_count)
        chosen_criminals = random.sample(wanted_entries, k=wanted_count)
        self._wanted_slots = {
            slot: chosen_criminals[i] for i, slot in enumerate(chosen_slots)
        }
        self._used_non_wanted_names = set(used_names)

        raw_json = json.dumps([w.model_dump() for w in wanted_models], indent=2)
        telemetry = ProtocolTelemetry(
            protocol="REST",
            operation="GET /v1/watchlist/daily-bulletin",
            endpoint_url="https://interpol.api.local/v1/watchlist/daily-bulletin",
            latency_ms=31.5,
            bytes_sent=128,
            bytes_received=len(raw_json.encode("utf-8")),
            raw_request="GET /v1/watchlist/daily-bulletin HTTP/1.1\r\nHost: interpol.api.local\r\nAccept: application/json\r\n",
            raw_response=raw_json,
            status_code=200
        )

        self._active_shift = ShiftSessionState(
            shift_id=shift_id,
            day_number=day_number,
            total_passengers=total_passengers,
            current_passenger_index=0,
            is_shift_completed=False,
            wanted_list=wanted_models,
            rest_telemetry=telemetry
        )
        return self._active_shift

    def get_or_create_shift(self) -> ShiftSessionState:
        if not self._active_shift or self._active_shift.is_shift_completed:
            next_day = (self._active_shift.day_number + 1) if self._active_shift else 1
            return self.start_new_shift(day_number=next_day)
        return self._active_shift

    async def create_next_inspection(self) -> InspectionPassport:
        shift = self.get_or_create_shift()
        shift.current_passenger_index += 1
        current_idx = shift.current_passenger_index

        inspection_id = str(uuid.uuid4())

        if current_idx in self._wanted_slots:
            wanted_info = self._wanted_slots[current_idx]
            chosen_iso = wanted_info["iso"]
            canonical_record, rest_telemetry = await self._rest_adapter.fetch_country(chosen_iso)
            profile = wanted_info
            strategy: FraudStrategy = self._interpol_strategy
        else:
            chosen_iso = random.choice(CURATED_ISO_CODES)
            (canonical_record, country_telemetry), (identity_profile, user_telemetry) = await asyncio.gather(
                self._rest_adapter.fetch_country(chosen_iso),
                self._random_user_adapter.fetch_identity_for_country(chosen_iso, self._used_non_wanted_names)
            )
            self._used_non_wanted_names.add(identity_profile.full_name)
            profile = {
                "name": identity_profile.full_name,
                "age": identity_profile.age,
                "birth": identity_profile.birth_date,
                "purpose": random.choice(TRAVEL_PURPOSES)
            }
            strategy = self._select_non_wanted_strategy()
            rest_telemetry = self._merge_rest_telemetries(country_telemetry, user_telemetry)

        avatar_seed = profile["name"].replace(" ", "")
        avatar_url = f"https://api.dicebear.com/9.x/notionists/svg?seed={avatar_seed}"
        passport_number = f"P{random.randint(10000000, 99999999)}"

        context = {"profile": profile, "passport_number": passport_number}
        modifications, is_fraud, fraud_type, fraud_reason = strategy.apply(canonical_record, context)

        passport_photo_url = modifications.get("passport_photo_url") or avatar_url
        displayed_age = modifications.get("forged_age") or profile["age"]

        passport = InspectionPassport(
            inspection_id=inspection_id,
            shift_id=shift.shift_id,
            passenger_index=current_idx,
            total_passengers=shift.total_passengers,
            passenger_name=profile["name"],
            avatar_url=avatar_url,
            passport_photo_url=passport_photo_url,
            passport_number=passport_number,
            birth_date=profile["birth"],
            age=displayed_age,
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

    def _merge_rest_telemetries(
        self,
        country_tel: ProtocolTelemetry,
        user_tel: ProtocolTelemetry
    ) -> ProtocolTelemetry:
        try:
            country_json = json.loads(country_tel.raw_response)
        except Exception:
            country_json = country_tel.raw_response
        try:
            user_json = json.loads(user_tel.raw_response)
        except Exception:
            user_json = user_tel.raw_response

        combined_payload = json.dumps(
            {
                "countries_api_response": country_json,
                "randomuser_api_response": user_json
            },
            indent=2,
            ensure_ascii=False
        )
        return ProtocolTelemetry(
            protocol="REST",
            operation=f"{country_tel.operation} + {user_tel.operation}",
            endpoint_url=f"{country_tel.endpoint_url} | {user_tel.endpoint_url}",
            latency_ms=round(max(country_tel.latency_ms, user_tel.latency_ms), 2),
            bytes_sent=country_tel.bytes_sent + user_tel.bytes_sent,
            bytes_received=country_tel.bytes_received + user_tel.bytes_received,
            raw_request=f"{country_tel.raw_request}\n{user_tel.raw_request}",
            raw_response=combined_payload,
            status_code=200
        )

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

        shift = self.get_or_create_shift()
        is_wanted = case.passport.is_wanted_interpol
        reason = "RED NOTICE: Suspect matches Daily Wanted Criminals Bulletin." if is_wanted else None

        return InterpolQueryResult(
            inspection_id=inspection_id,
            passport_number=passport_number,
            passenger_name=case.passport.passenger_name,
            is_wanted=is_wanted,
            wanted_reason=reason,
            wanted_list=shift.wanted_list,
            rest_telemetry=shift.rest_telemetry
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

        shift_completed = False
        if self._active_shift and self._active_shift.current_passenger_index >= self._active_shift.total_passengers:
            self._active_shift.is_shift_completed = True
            shift_completed = True

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
            technical_explanation=explanation,
            is_shift_completed=shift_completed
        )

    def _select_non_wanted_strategy(self) -> FraudStrategy:
        should_fraud = random.random() < 0.55
        if not should_fraud:
            return LegitimateStrategy()
        return random.choice(self._non_wanted_strategies)
