import pytest
from app.adapters.random_user_adapter import RandomUserAdapter
from app.adapters.rest_adapter import RestCountriesAdapter
from app.adapters.soap_adapter import SoapCountryInfoAdapter

@pytest.mark.asyncio
async def test_rest_countries_adapter():
    adapter = RestCountriesAdapter()
    record, telemetry = await adapter.fetch_country("BR")
    assert record.iso_code.upper() in ["BR", "BRA"]
    assert "Brasilia" in record.capital or "Brasília" in record.capital
    assert record.currency_code == "BRL"
    assert telemetry.protocol == "REST"
    assert telemetry.status_code == 200
    assert telemetry.bytes_sent > 0
    assert telemetry.bytes_received > 0
    assert "{" in telemetry.raw_response

@pytest.mark.asyncio
async def test_random_user_adapter_by_country():
    adapter = RandomUserAdapter()
    profile_br, tel_br = await adapter.fetch_identity_for_country("BR")
    assert profile_br.full_name
    assert len(profile_br.full_name.split()) >= 2
    assert profile_br.nationality_code == "BR"
    assert tel_br.protocol == "REST"
    assert "randomuser.me" in tel_br.endpoint_url

    profile_jp, tel_jp = await adapter.fetch_identity_for_country("JP")
    assert profile_jp.full_name
    assert profile_jp.nationality_code == "JP"

def test_soap_country_info_adapter():
    adapter = SoapCountryInfoAdapter()
    record, telemetry = adapter.fetch_full_country_info("BR")
    assert record.iso_code == "BR"
    assert "Brasilia" in record.capital or "Brasília" in record.capital
    assert record.currency_code == "BRL"
    assert telemetry.protocol == "SOAP"
    assert telemetry.status_code == 200
    assert telemetry.bytes_sent > 0
    assert telemetry.bytes_received > 0
    assert "<soap:Envelope" in telemetry.raw_response or "<soapenv:Envelope" in telemetry.raw_response
