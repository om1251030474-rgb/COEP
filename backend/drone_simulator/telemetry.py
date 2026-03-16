"""
Drone Movement Simulation and Telemetry
Simulates real-time drone movement with interpolated positions
"""
import asyncio
import math
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timezone
import uuid
import logging
import random

logger = logging.getLogger(__name__)


class DroneSimulator:
    """Simulates drone movement and generates telemetry data"""
    
    def __init__(self):
        self.active_simulations: Dict[str, Dict] = {}
        self.callbacks: List[Callable] = []
        
    def interpolate_position(
        self, 
        start: Dict[str, float], 
        end: Dict[str, float], 
        progress: float
    ) -> Dict[str, float]:
        """
        Interpolate position between start and end points
        progress: 0.0 to 1.0
        """
        return {
            "lat": start["lat"] + (end["lat"] - start["lat"]) * progress,
            "lng": start["lng"] + (end["lng"] - start["lng"]) * progress
        }
    
    def calculate_bearing(
        self, 
        start: Dict[str, float], 
        end: Dict[str, float]
    ) -> float:
        """Calculate bearing/heading from start to end point"""
        lat1 = math.radians(start["lat"])
        lat2 = math.radians(end["lat"])
        delta_lon = math.radians(end["lng"] - start["lng"])
        
        x = math.sin(delta_lon) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lon)
        
        bearing = math.atan2(x, y)
        return (math.degrees(bearing) + 360) % 360
    
    def generate_telemetry(
        self, 
        drone_id: str, 
        position: Dict[str, float],
        target: Dict[str, float],
        progress: float,
        initial_battery: int,
        speed_kmh: float = 60
    ) -> Dict[str, Any]:
        """Generate telemetry data for a drone"""
        # Calculate battery drain (roughly 0.5% per km at 60 km/h)
        battery_drain = progress * 5  # Max 5% drain per trip
        current_battery = max(0, initial_battery - battery_drain)
        
        # Calculate distance remaining
        from dispatch_engine.dispatcher import haversine_distance
        remaining_distance = haversine_distance(
            position["lat"], position["lng"],
            target["lat"], target["lng"]
        )
        
        # Calculate ETA
        eta_hours = remaining_distance / speed_kmh if speed_kmh > 0 else 0
        eta_minutes = eta_hours * 60
        
        if eta_minutes < 1:
            eta_str = f"{int(eta_minutes * 60)} sec"
        else:
            eta_str = f"{int(eta_minutes)} min"
        
        # Determine status
        if progress >= 1.0:
            status = "arrived"
        elif progress > 0:
            status = "en-route"
        else:
            status = "dispatched"
        
        bearing = self.calculate_bearing(position, target)
        
        return {
            "drone_id": drone_id,
            "lat": round(position["lat"], 6),
            "lng": round(position["lng"], 6),
            "altitude": 50 + random.uniform(-5, 5),  # meters
            "speed": speed_kmh + random.uniform(-5, 5),
            "heading": round(bearing, 1),
            "battery": round(current_battery, 1),
            "eta": eta_str,
            "eta_minutes": round(eta_minutes, 2),
            "progress": round(progress * 100, 1),
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    async def simulate_flight(
        self,
        drone_id: str,
        start: Dict[str, float],
        target: Dict[str, float],
        initial_battery: int = 100,
        speed_kmh: float = 60,
        update_interval: float = 1.0,
        on_telemetry: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Simulate a drone flight from start to target
        Generates telemetry updates at specified interval
        """
        from dispatch_engine.dispatcher import haversine_distance
        
        total_distance = haversine_distance(start["lat"], start["lng"], target["lat"], target["lng"])
        total_time_hours = total_distance / speed_kmh
        total_steps = max(int(total_time_hours * 3600 / update_interval), 10)  # At least 10 steps
        
        simulation_id = f"SIM-{uuid.uuid4().hex[:8].upper()}"
        self.active_simulations[simulation_id] = {
            "drone_id": drone_id,
            "status": "active",
            "start": start,
            "target": target,
            "started_at": datetime.now(timezone.utc).isoformat()
        }
        
        logger.info(f"Starting flight simulation {simulation_id} for drone {drone_id}")
        
        telemetry_history = []
        
        try:
            for step in range(total_steps + 1):
                progress = step / total_steps
                position = self.interpolate_position(start, target, progress)
                
                telemetry = self.generate_telemetry(
                    drone_id, position, target, progress, initial_battery, speed_kmh
                )
                telemetry_history.append(telemetry)
                
                # Call telemetry callback if provided
                if on_telemetry:
                    await on_telemetry(telemetry)
                
                # Also call registered callbacks
                for callback in self.callbacks:
                    try:
                        await callback(telemetry)
                    except Exception as e:
                        logger.error(f"Telemetry callback error: {e}")
                
                if progress < 1.0:
                    await asyncio.sleep(update_interval)
            
            self.active_simulations[simulation_id]["status"] = "completed"
            
        except asyncio.CancelledError:
            self.active_simulations[simulation_id]["status"] = "cancelled"
            raise
        except Exception as e:
            self.active_simulations[simulation_id]["status"] = "error"
            self.active_simulations[simulation_id]["error"] = str(e)
            logger.error(f"Simulation error: {e}")
        
        return {
            "simulation_id": simulation_id,
            "drone_id": drone_id,
            "status": self.active_simulations[simulation_id]["status"],
            "total_steps": total_steps,
            "final_telemetry": telemetry_history[-1] if telemetry_history else None
        }
    
    def register_telemetry_callback(self, callback: Callable):
        """Register a callback function for telemetry updates"""
        self.callbacks.append(callback)
    
    def unregister_telemetry_callback(self, callback: Callable):
        """Unregister a telemetry callback"""
        if callback in self.callbacks:
            self.callbacks.remove(callback)
    
    def get_active_simulations(self) -> List[Dict[str, Any]]:
        """Get all active simulations"""
        return [
            {**sim, "id": sim_id}
            for sim_id, sim in self.active_simulations.items()
            if sim["status"] == "active"
        ]
    
    def cancel_simulation(self, simulation_id: str) -> bool:
        """Cancel an active simulation"""
        if simulation_id in self.active_simulations:
            self.active_simulations[simulation_id]["status"] = "cancelled"
            return True
        return False


# Singleton instance
_simulator_instance = None

def get_simulator() -> DroneSimulator:
    global _simulator_instance
    if _simulator_instance is None:
        _simulator_instance = DroneSimulator()
    return _simulator_instance


DEFAULT_DRONE_FLEET = [
    {"id": "DR01", "name": "Alpha-1", "lat": 18.5204, "lng": 73.8567, "battery": 95, "status": "available", "model": "DJI Matrice 300"},
    {"id": "DR02", "name": "Alpha-2", "lat": 18.5308, "lng": 73.8475, "battery": 88, "status": "available", "model": "DJI Matrice 300"},
    {"id": "DR03", "name": "Beta-1", "lat": 18.5912, "lng": 73.7389, "battery": 72, "status": "available", "model": "DJI Mavic 3E"},
    {"id": "DR04", "name": "Beta-2", "lat": 18.5793, "lng": 73.9089, "battery": 45, "status": "available", "model": "DJI Mavic 3E"},
    {"id": "DR05", "name": "Gamma-1", "lat": 18.5089, "lng": 73.9270, "battery": 100, "status": "available", "model": "DJI Matrice 30T"},
]
def get_default_fleet() -> List[Dict[str, Any]]:
    """Get the default drone fleet"""
    return [dict(d) for d in DEFAULT_DRONE_FLEET]  # Return copies
