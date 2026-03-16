"""
Drone Simulator Module
Provides drone movement simulation and telemetry generation
"""
from .telemetry import (
    DroneSimulator,
    get_simulator,
    get_default_fleet,
    DEFAULT_DRONE_FLEET
)

__all__ = [
    "DroneSimulator",
    "get_simulator",
    "get_default_fleet",
    "DEFAULT_DRONE_FLEET"
]
