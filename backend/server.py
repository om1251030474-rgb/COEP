from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import os
import logging
import uuid
import asyncio
import json
import aiofiles
import urllib.parse

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ====================
# In-Memory State
# ====================
drone_fleet: Dict[str, Dict] = {}
active_simulations: Dict[str, asyncio.Task] = {}

def initialize_fleet():
    """Initialize drone fleet from simulator defaults"""
    try:
        from drone_simulator import get_default_fleet
        global drone_fleet
        for drone in get_default_fleet():
            drone_fleet[drone["id"]] = drone
    except ImportError:
        logger.warning("drone_simulator module not found. Starting with empty fleet.")

# ====================
# Lifespan Management (Replaces on_event)
# ====================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    initialize_fleet()
    logger.info("Drone Emergency Response System started")
    logger.info(f"Initialized {len(drone_fleet)} drones in fleet")
    yield
    # Shutdown
    logger.info("Shutting down... Cancelling active simulations.")
    for task in active_simulations.values():
        task.cancel()
    if 'client' in globals():
        client.close()
    logger.info("System shutdown complete")

# Initialize FastAPI App (Only Once)
app = FastAPI(
    title="Urban Drone Emergency Response System",
    description="AI-powered emergency detection and drone dispatch platform",
    version="1.0.0",
    lifespan=lifespan
)

# Consolidated CORS Configuration
# Note: allow_credentials=True requires explicit origins (cannot be '*')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
try:
    # 1. Your username and password
    username = urllib.parse.quote_plus("bankark545_db_user")
    password = urllib.parse.quote_plus("Kunal@25")
    
    # 2. Your specific cluster address
    cluster_address = "cluster0.sobjaua.mongodb.net"
    
    # 3. Combine them safely
    mongo_url = f"mongodb+srv://{username}:{password}@{cluster_address}/?retryWrites=true&w=majority&appName=Cluster0"
    
    db_name = "drone_system"
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    logger.info("Successfully connected to MongoDB Atlas!")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {e}")


# Create API router
api_router = APIRouter(prefix="/api")

# Upload directory
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# File validation constants
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"]
ALLOWED_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi"]

# ====================
# Pydantic Models
# ====================

class IncidentLocation(BaseModel):
    lat: float
    lng: float

class IncidentCreate(BaseModel):
    latitude: float
    longitude: float
    incident_type: str

class Incident(BaseModel):
    model_config = ConfigDict(extra="ignore")
    incident_id: str = Field(default_factory=lambda: f"INC-{uuid.uuid4().hex[:8].upper()}")
    type: str
    severity: str = "medium"
    location: IncidentLocation
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = "active"
    video_path: Optional[str] = None
    ai_verified: bool = False
    ai_detections: Optional[List[Dict]] = None
    assigned_drone: Optional[str] = None
    reported_by: str = "citizen"

class DroneModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    lat: float
    lng: float
    battery: float
    status: str
    model: str = "DJI Matrice 300"

class DroneAssignment(BaseModel):
    assignment_id: str
    drone_id: str
    incident_id: str
    status: str
    eta_display: str
    distance_km: float

class TelemetryData(BaseModel):
    drone_id: str
    lat: float
    lng: float
    altitude: float
    speed: float
    heading: float
    battery: float
    eta: str
    status: str
    timestamp: str

class DroneCreate(BaseModel):
    name: str
    lat: float
    lng: float
    battery: float = 100
    model: str = "DJI Matrice 300"
    
class DroneCrashReport(BaseModel):
    drone_id: str
    lat: float
    lng: float
    reason: Optional[str] = "unknown"

# ====================
# WebSocket Manager
# ====================

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.drone_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_type: str = "dashboard"):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected: {client_type}. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Remaining: {len(self.active_connections)}")
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Broadcast error: {e}")
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)
    
    async def send_telemetry(self, telemetry: Dict[str, Any]):
        await self.broadcast({"type": "telemetry", "data": telemetry})
    
    async def send_incident_alert(self, incident: Dict[str, Any]):
        await self.broadcast({"type": "incident_alert", "data": incident})
    
    async def send_drone_dispatch(self, assignment: Dict[str, Any]):
        await self.broadcast({"type": "drone_dispatch", "data": assignment})

ws_manager = ConnectionManager()

# ====================
# API Endpoints
# ====================

@api_router.get("/")
async def root():
    return {"message": "Urban Drone Emergency Response System API", "status": "operational"}

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "database": "connected",
            "websocket": f"{len(ws_manager.active_connections)} clients"
        }
    }

