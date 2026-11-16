import pytest
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
