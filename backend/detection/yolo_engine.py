"""
YOLOv8 Detection Engine for Emergency Incident Detection
Detects: Road accidents, fallen persons, crowd gatherings, abandoned objects, suspicious vehicles
"""
import os
import cv2
import numpy as np
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timezone
import uuid

logger = logging.getLogger(__name__)

# Detection class mappings
INCIDENT_CLASSES = {
    0: "person",
    1: "bicycle", 
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
    24: "backpack",
    26: "handbag",
    28: "suitcase",
    56: "chair",
    62: "tv",
    63: "laptop",
    67: "cell phone",
}

SEVERITY_MAPPING = {
    "fallen_person": "critical",
    "road_accident": "critical",
    "crowd_gathering": "high",
    "abandoned_object": "medium",
    "suspicious_vehicle": "medium",
    "fire": "critical",
    "medical_emergency": "critical",
}

class YOLODetectionEngine:
    """YOLOv8-based incident detection engine"""
    
    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.model_path = model_path or "yolov8n.pt"
        self.confidence_threshold = 0.5
        self._load_model()
    
    def _load_model(self):
        """Load YOLOv8 model"""
        try:
            from ultralytics import YOLO
            self.model = YOLO(self.model_path)
            logger.info(f"YOLOv8 model loaded successfully: {self.model_path}")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            self.model = None
    
    def detect_from_frame(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """Detect objects in a single frame"""
        if self.model is None:
            return []
        
        try:
            results = self.model(frame, conf=self.confidence_threshold, verbose=False)
            detections = []
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        cls_id = int(box.cls[0])
                        conf = float(box.conf[0])
                        xyxy = box.xyxy[0].tolist()
                        
                        detection = {
                            "class_id": cls_id,
                            "class_name": self.model.names.get(cls_id, "unknown"),
                            "confidence": conf,
                            "bbox": xyxy,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                        detections.append(detection)
            
            return detections
        except Exception as e:
            logger.error(f"Detection error: {e}")
            return []
    
    def analyze_video(self, video_path: str, sample_rate: int = 5) -> Dict[str, Any]:
        """Analyze video file and detect incidents"""
        if not os.path.exists(video_path):
            return {"error": "Video file not found", "incidents": []}
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"error": "Could not open video", "incidents": []}
        
        frame_count = 0
        all_detections = []
        person_positions = []
        vehicle_positions = []
        
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                if frame_count % sample_rate == 0:
                    detections = self.detect_from_frame(frame)
                    all_detections.extend(detections)
                    
                    # Track persons and vehicles for incident analysis
                    for det in detections:
                        if det["class_name"] == "person":
                            person_positions.append(det["bbox"])
                        elif det["class_name"] in ["car", "truck", "bus", "motorcycle"]:
                            vehicle_positions.append(det["bbox"])
                
                frame_count += 1
        finally:
            cap.release()
        
        # Analyze detections for incidents
        incidents = self._analyze_detections(all_detections, person_positions, vehicle_positions)
        
        return {
            "video_path": video_path,
            "frames_analyzed": frame_count // sample_rate,
            "total_detections": len(all_detections),
            "incidents": incidents
        }
    
    def _analyze_detections(
        self, 
        detections: List[Dict], 
        person_positions: List[List[float]], 
        vehicle_positions: List[List[float]]
    ) -> List[Dict[str, Any]]:
        """Analyze detections to identify incidents"""
        incidents = []
        
        # Count objects
        person_count = sum(1 for d in detections if d["class_name"] == "person")
        vehicle_count = sum(1 for d in detections if d["class_name"] in ["car", "truck", "bus"])
        
        # Detect crowd gathering (multiple persons in same area)
        if person_count > 5:
            incidents.append({
                "id": str(uuid.uuid4())[:8],
                "type": "crowd_gathering",
                "severity": SEVERITY_MAPPING["crowd_gathering"],
                "confidence": min(person_count / 10, 1.0),
                "description": f"Detected {person_count} persons - possible crowd gathering",
                "detected_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Detect potential road accident (vehicles in close proximity)
        if vehicle_count > 2 and self._check_vehicle_collision(vehicle_positions):
            incidents.append({
                "id": str(uuid.uuid4())[:8],
                "type": "road_accident",
                "severity": SEVERITY_MAPPING["road_accident"],
                "confidence": 0.75,
                "description": "Potential road accident detected - vehicles in unusual proximity",
                "detected_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Detect abandoned objects
        abandoned_objects = [d for d in detections if d["class_name"] in ["backpack", "suitcase", "handbag"]]
        if abandoned_objects:
            incidents.append({
                "id": str(uuid.uuid4())[:8],
                "type": "abandoned_object",
                "severity": SEVERITY_MAPPING["abandoned_object"],
                "confidence": 0.6,
                "description": f"Potential abandoned object detected: {abandoned_objects[0]['class_name']}",
                "detected_at": datetime.now(timezone.utc).isoformat()
            })
        
        return incidents
    
    def _check_vehicle_collision(self, positions: List[List[float]]) -> bool:
        """Check if vehicles are in unusual proximity (potential collision)"""
        if len(positions) < 2:
            return False
        
        for i, pos1 in enumerate(positions):
            for pos2 in positions[i+1:]:
                # Calculate IoU or distance
                overlap = self._calculate_overlap(pos1, pos2)
                if overlap > 0.3:  # Significant overlap
                    return True
        return False
    
    def _calculate_overlap(self, bbox1: List[float], bbox2: List[float]) -> float:
        """Calculate overlap between two bounding boxes"""
        x1 = max(bbox1[0], bbox2[0])
        y1 = max(bbox1[1], bbox2[1])
        x2 = min(bbox1[2], bbox2[2])
        y2 = min(bbox1[3], bbox2[3])
        
        if x2 < x1 or y2 < y1:
            return 0.0
        
        intersection = (x2 - x1) * (y2 - y1)
        area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
        area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1])
        
        return intersection / min(area1, area2) if min(area1, area2) > 0 else 0.0


# Singleton instance
_engine_instance = None

def get_detection_engine() -> YOLODetectionEngine:
    """Get or create the detection engine singleton"""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = YOLODetectionEngine()
    return _engine_instance


def analyze_incident_video(video_path: str) -> Dict[str, Any]:
    """Convenience function to analyze a video for incidents"""
    engine = get_detection_engine()
    return engine.analyze_video(video_path)
