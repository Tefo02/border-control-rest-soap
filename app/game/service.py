import random
import uuid
from app.adapters.rest_adapter import RestCountriesAdapter
from app.adapters.soap_adapter import SoapCountryInfoAdapter
from app.domain.models import InspectionCase, InspectionPassport, MainframeQueryResult, VerdictResult
from app.game.repository import InspectionRepository
from app.game.strategies import (
    CapitalMismatchStrategy,
    CurrencyMismatchStrategy,
    DialingCodeMismatchStrategy,
    FraudStrategy,
    InvalidIsoFaultStrategy,
    LegitimateStrategy,
)

CURATED_ISO_CODES = [
    "BR", "JP", "DE", "FR", "CA", "IT", "ES", "PT", "GB", "US",
    "MX", "AR", "CL", "AU", "NZ", "ZA", "EG", "IN", "CN", "KR",
    "GR", "NL", "BE", "CH", "SE", "NO", "FI", "DK", "IE", "PL"
]

PASSENGER_NAMES = [
    "Alex Mercer", "Elena Rostova", "Kenji Sato", "Carlos Mendoza", "Fatima Al-Mansoor",
    "Liam O'Connor", "Astrid Lindholm", "Mateo Silva", "Chloe Dubois", "Nia Adebayo",
    "Viktor Vance", "Sophie Mueller", "Dmitri Volkov", "Mei Ling", "Ananya Sharma"
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
            InvalidIsoFaultStrategy()
        ]

    async def create_next_inspection(self) -> InspectionPassport:
        inspection_id = str(uuid.uuid4())
        chosen_iso = random.choice(CURATED_ISO_CODES)
        passenger_name = random.choice(PASSENGER_NAMES)
        avatar_seed = f"{passenger_name.replace(' ', '')}-{random.randint(1000, 9999)}"
        avatar_url = f"https://api.dicebear.com/7.x/bottts/svg?seed={avatar_seed}"

        canonical_record, rest_telemetry = await self._rest_adapter.fetch_country(chosen_iso)

        strategy = self._select_strategy()
        modifications, is_fraud, fraud_type, fraud_reason = strategy.apply(canonical_record)

        passport = InspectionPassport(
            inspection_id=inspection_id,
            passenger_name=passenger_name,
            avatar_url=avatar_url,
            declared_iso_code=modifications["declared_iso_code"],
            declared_country_name=canonical_record.name,
            declared_capital=modifications["declared_capital"],
            declared_currency_code=modifications["declared_currency_code"],
            declared_phone_code=modifications["declared_phone_code"],
            flag_url=canonical_record.flag_url,
            rest_telemetry=rest_telemetry
        )

        case = InspectionCase(
            inspection_id=inspection_id,
            canonical_record=canonical_record,
            passport=passport,
            is_fraud=is_fraud,
            fraud_reason=fraud_reason,
            fraud_type=fraud_type
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

    def evaluate_verdict(self, inspection_id: str, decision: str) -> VerdictResult:
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

        if is_correct:
            score_delta = 100
            explanation = (
                f"Correct judgment! The traveler was {'properly detained for ' + case.fraud_reason if case.is_fraud else 'legitimately admitted with all passport data verified against the WSDL schema.'}"
            )
        else:
            score_delta = -50
            explanation = (
                f"Protocol violation! {'A fraudulent traveler bypassed border security (' + case.fraud_reason + ')' if case.is_fraud else 'An innocent traveler with authentic government records was unlawfully denied entry.'}"
            )

        self._repository.delete(inspection_id)

        return VerdictResult(
            inspection_id=inspection_id,
            decision=normalized_decision,
            is_correct=is_correct,
            is_fraud=case.is_fraud,
            fraud_type=case.fraud_type,
            fraud_reason=case.fraud_reason,
            score_delta=score_delta,
            technical_explanation=explanation
        )

    def _select_strategy(self) -> FraudStrategy:
        should_fraud = random.random() < 0.45
        if not should_fraud:
            return LegitimateStrategy()
        return random.choice(self._fraud_strategies)
