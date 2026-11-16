import abc
from app.domain.models import CountryRecord

class FraudStrategy(abc.ABC):
    @abc.abstractmethod
    def apply(self, canonical: CountryRecord) -> tuple[dict, bool, str, str]:
        pass

class LegitimateStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord) -> tuple[dict, bool, str, str]:
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
        }
        return modifications, False, "LEGITIMATE", "Passport data matches government records."

class CapitalMismatchStrategy(FraudStrategy):
    ALTERNATIVE_CAPITALS = {
        "BR": "Rio de Janeiro",
        "JP": "Kyoto",
        "DE": "Munich",
        "FR": "Marseille",
        "CA": "Toronto",
        "US": "New York",
        "AU": "Sydney",
        "IT": "Milan",
        "ES": "Barcelona",
        "GB": "Manchester"
    }

    def apply(self, canonical: CountryRecord) -> tuple[dict, bool, str, str]:
        fake_capital = self.ALTERNATIVE_CAPITALS.get(canonical.iso_code, f"Fake-{canonical.capital}")
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": fake_capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
        }
        reason = f"Capital mismatch: passenger declared '{fake_capital}', but official mainframe returned '{canonical.capital}'."
        return modifications, True, "CAPITAL_MISMATCH", reason

class CurrencyMismatchStrategy(FraudStrategy):
    ALTERNATIVE_CURRENCIES = {
        "BR": "USD",
        "JP": "CNY",
        "DE": "GBP",
        "FR": "CHF",
        "CA": "USD",
        "GB": "EUR",
        "AU": "NZD"
    }

    def apply(self, canonical: CountryRecord) -> tuple[dict, bool, str, str]:
        fake_currency = self.ALTERNATIVE_CURRENCIES.get(canonical.iso_code, "XXX")
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": fake_currency,
            "declared_phone_code": canonical.phone_code,
        }
        reason = f"Currency fraud: passenger declared '{fake_currency}', but official mainframe specifies '{canonical.currency_code}'."
        return modifications, True, "CURRENCY_MISMATCH", reason

class DialingCodeMismatchStrategy(FraudStrategy):
    ALTERNATIVE_CODES = {
        "BR": "54",
        "JP": "82",
        "DE": "43",
        "FR": "32",
        "CA": "44",
        "GB": "1"
    }

    def apply(self, canonical: CountryRecord) -> tuple[dict, bool, str, str]:
        fake_code = self.ALTERNATIVE_CODES.get(canonical.iso_code, "999")
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": fake_code,
        }
        reason = f"Telecom dialing code forgery: passenger declared +{fake_code}, official mainframe records show +{canonical.phone_code}."
        return modifications, True, "DIALING_CODE_MISMATCH", reason

class InvalidIsoFaultStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord) -> tuple[dict, bool, str, str]:
        fake_iso = "ZZ"
        modifications = {
            "declared_iso_code": fake_iso,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
        }
        reason = f"Fabricated nation code '{fake_iso}': ISO code does not exist in international registries, triggering mainframe fault."
        return modifications, True, "INVALID_ISO_FAULT", reason
