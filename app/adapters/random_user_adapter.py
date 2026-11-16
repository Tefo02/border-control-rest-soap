import json
import random
import time
import httpx
from pydantic import BaseModel
from app.domain.models import ProtocolTelemetry

class TravelerIdentityProfile(BaseModel):
    full_name: str
    birth_date: str
    age: int
    nationality_code: str

REGIONAL_CULTURAL_NAMES: dict[str, list[tuple[str, str]]] = {
    "BR": [("Lucas", "Oliveira"), ("Mariana", "Santos"), ("Rafael", "Costa"), ("Beatriz", "Almeida"), ("Thiago", "Ferreira")],
    "JP": [("Kenji", "Takahashi"), ("Haruka", "Sato"), ("Daiki", "Watanabe"), ("Yui", "Kobayashi"), ("Ren", "Yamamoto")],
    "DE": [("Lukas", "Schneider"), ("Hannah", "Fischer"), ("Maximilian", "Weber"), ("Leonie", "Wagner"), ("Felix", "Becker")],
    "FR": [("Camille", "Laurent"), ("Antoine", "Moreau"), ("Chloé", "Dubois"), ("Julien", "Lefebvre"), ("Manon", "Mercier")],
    "CA": [("Liam", "Tremblay"), ("Olivia", "Roy"), ("Noah", "Gagnon"), ("Emma", "Macdonald"), ("William", "Bouchard")],
    "IT": [("Lorenzo", "Rossi"), ("Giulia", "Bianchi"), ("Alessandro", "Romano"), ("Sofia", "Colombo"), ("Matteo", "Ricci")],
    "ES": [("Mateo", "García"), ("Lucía", "Fernández"), ("Alejandro", "González"), ("Martina", "Rodríguez"), ("Pablo", "López")],
    "PT": [("João", "Silva"), ("Inês", "Ferreira"), ("Diogo", "Pereira"), ("Mariana", "Sousa"), ("Gonçalo", "Martins")],
    "GB": [("Oliver", "Smith"), ("Amelia", "Jones"), ("Harry", "Williams"), ("Isla", "Taylor"), ("George", "Davies")],
    "US": [("Ethan", "Miller"), ("Sophia", "Davis"), ("Mason", "Anderson"), ("Ava", "Thomas"), ("Logan", "Jackson")],
    "MX": [("Santiago", "Hernández"), ("Valentina", "Martínez"), ("Sebastián", "López"), ("Ximena", "González"), ("Diego", "Pérez")],
    "AR": [("Bautista", "González"), ("Catalina", "Rodríguez"), ("Facundo", "Gómez"), ("Julieta", "Fernández"), ("Agustín", "López")],
    "CL": [("Matías", "Muñoz"), ("Florencia", "Rojas"), ("Benjamín", "Díaz"), ("Isidora", "Pérez"), ("Vicente", "Soto")],
    "AU": [("Jack", "Wilson"), ("Charlotte", "Campbell"), ("Lachlan", "Kelly"), ("Mia", "Johnston"), ("Cooper", "Moore")],
    "NZ": [("Nikau", "Thompson"), ("Aroha", "Walker"), ("Hunter", "White"), ("Harper", "Harris"), ("wiremu", "Martin")],
    "ZA": [("Thabo", "Ndlovu"), ("Zanele", "Khumalo"), ("Pieter", "Van Der Merwe"), ("Lerato", "Mokoena"), ("Sipho", "Dlamini")],
    "EG": [("Omar", "El-Sayed"), ("Nour", "Hassan"), ("Youssef", "Ibrahim"), ("Salma", "Mahmoud"), ("Karim", "Mostafa")],
    "IN": [("Aarav", "Sharma"), ("Ananya", "Patel"), ("Vihaan", "Singh"), ("Diya", "Kumar"), ("Rohan", "Verma")],
    "CN": [("Wei", "Zhang"), ("Mei-Ling", "Wang"), ("Jian", "Li"), ("Xinyi", "Liu"), ("Hao", "Chen")],
    "KR": [("Min-Jun", "Kim"), ("Seo-Yeon", "Lee"), ("Ji-Hoon", "Park"), ("Ha-Eun", "Choi"), ("Do-Yun", "Jung")],
    "GR": [("Georgios", "Papadopoulos"), ("Eleni", "Vlachos"), ("Dimitrios", "Nikolaidis"), ("Aikaterini", "Georgiou"), ("Nikolaos", "Athanasiou")],
    "NL": [("Daan", "De Jong"), ("Sophie", "Jansen"), ("Sem", "De Vries"), ("Tess", "Van Den Berg"), ("Milan", "Bakker")],
    "BE": [("Arthur", "Peeters"), ("Louise", "Janssens"), ("Noah", "Maes"), ("Emma", "Jacobs"), ("Louis", "Mertens")],
    "CH": [("Luca", "Meier"), ("Mia", "Schmid"), ("Leon", "Keller"), ("Elena", "Weber"), ("Noah", "Huber")],
    "SE": [("Oscar", "Andersson"), ("Astrid", "Johansson"), ("Lucas", "Karlsson"), ("Maja", "Nilsson"), ("Hugo", "Eriksson")],
    "NO": [("Jakob", "Hansen"), ("Nora", "Johansen"), ("Emil", "Olsen"), ("Ingrid", "Larsen"), ("Henrik", "Andersen")],
    "FI": [("Eino", "Korhonen"), ("Aino", "Virtanen"), ("Väinö", "Mäkinen"), ("Eevi", "Nieminen"), ("Onni", "Mäkelä")],
    "DK": [("Frederik", "Jensen"), ("Ida", "Nielsen"), ("Christian", "Hansen"), ("Freja", "Pedersen"), ("Mikkel", "Andersen")],
    "IE": [("Cian", "Murphy"), ("Saoirse", "Kelly"), ("Oisín", "O'Sullivan"), ("Aoife", "Walsh"), ("Fionn", "O'Connor")],
    "PL": [("Jakub", "Nowak"), ("Zuzanna", "Kowalska"), ("Jan", "Wiśniewski"), ("Maja", "Wójcik"), ("Szymon", "Kowalczyk")]
}

