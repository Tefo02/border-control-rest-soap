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
    InvalidIsoFaultStrategy,
    LegitimateStrategy,
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
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record())
    assert not is_fraud
    assert fraud_type == "LEGITIMATE"
    assert modifications["declared_capital"] == "Brasilia"
    assert modifications["declared_currency_code"] == "BRL"
    assert modifications["declared_phone_code"] == "55"

def test_capital_mismatch_strategy():
    strategy = CapitalMismatchStrategy()
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record())
    assert is_fraud
    assert fraud_type == "CAPITAL_MISMATCH"
    assert modifications["declared_capital"] != "Brasilia"
    assert "Brasilia" in reason

def test_currency_mismatch_strategy():
    strategy = CurrencyMismatchStrategy()
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record())
    assert is_fraud
    assert fraud_type == "CURRENCY_MISMATCH"
    assert modifications["declared_currency_code"] != "BRL"
    assert "BRL" in reason

def test_dialing_code_mismatch_strategy():
    strategy = DialingCodeMismatchStrategy()
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record())
    assert is_fraud
    assert fraud_type == "DIALING_CODE_MISMATCH"
    assert modifications["declared_phone_code"] != "55"

def test_invalid_iso_fault_strategy():
    strategy = InvalidIsoFaultStrategy()
    modifications, is_fraud, fraud_type, reason = strategy.apply(build_dummy_record())
    assert is_fraud
    assert fraud_type == "INVALID_ISO_FAULT"
    assert modifications["declared_iso_code"] == "ZZ"

@pytest.mark.asyncio
async def test_inspection_service_flow():
    repo = InspectionRepository()
    rest = RestCountriesAdapter()
    soap = SoapCountryInfoAdapter()
    service = InspectionService(repo, rest, soap)

    passport = await service.create_next_inspection()
    assert passport.inspection_id
    assert not hasattr(passport, "is_fraud")

    stored_case = repo.get(passport.inspection_id)
    assert stored_case is not None

    mainframe_result = service.query_mainframe(passport.inspection_id, passport.declared_iso_code)
    assert mainframe_result.soap_telemetry.protocol == "SOAP"

    correct_decision = "DENY" if stored_case.is_fraud else "APPROVE"
    result = service.evaluate_verdict(passport.inspection_id, correct_decision)
    assert result.is_correct
    assert result.score_delta == 100
    assert repo.get(passport.inspection_id) is None
