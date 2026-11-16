import abc
from app.domain.models import CountryRecord

class FraudStrategy(abc.ABC):
    @abc.abstractmethod
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        pass

class LegitimateStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        speech = f"Hello officer. I am arriving from {canonical.capital} on a business trip with {canonical.currency_code} currency."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2031-08-14",
            "is_wanted_interpol": False,
            "dialogue_speech": speech
        }
        return modifications, False, "LEGITIMATE", "Passport data and spoken declaration match official government records."

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

    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        fake_capital = self.ALTERNATIVE_CAPITALS.get(canonical.iso_code, f"Fake-{canonical.capital}")
        speech = f"Good day. I am traveling from my hometown {fake_capital}. Here are my travel credentials."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": fake_capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2029-11-20",
            "is_wanted_interpol": False,
            "dialogue_speech": speech
        }
        reason = f"Capital forgery: document states capital as '{fake_capital}', but official mainframe returned '{canonical.capital}'."
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

    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        fake_currency = self.ALTERNATIVE_CURRENCIES.get(canonical.iso_code, "XXX")
        speech = f"Officer, I am carrying my savings in {fake_currency}. Everything should be in order."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": fake_currency,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2030-05-18",
            "is_wanted_interpol": False,
            "dialogue_speech": speech
        }
        reason = f"Currency fraud: traveler carries contraband currency '{fake_currency}', but official mainframe specifies '{canonical.currency_code}'."
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

    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        fake_code = self.ALTERNATIVE_CODES.get(canonical.iso_code, "999")
        speech = f"Greetings. You can contact my embassy at phone prefix +{fake_code} if needed."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": fake_code,
            "is_expired": False,
            "expiration_date": "2028-12-05",
            "is_wanted_interpol": False,
            "dialogue_speech": speech
        }
        reason = f"Telecom dialing code forgery: document states +{fake_code}, whereas international records mandate +{canonical.phone_code}."
        return modifications, True, "DIALING_CODE_MISMATCH", reason

class InvalidIsoFaultStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        fake_iso = "ZZ"
        speech = "I am an emissary from a special administrative territory. My papers are diplomatic."
        modifications = {
            "declared_iso_code": fake_iso,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2032-01-01",
            "is_wanted_interpol": False,
            "dialogue_speech": speech
        }
        reason = f"Fabricated sovereign nation code '{fake_iso}': nonexistent country code triggering mainframe schema fault."
        return modifications, True, "INVALID_ISO_FAULT", reason

class ExpiredPassportStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        speech = "Officer, I have been traveling across borders for months. Please stamp my passport quickly."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": True,
            "expiration_date": "2022-03-15",
            "is_wanted_interpol": False,
            "dialogue_speech": speech
        }
        reason = "Expired travel document: passport expired on 2022-03-15. Border regulations require valid documentation."
        return modifications, True, "EXPIRED_PASSPORT", reason

class SpeechContradictionStrategy(FraudStrategy):
    CONTRADICTORY_DESTINATIONS = {
        "BR": ("Tokyo", "JPY"),
        "JP": ("Paris", "EUR"),
        "DE": ("London", "GBP"),
        "FR": ("Brasilia", "BRL"),
        "US": ("Ottawa", "CAD"),
        "IT": ("Madrid", "EUR")
    }

    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        mismatched_city, mismatched_curr = self.CONTRADICTORY_DESTINATIONS.get(
            canonical.iso_code,
            ("Atlantis", "XYZ")
        )
        speech = f"Good day. I am a native resident of {mismatched_city} and carry {mismatched_curr}. Please inspect my booklet."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2029-07-22",
            "is_wanted_interpol": False,
            "dialogue_speech": speech
        }
        reason = f"Verbal testimony contradiction: traveler claims residency in '{mismatched_city}', directly contradicting passport issuing authority '{canonical.name}'."
        return modifications, True, "VERBAL_CONTRADICTION", reason

class InterpolWatchlistStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        speech = "Hello officer. I am here for an urgent confidential transfer. No need to detain me."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2028-10-10",
            "is_wanted_interpol": True,
            "dialogue_speech": speech
        }
        reason = "Interpol Red Notice Alert: biometric ID matches active international warrant for financial espionage."
        return modifications, True, "INTERPOL_WANTED", reason