# ====================
# Incident Endpoints
# ====================

@api_router.post("/report-incident")
async def report_incident(
    background_tasks: BackgroundTasks,
    video_file: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    incident_type: str = Form(...)
):
    if video_file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_VIDEO_TYPES)}")
    
    file_ext = Path(video_file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file extension. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    
    content = await video_file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB")
    
    if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    file_id = uuid.uuid4().hex[:12]
    filename = f"incident_{file_id}{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    incident = Incident(
        type=incident_type,
        severity=get_severity_for_type(incident_type),
        location=IncidentLocation(lat=latitude, lng=longitude),
        video_path=str(file_path),
        reported_by="citizen"
    )
    
    incident_dict = incident.model_dump()
    await db.incidents.insert_one(incident_dict)
    
    background_tasks.add_task(analyze_incident_video_task, incident.incident_id, str(file_path))
    await ws_manager.send_incident_alert(incident_dict)
    background_tasks.add_task(auto_dispatch_drone, incident.incident_id)
    
    logger.info(f"Incident reported: {incident.incident_id} - {incident_type} at ({latitude}, {longitude})")
    
    return {
        "status": "received",
        "incident_id": incident.incident_id,
        "incident_verified": False,
        "message": "Incident report received. Processing AI analysis.",
        "location": {"lat": latitude, "lng": longitude},
        "type": incident_type
    }

def get_severity_for_type(incident_type: str) -> str:
    severity_map = {
        "fire": "critical",
        "accident": "critical",
        "medical_emergency": "critical",
        "crime": "high",
        "fallen_person": "critical",
        "crowd_gathering": "medium",
        "other": "medium"
    }
    return severity_map.get(incident_type.lower().replace(" ", "_"), "medium")

