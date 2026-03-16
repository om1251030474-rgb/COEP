import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import {
  Radio,
  Video,
  Upload,
  MapPin,
  Loader2,
  AlertTriangle,
  Flame,
  Car,
  HeartPulse,
  ShieldAlert,
  HelpCircle,
  X,
  CheckCircle,
  ChevronLeft,
  Camera,
  LocateFixed,
} from "lucide-react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

const INCIDENT_TYPES = [
  {
    value: "fire",
    label: "Fire",
    icon: Flame,
    color: "text-red-500 bg-red-500/10 border-red-500/30",
  },
  {
    value: "accident",
    label: "Accident",
    icon: Car,
    color: "text-orange-500 bg-orange-500/10 border-orange-500/30",
  },
  {
    value: "medical_emergency",
    label: "Medical",
    icon: HeartPulse,
    color: "text-pink-500 bg-pink-500/10 border-pink-500/30",
  },
  {
    value: "crime",
    label: "Crime",
    icon: ShieldAlert,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/30",
  },
  {
    value: "other",
    label: "Other",
    icon: HelpCircle,
    color: "text-slate-500 bg-slate-500/10 border-slate-500/30",
  },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function ReportIncident() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  const [incidentType, setIncidentType] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [mediaStream, setMediaStream] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submittedIncident, setSubmittedIncident] = useState(null);

  // Auto-capture location on mount
  useEffect(() => {
    getLocation();
  }, []);

  // Clean up media stream when leaving page
  useEffect(() => {
    return () => {
      stopMediaStream();
    };
  }, []);

  const getLocation = useCallback(() => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationLoading(false);
        toast.success("Location captured");
      },
      (error) => {
        let message = "Failed to get location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message =
              "Location permission denied. Please enable location access.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable";
            break;
          case error.TIMEOUT:
            message = "Location request timed out";
            break;
          default:
            message = "An error occurred while getting location";
        }
        setLocationError(message);
        setLocationLoading(false);
        toast.error(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }, []);

  const stopMediaStream = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload MP4, WebM, or MOV video.");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
      return;
    }

    // Stop camera if recording
    stopMediaStream();
    setIsRecording(false);

    setVideoFile(file);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
    toast.success("Video loaded successfully");
  };

  const startRecording = async () => {
    if (isRecording) return;

    try {
      setIsRecording(true);
      setRecordingProgress(0);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "environment" },
      });

      setMediaStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const file = new File([blob], `incident-${Date.now()}.webm`, {
          type: "video/webm",
        });
        setVideoFile(file);
        const url = URL.createObjectURL(blob);
        setVideoPreview(url);
        toast.success("Recorded video ready to submit");
        setIsRecording(false);
        setRecordingProgress(0);
        stopMediaStream();
      };

      recorder.start();

      const duration = 10;
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 1;
        setRecordingProgress(
          Math.min(100, Math.round((elapsed / duration) * 100)),
        );

        if (elapsed >= duration) {
          clearInterval(interval);
          recorder.stop();
        }
      }, 1000);
    } catch (error) {
      console.error("Camera recording error:", error);
      toast.error("Unable to access camera. Please allow camera access.");
      setIsRecording(false);
      stopMediaStream();
    }
  };

  const clearVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    stopMediaStream();
    setIsRecording(false);
    setRecordingProgress(0);
    setVideoFile(null);
    setVideoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!videoFile) {
      toast.error("Please upload a video of the incident");
      return;
    }

    if (!location) {
      toast.error("Location is required. Please enable GPS.");
      return;
    }

    if (!incidentType) {
      toast.error("Please select the incident type");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("video_file", videoFile);
      formData.append("latitude", location.lat.toString());
      formData.append("longitude", location.lng.toString());
      formData.append("incident_type", incidentType);

      const response = await axios.post(
        `${API_URL}/api/report-incident`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            setUploadProgress(progress);
          },
        },
      );

      setSubmittedIncident(response.data);
      setSubmitted(true);
      toast.success("Emergency reported! Drone being dispatched.");
    } catch (error) {
      console.error("Submit error:", error);
      const message =
        error.response?.data?.detail ||
        "Failed to submit report. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted && submittedIncident) {
    return <SuccessScreen incident={submittedIncident} />;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-x-0 border-t-0 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500" />
            <span className="font-bold font-['Barlow_Condensed'] uppercase">
              Emergency Report
            </span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Emergency Type Selection */}
          <section>
            <Label className="text-sm uppercase tracking-wider text-slate-400 mb-3 block">
              Emergency Type *
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {INCIDENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  data-testid={`incident-type-${type.value}`}
                  onClick={() => setIncidentType(type.value)}
                  className={`
                    aspect-square p-4 rounded-sm border-2 transition-all duration-200
                    flex flex-col items-center justify-center gap-2
                    ${
                      incidentType === type.value
                        ? `${type.color} border-current`
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                    }
                  `}
                >
                  <type.icon
                    className={`w-10 h-10 ${incidentType === type.value ? "" : "text-slate-400"}`}
                  />
                  <span className="font-bold font-['Barlow_Condensed'] uppercase text-sm">
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Video Upload */}
          <section>
            <Label className="text-sm uppercase tracking-wider text-slate-400 mb-3 block">
              Video Evidence *
            </Label>

            {!(videoPreview || isRecording) ? (
              <div
                className="border-2 border-dashed border-slate-700 rounded-sm p-8 text-center hover:border-slate-600 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="video-input"
                />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                    <Video className="w-8 h-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-1">Upload Video</p>
                    <p className="text-slate-500 text-sm">
                      MP4, WebM, MOV up to 50MB
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choose File
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRecording();
                      }}
                      disabled={isRecording}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {isRecording ? "Recording…" : "Record"}
                    </Button>
                  </div>
                  {isRecording && (
                    <div className="mt-3 text-xs text-slate-300">
                      Recording video… {recordingProgress}%
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative video-viewfinder">
                <video
                  ref={videoRef}
                  src={videoPreview || undefined}
                  controls
                  className="w-full rounded-sm bg-black"
                  data-testid="video-preview"
                />
                <button
                  type="button"
                  onClick={clearVideo}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                  data-testid="clear-video-btn"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-4 left-4 glass-hud px-3 py-1 text-xs font-mono">
                  {videoFile?.name}
                </div>
              </div>
            )}
          </section>

          {/* Location */}
          <section>
            <Label className="text-sm uppercase tracking-wider text-slate-400 mb-3 block">
              Location *
            </Label>

            <div className="glass-panel p-4">
              {locationLoading ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span className="text-slate-400">
                    Capturing GPS location...
                  </span>
                </div>
              ) : locationError ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-sm">{locationError}</span>
                  </div>
                  <Button
                    type="button"
                    onClick={getLocation}
                    variant="outline"
                    className="w-full border-slate-700"
                    data-testid="retry-location-btn"
                  >
                    <LocateFixed className="w-4 h-4 mr-2" />
                    Retry Location
                  </Button>
                </div>
              ) : location ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-sm bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-emerald-400 text-sm font-medium">
                        Location Captured
                      </p>
                      <p className="text-slate-400 text-xs font-mono">
                        {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={getLocation}
                    variant="outline"
                    size="sm"
                    className="border-slate-700"
                    data-testid="refresh-location-btn"
                  >
                    <LocateFixed className="w-4 h-4 mr-2" />
                    Refresh Location
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          {/* Submit Button */}
          <section className="pt-4">
            {isSubmitting && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-400">Uploading...</span>
                  <span className="font-mono text-blue-400">
                    {uploadProgress}%
                  </span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <Button
              type="submit"
              disabled={
                isSubmitting || !videoFile || !location || !incidentType
              }
              className="w-full h-14 btn-emergency text-lg"
              data-testid="submit-report-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting Report...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Submit Emergency Report
                </>
              )}
            </Button>

            <p className="text-center text-slate-500 text-xs mt-4">
              False reports may result in legal action
            </p>
          </section>
        </form>
      </main>
    </div>
  );
}

function SuccessScreen({ incident }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-6 pulse-critical">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>

        <h1 className="text-3xl font-black font-['Barlow_Condensed'] uppercase mb-4">
          Report Submitted
        </h1>

        <p className="text-slate-400 mb-8">
          Your emergency has been reported and a drone is being dispatched to
          the location.
        </p>

        <div className="glass-panel p-4 text-left mb-8">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Incident ID</span>
              <span className="font-mono text-blue-400">
                {incident.incident_id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Type</span>
              <span className="capitalize">
                {incident.type?.replace("_", " ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="text-amber-400">Processing</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Location</span>
              <span className="font-mono text-xs">
                {incident.location?.lat?.toFixed(4)},{" "}
                {incident.location?.lng?.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => navigate("/dashboard")}
            className="btn-primary h-12"
            data-testid="view-dashboard-btn"
          >
            Track in Command Center
          </Button>
          <Button
            onClick={() => navigate("/report")}
            variant="outline"
            className="h-12 border-slate-700"
            data-testid="report-another-btn"
          >
            Report Another Incident
          </Button>
        </div>
      </div>
    </div>
  );
}
