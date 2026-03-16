"""
AI Detection Module
Provides incident detection capabilities using YOLOv8 and pose analysis
"""
from .yolo_engine import YOLODetectionEngine, get_detection_engine, analyze_incident_video
from .pose_detection import PoseDetector, CrowdAnalyzer, get_pose_detector, get_crowd_analyzer
from .tracker import SimpleTracker, get_tracker

__all__ = [
    "YOLODetectionEngine",
    "get_detection_engine",
    "analyze_incident_video",
    "PoseDetector",
    "CrowdAnalyzer",
    "get_pose_detector",
    "get_crowd_analyzer",
    "SimpleTracker",
    "get_tracker"
]
