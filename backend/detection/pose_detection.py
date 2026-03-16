"""
Pose Detection Module for Fallen Person Detection
Uses body pose analysis to detect fallen or injured persons
"""
import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
import logging
from datetime import datetime, timezone
import uuid

logger = logging.getLogger(__name__)


class PoseDetector:
    """Pose-based fallen person detector"""
    
    def __init__(self):
        self.fall_threshold = 0.7  # Threshold for fall detection confidence
        
    def detect_fallen_person(self, frame: np.ndarray, person_bbox: List[float]) -> Dict[str, Any]:
        """
        Analyze a detected person to check if they appear fallen
        Uses aspect ratio and position analysis
        """
        x1, y1, x2, y2 = person_bbox
        width = x2 - x1
        height = y2 - y1
        
        # Aspect ratio analysis: horizontal > vertical suggests fallen
        aspect_ratio = width / height if height > 0 else 0
        
        # Position analysis: check if person bbox is in lower portion of frame
        frame_height = frame.shape[0] if frame is not None else 1080
        y_center = (y1 + y2) / 2
        position_score = y_center / frame_height  # Higher = lower in frame
        
        # Calculate fall probability
        fall_probability = 0.0
        is_fallen = False
        
        if aspect_ratio > 1.5:  # Width significantly greater than height
            fall_probability = min(aspect_ratio / 2.0, 1.0) * 0.7
            
        if position_score > 0.7:  # In lower portion of frame
            fall_probability += 0.3
            
        if fall_probability > self.fall_threshold:
            is_fallen = True
            
        return {
            "is_fallen": is_fallen,
            "confidence": fall_probability,
            "aspect_ratio": aspect_ratio,
            "position_score": position_score,
            "bbox": person_bbox
        }
    
    def analyze_frame_for_falls(
        self, 
        frame: np.ndarray, 
        person_detections: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Analyze all detected persons in a frame for potential falls"""
        fallen_persons = []
        
        for detection in person_detections:
            if detection.get("class_name") == "person":
                bbox = detection.get("bbox", [])
                if len(bbox) == 4:
                    fall_result = self.detect_fallen_person(frame, bbox)
                    if fall_result["is_fallen"]:
                        fallen_persons.append({
                            "id": str(uuid.uuid4())[:8],
                            "type": "fallen_person",
                            "severity": "critical",
                            "confidence": fall_result["confidence"],
                            "bbox": bbox,
                            "detected_at": datetime.now(timezone.utc).isoformat()
                        })
        
        return fallen_persons


class CrowdAnalyzer:
    """Analyze crowd patterns for emergency detection"""
    
    def __init__(self):
        self.crowd_threshold = 5  # Minimum persons for crowd detection
        self.density_threshold = 0.3  # Persons per 100x100 pixel area
        
    def analyze_crowd(
        self, 
        frame: np.ndarray, 
        person_detections: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Analyze crowd gathering patterns"""
        person_bboxes = [d["bbox"] for d in person_detections if d.get("class_name") == "person"]
        
        if len(person_bboxes) < self.crowd_threshold:
            return None
        
        # Calculate crowd density
        frame_area = frame.shape[0] * frame.shape[1] if frame is not None else 1920 * 1080
        density = len(person_bboxes) / (frame_area / 10000)  # Per 100x100 area
        
        # Calculate crowd center
        centers = [(b[0] + b[2]) / 2 for b in person_bboxes], [(b[1] + b[3]) / 2 for b in person_bboxes]
        crowd_center = (np.mean(centers[0]), np.mean(centers[1]))
        
        # Calculate spread
        spread_x = np.std(centers[0])
        spread_y = np.std(centers[1])
        
        severity = "high" if len(person_bboxes) > 10 else "medium"
        
        return {
            "id": str(uuid.uuid4())[:8],
            "type": "crowd_gathering",
            "severity": severity,
            "person_count": len(person_bboxes),
            "density": density,
            "center": crowd_center,
            "spread": (spread_x, spread_y),
            "confidence": min(len(person_bboxes) / 15, 1.0),
            "detected_at": datetime.now(timezone.utc).isoformat()
        }


# Singleton instances
_pose_detector = None
_crowd_analyzer = None

def get_pose_detector() -> PoseDetector:
    global _pose_detector
    if _pose_detector is None:
        _pose_detector = PoseDetector()
    return _pose_detector

def get_crowd_analyzer() -> CrowdAnalyzer:
    global _crowd_analyzer
    if _crowd_analyzer is None:
        _crowd_analyzer = CrowdAnalyzer()
    return _crowd_analyzer
