"""
Smart Drone Dispatch Engine
Handles drone assignment, routing, and no-fly zone avoidance
"""
import math
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
import uuid
import logging
from shapely.geometry import Point, Polygon

logger = logging.getLogger(__name__)

# Default no-fly zones (example: government buildings, airports)
DEFAULT_NO_FLY_ZONES = [
    {
        "id": "NFZ001",
        "name": "Airport Zone",
        "type": "airport",
        "polygon": [(28.5500, 77.1000), (28.5600, 77.1000), (28.5600, 77.1200), (28.5500, 77.1200)]
    },
    {
        "id": "NFZ002", 
        "name": "Government Complex",
        "type": "restricted",
        "polygon": [(28.6100, 77.2100), (28.6150, 77.2100), (28.6150, 77.2150), (28.6100, 77.2150)]
    }
]


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth (in km)
    Using the Haversine formula
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def calculate_eta(distance_km: float, speed_kmh: float = 60) -> Tuple[float, str]:
    """Calculate ETA based on distance and speed"""
    if speed_kmh <= 0:
        return float('inf'), "N/A"
    
    time_hours = distance_km / speed_kmh
    time_minutes = time_hours * 60
    
    if time_minutes < 1:
        return time_minutes, f"{int(time_minutes * 60)} sec"
    elif time_minutes < 60:
        return time_minutes, f"{int(time_minutes)} min"
    else:
        hours = int(time_hours)
        mins = int((time_hours - hours) * 60)
        return time_minutes, f"{hours}h {mins}m"


class NoFlyZoneManager:
    """Manages no-fly zones using Shapely for geofencing"""
    
    def __init__(self, zones: Optional[List[Dict]] = None):
        self.zones = zones or DEFAULT_NO_FLY_ZONES
        self.polygons = {}
        self._build_polygons()
    
    def _build_polygons(self):
        """Build Shapely polygons from zone definitions"""
        for zone in self.zones:
            coords = [(lon, lat) for lat, lon in zone["polygon"]]  # Shapely uses (x, y) = (lon, lat)
            self.polygons[zone["id"]] = {
                "polygon": Polygon(coords),
                "info": zone
            }
    
    def is_in_no_fly_zone(self, lat: float, lon: float) -> Tuple[bool, Optional[Dict]]:
        """Check if a point is in any no-fly zone"""
        point = Point(lon, lat)
        
        for zone_id, zone_data in self.polygons.items():
            if zone_data["polygon"].contains(point):
                return True, zone_data["info"]
        
        return False, None
    
    def check_path(
        self, 
        start: Tuple[float, float], 
        end: Tuple[float, float], 
        segments: int = 10
    ) -> List[Dict[str, Any]]:
        """Check if a path crosses any no-fly zones"""
        violations = []
        lat1, lon1 = start
        lat2, lon2 = end
        
        for i in range(segments + 1):
            t = i / segments
            lat = lat1 + t * (lat2 - lat1)
            lon = lon1 + t * (lon2 - lon1)
            
            in_zone, zone_info = self.is_in_no_fly_zone(lat, lon)
            if in_zone and zone_info:
                violations.append({
                    "position": (lat, lon),
                    "segment": i,
                    "zone": zone_info
                })
        
        return violations
    
    def get_all_zones(self) -> List[Dict[str, Any]]:
        """Get all no-fly zones with their boundaries"""
        return [
            {
                "id": zone["id"],
                "name": zone["name"],
                "type": zone["type"],
                "coordinates": zone["polygon"]
            }
            for zone in self.zones
        ]


class DroneDispatcher:
    """Smart drone dispatch engine"""
    
    def __init__(self, no_fly_zones: Optional[List[Dict]] = None):
        self.no_fly_manager = NoFlyZoneManager(no_fly_zones)
        self.active_assignments: Dict[str, Dict] = {}
    
    def find_nearest_drone(
        self, 
        incident_lat: float, 
        incident_lon: float, 
        drones: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Find the nearest available drone to an incident"""
        available_drones = [d for d in drones if d.get("status") == "available"]
        
        if not available_drones:
            logger.warning("No available drones for dispatch")
            return None
        
        nearest = None
        min_distance = float('inf')
        
        for drone in available_drones:
            # Check if drone has sufficient battery
            if drone.get("battery", 0) < 20:
                continue
            
            distance = haversine_distance(
                drone["lat"], drone["lng"],
                incident_lat, incident_lon
            )
            
            # Check for no-fly zone violations
            violations = self.no_fly_manager.check_path(
                (drone["lat"], drone["lng"]),
                (incident_lat, incident_lon)
            )
            
            # Add penalty for routes through no-fly zones
            if violations:
                distance *= 1.5  # Increase effective distance
            
            if distance < min_distance:
                min_distance = distance
                nearest = {
                    **drone,
                    "distance": distance,
                    "has_path_violations": len(violations) > 0,
                    "violations": violations
                }
        
        return nearest
    
    def create_dispatch_assignment(
        self, 
        drone: Dict[str, Any], 
        incident: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a dispatch assignment for a drone to an incident"""
        distance = haversine_distance(
            drone["lat"], drone["lng"],
            incident["location"]["lat"], incident["location"]["lng"]
        )
        
        eta_minutes, eta_str = calculate_eta(distance)
        
        assignment = {
            "assignment_id": f"ASN-{uuid.uuid4().hex[:8].upper()}",
            "drone_id": drone["id"],
            "incident_id": incident["incident_id"],
            "status": "dispatched",
            "start_position": {"lat": drone["lat"], "lng": drone["lng"]},
            "target_position": incident["location"],
            "distance_km": round(distance, 2),
            "eta_minutes": round(eta_minutes, 1),
            "eta_display": eta_str,
            "dispatched_at": datetime.now(timezone.utc).isoformat(),
            "path_violations": drone.get("violations", [])
        }
        
        self.active_assignments[assignment["assignment_id"]] = assignment
        return assignment
    
    def dispatch_drone(
        self, 
        incident: Dict[str, Any], 
        drones: List[Dict[str, Any]]
    ) -> Tuple[Optional[Dict], Optional[Dict]]:
        """
        Main dispatch function
        Returns tuple of (assigned_drone, assignment) or (None, None) if no drone available
        """
        nearest = self.find_nearest_drone(
            incident["location"]["lat"],
            incident["location"]["lng"],
            drones
        )
        
        if nearest is None:
            return None, None
        
        assignment = self.create_dispatch_assignment(nearest, incident)
        
        return nearest, assignment
    
    def get_assignment(self, assignment_id: str) -> Optional[Dict[str, Any]]:
        """Get an active assignment by ID"""
        return self.active_assignments.get(assignment_id)
    
    def update_assignment_status(self, assignment_id: str, status: str) -> bool:
        """Update the status of an assignment"""
        if assignment_id in self.active_assignments:
            self.active_assignments[assignment_id]["status"] = status
            self.active_assignments[assignment_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
            return True
        return False
    
    def get_no_fly_zones(self) -> List[Dict[str, Any]]:
        """Get all no-fly zones"""
        return self.no_fly_manager.get_all_zones()


# Singleton instance
_dispatcher_instance = None

def get_dispatcher() -> DroneDispatcher:
    global _dispatcher_instance
    if _dispatcher_instance is None:
        _dispatcher_instance = DroneDispatcher()
    return _dispatcher_instance
