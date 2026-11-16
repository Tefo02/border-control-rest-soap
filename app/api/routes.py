from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.domain.models import (
    FaultSimulationResult,
    InspectionPassport,
    InterpolQueryResult,
    MainframeQueryResult,
    ShiftSessionState,
    VerdictResult,
    VerdictSubmission,
)
from app.game.service import InspectionService

class MainframeQueryRequest(BaseModel):
    query_iso_code: Optional[str] = None

class InterpolQueryRequest(BaseModel):
    passport_number: Optional[str] = None

router = APIRouter(prefix="/api/inspections", tags=["Inspections"])

def get_inspection_service() -> InspectionService:
    from app.main import inspection_service_instance
    return inspection_service_instance

@router.post("/shift/start", response_model=ShiftSessionState)
def start_new_shift_session(
    service: InspectionService = Depends(get_inspection_service)
) -> ShiftSessionState:
    next_day = (service._active_shift.day_number + 1) if service._active_shift else 1
    return service.start_new_shift(day_number=next_day)

@router.get("/shift/current", response_model=ShiftSessionState)
def get_current_shift_session(
    service: InspectionService = Depends(get_inspection_service)
) -> ShiftSessionState:
    return service.get_or_create_shift()

@router.get("/next", response_model=InspectionPassport)
async def generate_next_inspection(
    service: InspectionService = Depends(get_inspection_service)
) -> InspectionPassport:
    return await service.create_next_inspection()

@router.post("/debug/fault-simulation", response_model=FaultSimulationResult)
def trigger_fault_simulation(
    service: InspectionService = Depends(get_inspection_service)
) -> FaultSimulationResult:
    return service.simulate_protocol_faults()

@router.post("/{inspection_id}/mainframe-query", response_model=MainframeQueryResult)
def query_mainframe_records(
    inspection_id: str,
    request: MainframeQueryRequest,
    service: InspectionService = Depends(get_inspection_service)
) -> MainframeQueryResult:
    try:
        case = service._repository.get(inspection_id)
        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inspection session '{inspection_id}' not found."
            )
        iso_to_query = request.query_iso_code or case.passport.declared_iso_code
        return service.query_mainframe(inspection_id, iso_to_query)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

@router.post("/{inspection_id}/interpol-query", response_model=InterpolQueryResult)
def query_interpol_records(
    inspection_id: str,
    request: InterpolQueryRequest,
    service: InspectionService = Depends(get_inspection_service)
) -> InterpolQueryResult:
    try:
        case = service._repository.get(inspection_id)
        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inspection session '{inspection_id}' not found."
            )
        passport_num = request.passport_number or case.passport.passport_number
        return service.query_interpol_watchlist(inspection_id, passport_num)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

@router.post("/{inspection_id}/verdict", response_model=VerdictResult)
def submit_inspection_verdict(
    inspection_id: str,
    submission: VerdictSubmission,
    service: InspectionService = Depends(get_inspection_service)
) -> VerdictResult:
    try:
        return service.evaluate_verdict(
            inspection_id,
            submission.decision,
            submission.violation_category
        )
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
