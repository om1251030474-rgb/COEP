"""
Object Tracker Module
Implements simple tracking for detected objects across frames
"""
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)


class SimpleTracker:
    """
    Simple centroid-based object tracker
    Tracks objects across frames using centroid distance
    """
    
    def __init__(self, max_disappeared: int = 30, max_distance: float = 100.0):
        self.next_object_id = 0
        self.objects: Dict[int, Dict[str, Any]] = {}
        self.disappeared: Dict[int, int] = {}
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance
        
    def _calculate_centroid(self, bbox: List[float]) -> Tuple[float, float]:
        """Calculate centroid of a bounding box"""
        x1, y1, x2, y2 = bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)
    
    def _euclidean_distance(self, p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        """Calculate Euclidean distance between two points"""
        return np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)
    
    def register(self, detection: Dict[str, Any]) -> int:
        """Register a new object"""
        object_id = self.next_object_id
        self.objects[object_id] = {
            "id": object_id,
            "tracking_id": f"TRK-{uuid.uuid4().hex[:6].upper()}",
            "centroid": self._calculate_centroid(detection["bbox"]),
            "bbox": detection["bbox"],
            "class_name": detection.get("class_name", "unknown"),
            "first_seen": datetime.now(timezone.utc).isoformat(),
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "positions": [self._calculate_centroid(detection["bbox"])]
        }
        self.disappeared[object_id] = 0
        self.next_object_id += 1
        return object_id
    
    def deregister(self, object_id: int):
        """Deregister an object that has disappeared"""
        del self.objects[object_id]
        del self.disappeared[object_id]
    
    def update(self, detections: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
        """
        Update tracker with new detections
        Returns current tracked objects
        """
        # If no detections, mark all existing objects as disappeared
        if len(detections) == 0:
            for object_id in list(self.disappeared.keys()):
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
            return self.objects
        
        # Get centroids of new detections
        input_centroids = [self._calculate_centroid(d["bbox"]) for d in detections]
        
        # If no existing objects, register all detections
        if len(self.objects) == 0:
            for detection in detections:
                self.register(detection)
        else:
            # Match existing objects with new detections
            object_ids = list(self.objects.keys())
            object_centroids = [self.objects[oid]["centroid"] for oid in object_ids]
            
            # Calculate distance matrix
            distances = np.zeros((len(object_centroids), len(input_centroids)))
            for i, obj_centroid in enumerate(object_centroids):
                for j, inp_centroid in enumerate(input_centroids):
                    distances[i, j] = self._euclidean_distance(obj_centroid, inp_centroid)
            
            # Find minimum distance matches
            used_rows = set()
            used_cols = set()
            
            # Sort by distance and match
            sorted_indices = np.argsort(distances, axis=None)
            for idx in sorted_indices:
                row = idx // len(input_centroids)
                col = idx % len(input_centroids)
                
                if row in used_rows or col in used_cols:
                    continue
                    
                if distances[row, col] > self.max_distance:
                    continue
                
                # Update existing object
                object_id = object_ids[row]
                self.objects[object_id]["centroid"] = input_centroids[col]
                self.objects[object_id]["bbox"] = detections[col]["bbox"]
                self.objects[object_id]["last_seen"] = datetime.now(timezone.utc).isoformat()
                self.objects[object_id]["positions"].append(input_centroids[col])
                self.disappeared[object_id] = 0
                
                used_rows.add(row)
                used_cols.add(col)
            
            # Mark unmatched objects as disappeared
            for row in range(len(object_centroids)):
                if row not in used_rows:
                    object_id = object_ids[row]
                    self.disappeared[object_id] += 1
                    if self.disappeared[object_id] > self.max_disappeared:
                        self.deregister(object_id)
            
            # Register new detections
            for col in range(len(input_centroids)):
                if col not in used_cols:
                    self.register(detections[col])
        
        return self.objects
    
    def get_trajectories(self) -> List[Dict[str, Any]]:
        """Get trajectories of all tracked objects"""
        trajectories = []
        for obj_id, obj_data in self.objects.items():
            trajectories.append({
                "tracking_id": obj_data["tracking_id"],
                "class_name": obj_data["class_name"],
                "positions": obj_data["positions"],
                "first_seen": obj_data["first_seen"],
                "last_seen": obj_data["last_seen"]
            })
        return trajectories
    
    def detect_stationary_objects(self, time_threshold: int = 30) -> List[Dict[str, Any]]:
        """Detect objects that have been stationary for extended time"""
        stationary = []
        for obj_id, obj_data in self.objects.items():
            positions = obj_data["positions"]
            if len(positions) >= time_threshold:
                # Check movement in last N positions
                recent = positions[-time_threshold:]
                max_movement = max(
                    self._euclidean_distance(recent[0], pos) for pos in recent
                )
                if max_movement < 20:  # Very little movement
                    stationary.append({
                        "tracking_id": obj_data["tracking_id"],
                        "class_name": obj_data["class_name"],
                        "bbox": obj_data["bbox"],
                        "stationary_duration": len(positions),
                        "is_suspicious": obj_data["class_name"] in ["backpack", "suitcase"]
                    })
        return stationary


# Global tracker instance
_tracker_instance = None

def get_tracker() -> SimpleTracker:
    global _tracker_instance
    if _tracker_instance is None:
        _tracker_instance = SimpleTracker()
    return _tracker_instance
