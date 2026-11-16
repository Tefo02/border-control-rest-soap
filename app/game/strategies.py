import abc
from app.domain.models import CountryRecord

class FraudStrategy(abc.ABC):
    @abc.abstractmethod
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        pass

class LegitimateStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        purpose = context.get("profile", {}).get("purpose", "Business Conference")
        speech = f"Hello officer. I am arriving from {canonical.capital} for {purpose.lower()}."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2031-08-14",
            "is_wanted_interpol": False,
            "dialogue_speech": speech,
            "violation_category": "NONE",
            "interrogation_responses": {
                "origin": f"My home is in {canonical.capital}, {canonical.name}. My embassy phone code is +{canonical.phone_code}.",
                "currency": f"I declared {canonical.currency_code} on my customs manifest, which is our official legal tender.",
                "purpose": f"I am visiting for {purpose}. All my invitations and return tickets are confirmed."
            }
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
        fake_capital = self.ALTERNATIVE_CAPITALS.get(canonical.iso_code, f"New {canonical.capital}")
        purpose = context.get("profile", {}).get("purpose", "Tourism")
        speech = f"Good day. I am traveling from our national capital, {fake_capital}. Here are my papers."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": fake_capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2029-11-20",
            "is_wanted_interpol": False,
            "dialogue_speech": speech,
            "violation_category": "WSDL_MISMATCH",
            "interrogation_responses": {
                "origin": f"Yes, my passport and manifest both list {fake_capital} as the capital of {canonical.name}.",
                "currency": f"I am carrying {canonical.currency_code} bank notes as declared on the form.",
                "purpose": f"I am entering the country for {purpose}."
            }
        }
        reason = f"Capital forgery: document states capital as '{fake_capital}', but official WSDL mainframe returned '{canonical.capital}'."
        return modifications, True, "CAPITAL_MISMATCH", reason

class CurrencyMismatchStrategy(FraudStrategy):
    ALTERNATIVE_CURRENCIES = {
        "BR": "USD",
        "JP": "CNY",
        "DE": "GBP",
        "FR": "CHF",
        "CA": "EUR",
        "GB": "USD",
        "AU": "NZD"
    }

    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        fake_currency = self.ALTERNATIVE_CURRENCIES.get(canonical.iso_code, "XDR")
        purpose = context.get("profile", {}).get("purpose", "Trade Audit")
        speech = f"Officer, I am arriving from {canonical.capital} with my funds declared on the manifest."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": fake_currency,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2030-05-18",
            "is_wanted_interpol": False,
            "dialogue_speech": speech,
            "violation_category": "WSDL_MISMATCH",
            "interrogation_responses": {
                "origin": f"I departed from {canonical.capital} Airport this morning.",
                "currency": f"My manifest lists {fake_currency} as the national currency of {canonical.name}. Is that not right?",
                "purpose": f"My company sent me for {purpose}."
            }
        }
        reason = f"Currency fraud: manifest declares '{fake_currency}', but official WSDL mainframe specifies '{canonical.currency_code}'."
        return modifications, True, "CURRENCY_MISMATCH", reason

class DialingCodeMismatchStrategy(FraudStrategy):
    ALTERNATIVE_CODES = {
        "BR": "54",
        "JP": "82",
        "DE": "43",
        "FR": "32",
        "CA": "44",
        "GB": "353"
    }

    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        fake_code = self.ALTERNATIVE_CODES.get(canonical.iso_code, "999")
        purpose = context.get("profile", {}).get("purpose", "Diplomacy")
        speech = f"Greetings. My documents from {canonical.name} are on the desk for your review."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": fake_code,
            "is_expired": False,
            "expiration_date": "2028-12-05",
            "is_wanted_interpol": False,
            "dialogue_speech": speech,
            "violation_category": "WSDL_MISMATCH",
            "interrogation_responses": {
                "origin": f"I live in {canonical.capital}. My telecom prefix on the manifest is +{fake_code}.",
                "currency": f"I only carry {canonical.currency_code} for my stay.",
                "purpose": f"I am scheduled for {purpose} this week."
            }
        }
        reason = f"Telecom dialing code forgery: manifest states +{fake_code}, whereas international WSDL records mandate +{canonical.phone_code}."
        return modifications, True, "DIALING_CODE_MISMATCH", reason

class InvalidIsoFaultStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        fake_iso = "ZZ"
        speech = "I am an envoy from an autonomous enclave. Please process my clearance."
        modifications = {
            "declared_iso_code": fake_iso,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2032-01-01",
            "is_wanted_interpol": False,
            "dialogue_speech": speech,
            "violation_category": "WSDL_MISMATCH",
            "interrogation_responses": {
                "origin": f"My passport bears sovereignty code '{fake_iso}'. Try querying it on your mainframe.",
                "currency": f"We use {canonical.currency_code} in our jurisdiction.",
                "purpose": "Diplomatic courier transit."
            }
        }
        reason = f"Fabricated sovereign nation code '{fake_iso}': nonexistent ISO code triggering mainframe WSDL fault."
        return modifications, True, "INVALID_ISO_FAULT", reason

class ExpiredPassportStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        speech = f"Officer, I have been in transit from {canonical.capital} for a long time. Please stamp me through."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": True,
            "expiration_date": "2022-03-15",
            "is_wanted_interpol": False,
            "dialogue_speech": speech,
            "violation_category": "EXPIRED_PASSPORT",
            "interrogation_responses": {
                "origin": f"I am a citizen of {canonical.name}, born and raised in {canonical.capital}.",
                "currency": f"Everything on my currency manifest ({canonical.currency_code}) is accurate.",
                "purpose": "I forgot to renew my passport booklet before boarding, please overlook the expiration date!"
            }
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
        speech = f"Good day. I am a citizen of {mismatched_city} and only use {mismatched_curr} currency."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2029-07-22",
            "is_wanted_interpol": False,
            "dialogue_speech": speech,
            "violation_category": "VERBAL_CONTRADICTION",
            "interrogation_responses": {
                "origin": f"Wait... my passport says {canonical.name}, but I told you I hail from {mismatched_city}!",
                "currency": f"I insist my domestic currency is {mismatched_curr}, regardless of what the document says.",
                "purpose": "Just let me through, do not mind what I said earlier!"
            }
        }
        reason = f"Verbal testimony contradiction: traveler claims citizenship in '{mismatched_city}' with '{mismatched_curr}', contradicting passport '{canonical.name}'."
        return modifications, True, "VERBAL_CONTRADICTION", reason

class PhotoMismatchStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        passenger_name = context.get("profile", {}).get("name", "Traveler")
        impostor_seed = f"ImpostorDouble_{passenger_name.replace(' ', '')}_X99"
        impostor_photo_url = f"https://api.dicebear.com/9.x/notionists/svg?seed={impostor_seed}&flip=true"
        speech = f"Hello officer. This is definitely my own passport from {canonical.capital}. I just got a new haircut."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2030-09-12",
            "is_wanted_interpol": False,
            "passport_photo_url": impostor_photo_url,
            "dialogue_speech": speech,
            "violation_category": "BIOMETRIC_MISMATCH",
            "interrogation_responses": {
                "origin": f"I am from {canonical.capital}, {canonical.name}. Why do you keep staring at my passport photo?",
                "currency": f"My {canonical.currency_code} declaration is completely in order.",
                "purpose": "I swear that photo in the passport is me, the camera lens at the consulate was distorted!"
            }
        }
        reason = "Biometric photo mismatch: the portrait printed on the passport belongs to a different individual than the traveler at the booth."
        return modifications, True, "PHOTO_MISMATCH", reason

class BirthAgeMismatchStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        real_birth = context.get("profile", {}).get("birth", "1992-06-14")
        forged_age = 68
        speech = f"Good afternoon. I am arriving from {canonical.capital}. All my personal details are printed clearly."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2030-04-19",
            "is_wanted_interpol": False,
            "forged_age": forged_age,
            "dialogue_speech": speech,
            "violation_category": "BIOMETRIC_MISMATCH",
            "interrogation_responses": {
                "origin": f"I reside in {canonical.capital}, {canonical.name}.",
                "currency": f"I carry {canonical.currency_code} currency.",
                "purpose": f"Wait... my birth date says {real_birth} but my passport states I am {forged_age} years old? Must be a typo!"
            }
        }
        reason = f"Biometric age discrepancy: birth date '{real_birth}' does not match stated age '{forged_age} YRS' in 2026."
        return modifications, True, "BIRTH_AGE_MISMATCH", reason

class InterpolWatchlistStrategy(FraudStrategy):
    def apply(self, canonical: CountryRecord, context: dict) -> tuple[dict, bool, str, str]:
        speech = f"Hello officer. My {canonical.name} passport is completely valid. No need to check the wanted bulletin."
        modifications = {
            "declared_iso_code": canonical.iso_code,
            "declared_capital": canonical.capital,
            "declared_currency_code": canonical.currency_code,
            "declared_phone_code": canonical.phone_code,
            "is_expired": False,
            "expiration_date": "2028-10-10",
            "is_wanted_interpol": True,
            "dialogue_speech": speech,
            "violation_category": "INTERPOL_WANTED",
            "interrogation_responses": {
                "origin": f"I am from {canonical.capital}, {canonical.name}. All my WSDL fields are genuine.",
                "currency": f"I have {canonical.currency_code} declared properly.",
                "purpose": "Please do not compare my face against the Daily Wanted Fugitives list!"
            }
        }
        reason = "Interpol Red Notice Alert: traveler matches the Daily Wanted Criminals Bulletin."
        return modifications, True, "INTERPOL_WANTED", reason