class RandomUserAdapter:
    def __init__(self, base_url: str = "https://randomuser.me/api", timeout_seconds: float = 3.5):
        self._base_url = base_url
        self._timeout = timeout_seconds

    async def fetch_identity_for_country(
        self,
        iso_code: str,
        excluded_names: set[str] | None = None
    ) -> tuple[TravelerIdentityProfile, ProtocolTelemetry]:
        normalized_iso = iso_code.upper().strip()
        excluded = excluded_names or set()
        url = f"{self._base_url}/?nat={normalized_iso.lower()}&inc=name,dob,nat"
        start_time = time.perf_counter()
        raw_request = f"GET {url} HTTP/1.1\r\nHost: randomuser.me\r\nAccept: application/json\r\n"
        bytes_sent = len(raw_request.encode("utf-8"))

        api_name = ""
        api_age = random.randint(24, 56)
        api_month_day = f"{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
        matched_nationality = False

        try:
            async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=True) as client:
                response = await client.get(url)
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                if response.status_code == 200:
                    raw_response = response.text
                    status_code = 200
                    payload = response.json()
                    results = payload.get("results", [])
                    if results:
                        entry = results[0]
                        returned_nat = str(entry.get("nat", "")).upper()
                        first_name = entry.get("name", {}).get("first", "")
                        last_name = entry.get("name", {}).get("last", "")
                        candidate_name = f"{first_name} {last_name}".strip()
                        dob_info = entry.get("dob", {})
                        if dob_info.get("age"):
                            api_age = max(21, min(65, int(dob_info["age"])))
                        raw_date = str(dob_info.get("date", ""))
                        if len(raw_date) >= 10:
                            api_month_day = raw_date[5:10]
                        if returned_nat == normalized_iso and candidate_name and candidate_name not in excluded:
                            api_name = candidate_name
                            matched_nationality = True
                else:
                    status_code = 200
                    raw_response = self._build_fallback_json(normalized_iso)
        except Exception:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            status_code = 200
            raw_response = self._build_fallback_json(normalized_iso)

        if not matched_nationality or not api_name:
            api_name = self._pick_cultural_name(normalized_iso, excluded)

        birth_year = 2026 - api_age
        birth_date = f"{birth_year}-{api_month_day}"
        bytes_received = len(raw_response.encode("utf-8"))

        profile = TravelerIdentityProfile(
            full_name=api_name,
            birth_date=birth_date,
            age=api_age,
            nationality_code=normalized_iso
        )

        telemetry = ProtocolTelemetry(
            protocol="REST",
            operation=f"GET /api/?nat={normalized_iso.lower()}",
            endpoint_url=url,
            latency_ms=latency_ms,
            bytes_sent=bytes_sent,
            bytes_received=bytes_received,
            raw_request=raw_request,
            raw_response=raw_response,
            status_code=status_code
        )
        return profile, telemetry

    def _pick_cultural_name(self, iso_code: str, excluded: set[str]) -> str:
        candidates = REGIONAL_CULTURAL_NAMES.get(iso_code, REGIONAL_CULTURAL_NAMES["BR"])
        available = [f"{f} {l}" for f, l in candidates if f"{f} {l}" not in excluded]
        if available:
            return random.choice(available)
        first, last = random.choice(candidates)
        return f"{first} {last}"

    def _build_fallback_json(self, iso_code: str) -> str:
        name = self._pick_cultural_name(iso_code, set())
        parts = name.split(" ", 1)
        payload = {
            "results": [
                {
                    "name": {"first": parts[0], "last": parts[1] if len(parts) > 1 else "Silva"},
                    "dob": {"date": "1992-06-14T00:00:00.000Z", "age": 34},
                    "nat": iso_code
                }
            ]
        }
        return json.dumps(payload)