async def analyze_incident_video_task(incident_id: str, video_path: str):
    try:
        from detection import analyze_incident_video
        result = analyze_incident_video(video_path)
        
        ai_verified = len(result.get("incidents", [])) > 0
        await db.incidents.update_one(
            {"incident_id": incident_id},
            {"$set": {
                "ai_verified": ai_verified,
                "ai_detections": result.get("incidents", []),
                "ai_analysis_completed": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"AI analysis completed for {incident_id}: verified={ai_verified}")
        
        await ws_manager.broadcast({
            "type": "incident_update",
            "data": {
                "incident_id": incident_id,
                "ai_verified": ai_verified,
                "ai_detections": result.get("incidents", [])
            }
        })
        
    except Exception as e:
        logger.error(f"AI analysis error for {incident_id}: {e}")

async def auto_dispatch_drone(incident_id: str):
    try:
        incident = await db.incidents.find_one({"incident_id": incident_id}, {"_id": 0})
        if not incident:
            return
        
        from dispatch_engine import get_dispatcher
        dispatcher = get_dispatcher()
        available_drones = [d for d in drone_fleet.values() if d["status"] == "available"]
        
        if not available_drones:
            logger.warning(f"No available drones for incident {incident_id}")
            return
        
        drone, assignment = dispatcher.dispatch_drone(incident, available_drones)
        
        if drone and assignment:
            drone_fleet[drone["id"]]["status"] = "en-route"
            
            await db.incidents.update_one(
                {"incident_id": incident_id},
                {"$set": {"assigned_drone": drone["id"], "status": "responding"}}
            )
            
            await db.assignments.insert_one(assignment)
            await ws_manager.send_drone_dispatch(assignment)
            await start_drone_simulation(drone["id"], assignment)
            
            logger.info(f"Drone {drone['id']} dispatched to incident {incident_id}")
            
    except Exception as e:
        logger.error(f"Auto dispatch error: {e}")

def _cleanup_simulation_task(assignment_id: str, task: asyncio.Task):
    """Callback to remove completed tasks from the active_simulations dict."""
    try:
        task.result() 
    except asyncio.CancelledError:
        logger.info(f"Simulation {assignment_id} was cancelled.")
    except Exception as e:
        logger.error(f"Simulation {assignment_id} failed: {e}")
    finally:
        active_simulations.pop(assignment_id, None)

async def start_drone_simulation(drone_id: str, assignment: Dict):
    try:
        from drone_simulator import get_simulator
        simulator = get_simulator()
        drone = drone_fleet.get(drone_id)
        
        if not drone:
            return
        
        async def telemetry_callback(telemetry: Dict):
            drone_fleet[drone_id]["lat"] = telemetry["lat"]
            drone_fleet[drone_id]["lng"] = telemetry["lng"]
            drone_fleet[drone_id]["battery"] = telemetry["battery"]
            drone_fleet[drone_id]["altitude"] = telemetry["altitude"]
            drone_fleet[drone_id]["speed"] = telemetry["speed"]
            drone_fleet[drone_id]["heading"] = telemetry["heading"]
            drone_fleet[drone_id]["task"] = "responding"
            
            await ws_manager.send_telemetry(telemetry)
            
            if telemetry["status"] == "arrived":
                drone_fleet[drone_id]["status"] = "on-scene"
                await db.incidents.update_one(
                    {"incident_id": assignment["incident_id"]},
                    {"$set": {"status": "drone_arrived"}}
                )
        
        task = asyncio.create_task(
            simulator.simulate_flight(
                drone_id=drone_id,
                start={"lat": drone["lat"], "lng": drone["lng"]},
                target=assignment["target_position"],
                initial_battery=drone["battery"],
                speed_kmh=60,
                update_interval=1.0,
                on_telemetry=telemetry_callback
            )
        )
        
        assignment_id = assignment.get("assignment_id", f"sim_{uuid.uuid4().hex[:6]}")
        active_simulations[assignment_id] = task
        # Attach the cleanup callback to prevent memory leaks
        task.add_done_callback(lambda t: _cleanup_simulation_task(assignment_id, t))
        
    except Exception as e:
        logger.error(f"Simulation start error: {e}")

@api_router.get("/incidents", response_model=List[Dict])
async def get_incidents(status: Optional[str] = None, limit: int = 50):
    query = {}
    if status:
        query["status"] = status
    incidents = await db.incidents.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return incidents

@api_router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str):
    incident = await db.incidents.find_one({"incident_id": incident_id}, {"_id": 0})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@api_router.patch("/incidents/{incident_id}/status")
async def update_incident_status(incident_id: str, status: str):
    valid_statuses = ["active", "responding", "drone_arrived", "resolved", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid_statuses}")
    
    result = await db.incidents.update_one(
        {"incident_id": incident_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    await ws_manager.broadcast({
        "type": "incident_update",
        "data": {"incident_id": incident_id, "status": status}
    })
    
    return {"status": "updated", "incident_id": incident_id, "new_status": status}

# ====================
# Drone Endpoints
# ====================

@api_router.get("/drones", response_model=List[Dict])
async def get_drones():
    return list(drone_fleet.values())

@api_router.get("/drones/{drone_id}")
async def get_drone(drone_id: str):
    drone = drone_fleet.get(drone_id)
    if not drone:
        raise HTTPException(status_code=404, detail="Drone not found")
    return drone

@api_router.patch("/drones/{drone_id}/status")
async def update_drone_status(drone_id: str, status: str):
    if drone_id not in drone_fleet:
        raise HTTPException(status_code=404, detail="Drone not found")
    
    valid_statuses = ["available", "en-route", "on-scene", "returning", "charging", "maintenance"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid_statuses}")
    
    drone_fleet[drone_id]["status"] = status
    
    await ws_manager.broadcast({
        "type": "drone_update",
        "data": drone_fleet[drone_id]
    })
    
    return {"status": "updated", "drone_id": drone_id, "new_status": status}

@api_router.post("/drones/{drone_id}/dispatch")
async def dispatch_drone(drone_id: str, incident_id: str, background_tasks: BackgroundTasks):
    if drone_id not in drone_fleet:
        raise HTTPException(status_code=404, detail="Drone not found")
    
    drone = drone_fleet[drone_id]
    if drone["status"] != "available":
        raise HTTPException(status_code=400, detail="Drone not available for dispatch")
    
    incident = await db.incidents.find_one({"incident_id": incident_id}, {"_id": 0})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    from dispatch_engine import get_dispatcher
    dispatcher = get_dispatcher()
    _, assignment = dispatcher.dispatch_drone(incident, [drone])
    
    if assignment:
        drone_fleet[drone_id]["status"] = "en-route"
        await db.incidents.update_one(
            {"incident_id": incident_id},
            {"$set": {"assigned_drone": drone_id, "status": "responding"}}
        )
        await db.assignments.insert_one(assignment)
        await ws_manager.send_drone_dispatch(assignment)
        
        background_tasks.add_task(start_drone_simulation, drone_id, assignment)
        return assignment
    
    raise HTTPException(status_code=500, detail="Failed to create assignment")

@api_router.post("/drones/{drone_id}/return")
async def return_drone(drone_id: str):
    if drone_id not in drone_fleet:
        raise HTTPException(status_code=404, detail="Drone not found")
    
    drone_fleet[drone_id]["status"] = "returning"
    
    await ws_manager.broadcast({
        "type": "drone_update",
        "data": drone_fleet[drone_id]
    })
    return {"status": "returning", "drone_id": drone_id}

@api_router.get("/no-fly-zones")
async def get_no_fly_zones():
    from dispatch_engine import get_dispatcher
    dispatcher = get_dispatcher()
    return dispatcher.get_no_fly_zones()

@api_router.get("/assignments")
async def get_assignments(active_only: bool = True):
    query = {}
    if active_only:
        query["status"] = {"$in": ["dispatched", "en-route", "on-scene"]}
    
    assignments = await db.assignments.find(query, {"_id": 0}).to_list(100)
    return assignments

@api_router.get("/stats")
async def get_statistics():
    total_incidents = await db.incidents.count_documents({})
    active_incidents = await db.incidents.count_documents({"status": {"$in": ["active", "responding"]}})
    resolved_incidents = await db.incidents.count_documents({"status": "resolved"})
    
    total_drones = len(drone_fleet)
    available_drones = sum(1 for d in drone_fleet.values() if d["status"] == "available")
    active_drones = sum(1 for d in drone_fleet.values() if d["status"] in ["en-route", "on-scene"])
    
    pipeline = [
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    incident_types = await db.incidents.aggregate(pipeline).to_list(10)
    
    return {
        "incidents": {
            "total": total_incidents,
            "active": active_incidents,
            "resolved": resolved_incidents
        },
        "drones": {
            "total": total_drones,
            "available": available_drones,
            "active": active_drones
        },
        "incident_breakdown": incident_types,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    
@api_router.post("/admin/drones/add")
async def add_drone(drone: DroneCreate):

    drone_id = f"DR{str(uuid.uuid4().hex[:4]).upper()}"

    new_drone = {
        "id": drone_id,
        "name": drone.name,
        "lat": drone.lat,
        "lng": drone.lng,
        "battery": drone.battery,
        "status": "available",
        "model": drone.model
    }

    drone_fleet[drone_id] = new_drone

    await ws_manager.broadcast({
        "type": "drone_added",
        "data": new_drone
    })

    return {"status": "added", "drone": new_drone}


@api_router.delete("/admin/drones/{drone_id}")
async def remove_drone(drone_id: str):

    if drone_id not in drone_fleet:
        raise HTTPException(status_code=404, detail="Drone not found")

    removed = drone_fleet.pop(drone_id)

    await ws_manager.broadcast({
        "type": "drone_removed",
        "data": {"drone_id": drone_id}
    })

    return {"status": "removed", "drone": removed}

@api_router.post("/admin/drones/crash")
async def report_drone_crash(report: DroneCrashReport):

    if report.drone_id not in drone_fleet:
        raise HTTPException(status_code=404, detail="Drone not found")

    crash_data = {
        "crash_id": f"CR-{uuid.uuid4().hex[:6].upper()}",
        "drone_id": report.drone_id,
        "last_location": {
            "lat": report.lat,
            "lng": report.lng
        },
        "reason": report.reason,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    await db.drone_crashes.insert_one(crash_data)

    drone_fleet[report.drone_id]["status"] = "crashed"

    await ws_manager.broadcast({
        "type": "drone_crash",
        "data": crash_data
    })

    return {"status": "crash_recorded", "data": crash_data}

@api_router.get("/admin/drones/crashes")
async def get_crash_reports():

    crashes = await db.drone_crashes.find({}, {"_id":0}).sort("timestamp",-1).to_list(50)

    return crashes

@api_router.get("/admin/drones/telemetry")
async def get_drone_telemetry():

    telemetry = []

    for drone in drone_fleet.values():

        telemetry.append({
            "id": drone["id"],
            "name": drone["name"],
            "lat": drone["lat"],
            "lng": drone["lng"],
            "battery": drone["battery"],
            "status": drone["status"],
            "model": drone["model"]
        })

    return telemetry

# ====================
# WebSocket Endpoint
# ====================

@api_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "initial_state",
            "data": {
                "drones": list(drone_fleet.values()),
                "connected_clients": len(ws_manager.active_connections)
            }
        })
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif message.get("type") == "subscribe":
                pass
                
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

# Include router
app.include_router(api_router)