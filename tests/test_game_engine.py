import pytest
from app.adapters.rest_adapter import RestCountriesAdapter
from app.adapters.soap_adapter import SoapCountryInfoAdapter
from app.domain.models import CountryRecord
from app.game.repository import InspectionRepository
from app.game.service import InspectionService
from app.game.strategies import (
    ExpiredPassportStrategy,
    InterpolWatchlistStrategy,
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
    assert modifications["violation_category"] == "NONE"
    assert "origin" in modifications["interrogation_responses"]
    assert "currency" in modifications["interrogation_responses"]

def test_expired_passport_strategy():
    strategy = ExpiredPassportStrategy()
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record(), {})
    assert is_fraud
    assert modifications["violation_category"] == "EXPIRED_PASSPORT"
    assert modifications["is_expired"]

def test_speech_contradiction_strategy():
    strategy = SpeechContradictionStrategy()
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record(), {})
    assert is_fraud
    assert modifications["violation_category"] == "VERBAL_CONTRADICTION"

def test_interpol_watchlist_strategy():
    strategy = InterpolWatchlistStrategy()
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record(), {})
    assert is_fraud
    assert modifications["violation_category"] == "INTERPOL_WANTED"
    assert modifications["is_wanted_interpol"]

@pytest.mark.asyncio
async def test_inspection_service_forensic_bonus():
    repo = InspectionRepository()
    rest = RestCountriesAdapter()
    soap = SoapCountryInfoAdapter()
    service = InspectionService(repo, rest, soap)

    passport = await service.create_next_inspection()
    assert passport.interrogation_responses

    stored_case = repo.get(passport.inspection_id)
    if stored_case.is_fraud:
        result = service.evaluate_verdict(
            passport.inspection_id,
            "DENY",
            stored_case.violation_category
        )
        assert result.is_correct
        assert result.is_exact_category_match
        assert result.score_delta == 150
    else:
        result = service.evaluate_verdict(passport.inspection_id, "APPROVE")
        assert result.is_correct
        assert result.score_delta == 100
