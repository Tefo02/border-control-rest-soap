from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.adapters.rest_adapter import RestCountriesAdapter
from app.adapters.soap_adapter import SoapCountryInfoAdapter
from app.api.routes import router as inspections_router
from app.game.repository import InspectionRepository
from app.game.service import InspectionService

inspection_repository_instance = InspectionRepository()
rest_adapter_instance = RestCountriesAdapter()
soap_adapter_instance = SoapCountryInfoAdapter()

inspection_service_instance = InspectionService(
    repository=inspection_repository_instance,
    rest_adapter=rest_adapter_instance,
    soap_adapter=soap_adapter_instance
)

app = FastAPI(
    title="Border Control: 1999 vs 2026",
    description="Web Services Integration and Protocol Telemetry (SOAP WSDL vs REST JSON)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inspections_router)

static_path = Path("static").resolve()
static_path.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")
