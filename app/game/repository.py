from typing import Optional
from app.domain.models import InspectionCase

class InspectionRepository:
    def __init__(self):
        self._storage: dict[str, InspectionCase] = {}

    def save(self, case: InspectionCase) -> None:
        self._storage[case.inspection_id] = case

    def get(self, inspection_id: str) -> Optional[InspectionCase]:
        return self._storage.get(inspection_id)

    def delete(self, inspection_id: str) -> None:
        self._storage.pop(inspection_id, None)

    def count(self) -> int:
        return len(self._storage)
