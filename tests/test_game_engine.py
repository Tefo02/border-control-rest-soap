import pytest
from app.adapters.rest_adapter import RestCountriesAdapter
from app.adapters.soap_adapter import SoapCountryInfoAdapter
from app.domain.models import CountryRecord
from app.game.repository import InspectionRepository
from app.game.service import InspectionService
from app.game.strategies import (
    CapitalMismatchStrategy,
    CurrencyMismatchStrategy,
    DialingCodeMismatchStrategy,
    ExpiredPassportStrategy,
    InterpolWatchlistStrategy,
    InvalidIsoFaultStrategy,
    LegitimateStrategy,
    SpeechContradictionStrategy,
)

def build_dummy_record() -> CountryRecord:
    return CountryRecord(
        iso_code="BR",
        name="Brazil",
        capital="Brasilia",
        currency_code="BRL",
        currency_name="Brazilian real",
        phone_code="55",
        continent_code="Americas",
        flag_url="https://flagcdn.com/br.svg",
        languages=["Portuguese"]
    )

def test_legitimate_strategy():
    strategy = LegitimateStrategy()
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record(), {})
    assert not is_fraud
    assert fraud_type == "LEGITIMATE"
    assert not modifications["is_expired"]
    assert not modifications["is_wanted_interpol"]
    assert modifications["declared_capital"] == "Brasilia"

def test_expired_passport_strategy():
    strategy = ExpiredPassportStrategy()
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record(), {})
    assert is_fraud
    assert fraud_type == "EXPIRED_PASSPORT"
    assert modifications["is_expired"]

def test_speech_contradiction_strategy():
    strategy = SpeechContradictionStrategy()
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record(), {})
    assert is_fraud
    assert fraud_type == "VERBAL_CONTRADICTION"
    assert "contradicting" in reason

def test_interpol_watchlist_strategy():
    strategy = InterpolWatchlistStrategy()
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record(), {})
    assert is_fraud
    assert fraud_type == "INTERPOL_WANTED"
    assert modifications["is_wanted_interpol"]

@pytest.mark.asyncio
async def test_inspection_service_flow():
    repo = InspectionRepository()
    rest = RestCountriesAdapter()
    soap = SoapCountryInfoAdapter()
    service = InspectionService(repo, rest, soap)

    passport = await service.create_next_inspection()
    assert passport.inspection_id
    assert passport.passport_number
    assert passport.birth_date
    assert passport.dialogue_speech
    assert not hasattr(passport, "is_fraud")

    interpol_res = service.query_interpol_watchlist(passport.inspection_id, passport.passport_number)
    assert interpol_res.rest_telemetry.protocol == "REST"

    mainframe_result = service.query_mainframe(passport.inspection_id, passport.declared_iso_code)
    assert mainframe_result.soap_telemetry.protocol == "SOAP"

    stored_case = repo.get(passport.inspection_id)
    correct_decision = "DENY" if stored_case.is_fraud else "APPROVE"
    result = service.evaluate_verdict(passport.inspection_id, correct_decision)
    assert result.is_correct
    assert result.score_delta == 100
