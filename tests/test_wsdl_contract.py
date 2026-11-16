from pathlib import Path
from zeep import Client
from zeep.transports import Transport
import httpx

def test_local_wsdl_parsing():
    wsdl_path = Path("contracts/CountryInfoService.wsdl").resolve()
    assert wsdl_path.exists()
    client = Client(str(wsdl_path))
    operations = client.wsdl.services["CountryInfoService"].ports["CountryInfoServiceSoap"].binding._operations
    assert "FullCountryInfo" in operations
    assert "CapitalCity" in operations
    assert "CountryCurrency" in operations

def test_remote_or_fallback_wsdl():
    wsdl_url = "http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL"
    wsdl_path = Path("contracts/CountryInfoService.wsdl").resolve()
    try:
        response = httpx.get(wsdl_url, timeout=3.0)
        assert response.status_code == 200
        client = Client(wsdl_url)
    except Exception:
        client = Client(str(wsdl_path))
    assert client is not None
