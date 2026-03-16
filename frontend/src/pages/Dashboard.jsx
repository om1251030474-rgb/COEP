import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Map,
  Marker,
  Popup,
  NavigationControl,
  Source,
  Layer,
} from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Disable Mapbox telemetry early (prevents events.mapbox.com network calls in some environments)
if (mapboxgl?.setTelemetryEnabled) {
  mapboxgl.setTelemetryEnabled(false);
}
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { ScrollArea } from "../components/ui/scroll-area";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import {
  Radio,
  AlertTriangle,
  MapPin,
  Battery,
  Navigation,
  Clock,
  Crosshair,
  Signal,
  RefreshCw,
  ChevronRight,
  Loader2,
  X,
  Plane,
  Activity,
  Shield,
  Flame,
  Car,
  HeartPulse,
  ShieldAlert,
  HelpCircle,
  Eye,
  Menu,
  Home,
  User,
  ChevronDown,
  LogOut,
  Trash2,
  Plus,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Default map center (Pune, India)
const DEFAULT_CENTER = {
  latitude: 18.5204,
  longitude: 73.8567,
  zoom: 12,
};

const INCIDENT_ICONS = {
  fire: Flame,
  accident: Car,
  medical_emergency: HeartPulse,
  crime: ShieldAlert,
  other: HelpCircle,
  fallen_person: AlertTriangle,
  crowd_gathering: Activity,
};

const SEVERITY_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const PUNE_ZONES = [
  { name: "Pune Airport", lat: 18.5793, lng: 73.9089 },
  { name: "Shivajinagar", lat: 18.5308, lng: 73.8475 },
  { name: "Hinjewadi IT Park", lat: 18.5912, lng: 73.7389 },
  { name: "Pune Railway Station", lat: 18.5286, lng: 73.8747 },
];

const patrolRoute = {
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: [
      [73.8567, 18.5204],
      [73.8475, 18.5308],
      [73.8747, 18.5286],
      [73.9089, 18.5793],
    ],
  },
};

export default function Dashboard() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const [viewState, setViewState] = useState(DEFAULT_CENTER);
  const [drones, setDrones] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedDrone, setSelectedDrone] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminModel, setAdminModel] = useState("");
  const [adminLat, setAdminLat] = useState("");
  const [adminLng, setAdminLng] = useState("");
  const wsRef = useRef(null);
  const connectedToastId = useRef(null);
  const hasShownConnectToast = useRef(false);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const [dronesRes, incidentsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/drones`),
        axios.get(`${API_URL}/api/incidents`),
        axios.get(`${API_URL}/api/stats`),
      ]);

      setDrones(dronesRes.data);
      setIncidents(incidentsRes.data);
      setStats(statsRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
      setLoading(false);
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    // Disable Mapbox telemetry to avoid extra network requests
    if (mapboxgl?.setTelemetryEnabled) {
      mapboxgl.setTelemetryEnabled(false);
    }

    const connectWebSocket = () => {
      const wsUrl = API_URL.replace(/^http/, "ws") + "/api/ws";
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnected(true);

        // Show connect toast only once per session (e.g., on first login)
        if (!hasShownConnectToast.current) {
          hasShownConnectToast.current = true;

          connectedToastId.current = toast.success(
            "Connected to command center",
            {
              duration: 5000,
              action: {
                label: "Dismiss",
                onClick: () => {
                  if (connectedToastId.current) {
                    toast.dismiss(connectedToastId.current);
                  }
                },
              },
            },
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (e) {
          console.error("WebSocket message error:", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setWsConnected(false);
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        // Avoid noisy console spam; connection issues are handled via onclose.
        if (process.env.NODE_ENV === "development") {
          console.warn("WebSocket error:", error);
        }
      };

      wsRef.current = ws;
    };

    fetchData();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchData]);

  const handleWebSocketMessage = useCallback((message) => {
    switch (message.type) {
      case "initial_state":
        setDrones(message.data.drones || []);
        break;

      case "telemetry":
        setDrones((prev) =>
          prev.map((d) =>
            d.id === message.data.drone_id ? { ...d, ...message.data } : d,
          ),
        );
        break;

      case "incident_alert":
        setIncidents((prev) => [message.data, ...prev]);
        toast.error(`New Incident: ${message.data.type}`, {
          description: `Severity: ${message.data.severity}`,
        });
        break;

      case "incident_update":
        setIncidents((prev) =>
          prev.map((i) =>
            i.incident_id === message.data.incident_id
              ? { ...i, ...message.data }
              : i,
          ),
        );
        break;

      case "drone_dispatch":
        toast.info(`Drone dispatched: ${message.data.drone_id}`, {
          description: `ETA: ${message.data.eta_display}`,
        });
        break;

      case "drone_update":
        setDrones((prev) =>
          prev.map((d) => (d.id === message.data.id ? message.data : d)),
        );
        break;

      default:
        break;
    }
  }, []);

  const refreshData = () => {
    setLoading(true);
    fetchData();
  };

  const resolveIncident = async (incidentId) => {
    try {
      await axios.patch(
        `${API_URL}/api/incidents/${incidentId}/status?status=resolved`,
      );
      toast.success("Incident resolved");
      setSelectedIncident(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to resolve incident");
    }
  };

  const addDrone = async () => {
    if (!adminName || !adminModel || !adminLat || !adminLng) {
      toast.error("Please fill all fields");
      return;
    }
    try {
      await axios.post(`${API_URL}/api/admin/drones/add`, {
        name: adminName,
        model: adminModel,
        lat: parseFloat(adminLat),
        lng: parseFloat(adminLng),
      });
      toast.success("Drone added successfully");
      setAdminName("");
      setAdminModel("");
      setAdminLat("");
      setAdminLng("");
      fetchData();
    } catch (error) {
      toast.error("Failed to add drone");
    }
  };

  const removeDrone = async (droneId) => {
    try {
      await axios.delete(`${API_URL}/api/admin/drones/${droneId}`);
      toast.success("Drone removed successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to remove drone");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#020617] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 glass-panel border-x-0 border-t-0 px-4 py-2 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <Radio className="w-6 h-6 text-blue-500" />
              <span className="font-bold font-['Barlow_Condensed'] uppercase hidden sm:block">
                DroneGuard Command
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {isSuperAdmin && (
              <Link to="/admin/users">
                <Button size="sm" variant="outline">
                  Manage Users
                </Button>
              </Link>
            )}
            <div
              className={`flex items-center gap-2 ${wsConnected ? "text-emerald-400" : "text-red-400"}`}
            >
              <div
                className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
              />
              <span className="text-xs font-mono hidden sm:block">
                {wsConnected ? "LIVE" : "OFFLINE"}
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={refreshData}
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>

            <Link to="/report">
              <Button
                className="btn-emergency h-8 px-3 text-xs"
                data-testid="report-emergency-btn"
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Report</span>
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-sm font-medium text-white">
                    {user?.name?.[0]?.toUpperCase() ??
                      user?.email?.[0]?.toUpperCase()}
                  </span>
                  <span className="hidden sm:inline">
                    {user?.name ?? user?.email}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/" className="flex items-center gap-2">
                    <Home className="w-4 h-4" />
                    Home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/report" className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Report
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    logout();
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Sidebar */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-80 bg-[#0F172A] border-r border-white/10 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold font-['Barlow_Condensed'] uppercase">
                    Menu
                  </h2>
                  <button onClick={() => setMobileMenuOpen(false)}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <IncidentList
                  incidents={incidents}
                  onSelect={(i) => {
                    setSelectedIncident(i);
                    setMobileMenuOpen(false);
                  }}
                  onResolve={resolveIncident}
                />
              </div>
            </div>
          </div>
        )}

        {/* Left Sidebar - Incidents */}
        <aside className="hidden md:flex flex-col w-80 border-r border-white/10 bg-[#0F172A]/50">
          <div className="p-4 border-b border-white/10">
            <h2 className="font-bold font-['Barlow_Condensed'] uppercase flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Active Incidents
              {incidents.filter((i) => i.status !== "resolved").length > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {incidents.filter((i) => i.status !== "resolved").length}
                </Badge>
              )}
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <IncidentList
              incidents={incidents}
              onSelect={setSelectedIncident}
              onResolve={resolveIncident}
            />
          </ScrollArea>
        </aside>

        {/* Map Area */}
        <main className="flex-1 relative">
          <Map
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: "100%", height: "100%" }}
          >
            <NavigationControl position="top-right" />

            {/* Drone Markers */}
            {drones.map((drone) => (
              <Marker
                key={drone.id}
                latitude={drone.lat}
                longitude={drone.lng}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedDrone(drone);
                }}
              >
                <DroneMarker drone={drone} />
              </Marker>
            ))}

            {/* Incident Markers */}
            {/* Incident Markers */}
            {incidents
              .filter((incident) => incident.status !== "resolved")
              .map((incident) => (
                <Marker
                  key={incident.incident_id}
                  latitude={incident.location?.lat || 0}
                  longitude={incident.location?.lng || 0}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setSelectedIncident(incident);
                  }}
                >
                  <IncidentMarker incident={incident} />
                </Marker>
              ))}

            {/* Drone Popup */}
            {selectedDrone && (
              <Popup
                latitude={selectedDrone.lat}
                longitude={selectedDrone.lng}
                anchor="top"
                onClose={() => setSelectedDrone(null)}
                closeOnClick={false}
              >
                <DronePopup
                  drone={selectedDrone}
                  onClose={() => setSelectedDrone(null)}
                />
              </Popup>
            )}

            {/* Incident Popup */}
            {selectedIncident && (
              <Popup
                latitude={selectedIncident.location?.lat || 0}
                longitude={selectedIncident.location?.lng || 0}
                anchor="top"
                onClose={() => setSelectedIncident(null)}
                closeOnClick={false}
              >
                <IncidentPopup
                  incident={selectedIncident}
                  onClose={() => setSelectedIncident(null)}
                  onResolve={resolveIncident}
                />
              </Popup>
            )}
          </Map>

          {/* Floating Stats Panel */}
          <div
            className="absolute top-4 left-4 glass-hud p-4 w-64"
            data-testid="stats-panel"
          >
            <h3 className="font-bold font-['Barlow_Condensed'] uppercase text-sm mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              System Status
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <StatCard
                label="Active"
                value={stats?.incidents?.active || 0}
                color="text-red-400"
              />
              <StatCard
                label="Resolved"
                value={stats?.incidents?.resolved || 0}
                color="text-emerald-400"
              />
              <StatCard
                label="Drones Online"
                value={stats?.drones?.available || 0}
                color="text-blue-400"
              />
              <StatCard
                label="Deployed"
                value={stats?.drones?.active || 0}
                color="text-amber-400"
              />
            </div>
          </div>
        </main>

        {/* Right Sidebar - Drones */}
        <aside className="hidden lg:flex flex-col w-80 border-l border-white/10 bg-[#0F172A]/50">
          <div className="p-4 border-b border-white/10">
            <h2 className="font-bold font-['Barlow_Condensed'] uppercase flex items-center gap-2">
              <Plane className="w-4 h-4 text-blue-500" />
              Drone Fleet
            </h2>
          </div>
          <ScrollArea className="flex-1">
            {isAdmin && (
              <div className="p-4 border-b border-white/10">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-500" />
                  Admin Controls
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Name"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="text-xs"
                    />
                    <Input
                      placeholder="Model"
                      value={adminModel}
                      onChange={(e) => setAdminModel(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Latitude"
                      value={adminLat}
                      onChange={(e) => setAdminLat(e.target.value)}
                      className="text-xs"
                    />
                    <Input
                      placeholder="Longitude"
                      value={adminLng}
                      onChange={(e) => setAdminLng(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <Button onClick={addDrone} size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Drone
                  </Button>
                </div>
              </div>
            )}
            <DroneList
              drones={drones}
              onSelect={(drone) => {
                setViewState((prev) => ({
                  ...prev,
                  latitude: drone.lat,
                  longitude: drone.lng,
                  zoom: 15,
                }));
                setSelectedDrone(drone);
              }}
              onRemove={isAdmin ? removeDrone : null}
            />
          </ScrollArea>
        </aside>
      </div>

      {/* Timeline Bar */}
      <footer className="flex-shrink-0 glass-panel border-x-0 border-b-0 px-4 py-2">
        <div className="flex items-center gap-4 overflow-x-auto">
          <span className="text-xs text-slate-500 uppercase tracking-wider flex-shrink-0">
            Recent Activity
          </span>
          {incidents.slice(0, 5).map((incident) => (
            <TimelineItem key={incident.incident_id} incident={incident} />
          ))}
          {incidents.length === 0 && (
            <span className="text-slate-500 text-xs">No recent incidents</span>
          )}
        </div>
      </footer>
    </div>
  );
}

// Sub-components

function DroneMarker({ drone }) {
  const statusColors = {
    available: "bg-emerald-500",
    "en-route": "bg-blue-500 animate-pulse",
    "on-scene": "bg-amber-500",
    returning: "bg-purple-500",
    charging: "bg-blue-400 animate-pulse",
    crashed: "bg-red-500 animate-pulse",
  };

  return (
    <div
      className={`w-8 h-8 rounded-full ${
        statusColors[drone.status] || "bg-slate-500"
      } flex items-center justify-center cursor-pointer shadow-lg border-2 border-white/20`}
      data-testid={`drone-marker-${drone.id}`}
    >
      <Plane className="w-4 h-4 text-white" />
    </div>
  );
}

function IncidentMarker({ incident }) {
  const Icon = INCIDENT_ICONS[incident.type] || AlertTriangle;
  const color = SEVERITY_COLORS[incident.severity] || SEVERITY_COLORS.medium;

  return (
    <div
      className="relative cursor-pointer"
      data-testid={`incident-marker-${incident.incident_id}`}
    >
      {incident.severity === "critical" && (
        <div
          className="absolute inset-0 w-12 h-12 -m-2 rounded-full animate-ping"
          style={{ backgroundColor: `${color}33` }}
        />
      )}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
        style={{ backgroundColor: color }}
      >
        <Icon className="w-4 h-4 text-white" />
      </div>
    </div>
  );
}

function DronePopup({ drone, onClose }) {
  return (
    <div className="p-3 min-w-48">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold font-['Barlow_Condensed'] uppercase">
          {drone.name || drone.id}
        </span>
        <Badge className={`drone-status-${drone.status} text-xs`}>
          {drone.status}
        </Badge>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Model</span>
          <span className="font-mono">{drone.model}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Position</span>
          <span className="font-mono">
            {drone.lat?.toFixed(4)}, {drone.lng?.toFixed(4)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Battery className="w-4 h-4 text-slate-400" />
          <Progress value={drone.battery} className="flex-1 h-2" />
          <span className="font-mono text-emerald-400">
            {Math.round(drone.battery)}%
          </span>
        </div>

        {/* ALTITUDE */}
        {drone.altitude && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Altitude</span>
            <span className="font-mono text-blue-400">{drone.altitude} m</span>
          </div>
        )}

        {/* TASK */}
        {drone.task && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Task</span>
            <span className="font-mono text-purple-400">{drone.task}</span>
          </div>
        )}

        {/* CHARGING STATUS */}
        {drone.charging && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status</span>
            <span className="font-mono text-blue-400">Charging</span>
          </div>
        )}

        {drone.eta && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">ETA</span>
            <span className="font-mono text-amber-400">{drone.eta}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function IncidentPopup({ incident, onClose, onResolve }) {
  const Icon = INCIDENT_ICONS[incident.type] || AlertTriangle;

  return (
    <div className="p-3 min-w-56">
      <div className="flex items-center gap-2 mb-3">
        <Icon
          className="w-5 h-5"
          style={{ color: SEVERITY_COLORS[incident.severity] }}
        />
        <span className="font-bold font-['Barlow_Condensed'] uppercase flex-1">
          {incident.type?.replace("_", " ")}
        </span>
        <Badge className={`severity-${incident.severity} text-xs`}>
          {incident.severity}
        </Badge>
      </div>

      <div className="space-y-2 text-xs mb-3">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">ID</span>
          <span className="font-mono text-blue-400">
            {incident.incident_id}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Status</span>
          <span className="capitalize">{incident.status}</span>
        </div>
        {incident.assigned_drone && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Drone</span>
            <span className="font-mono">{incident.assigned_drone}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">AI Verified</span>
          <span
            className={
              incident.ai_verified ? "text-emerald-400" : "text-slate-500"
            }
          >
            {incident.ai_verified ? "Yes" : "Pending"}
          </span>
        </div>
      </div>

      {incident.status !== "resolved" && (
        <Button
          size="sm"
          className="w-full btn-primary h-8 text-xs"
          onClick={() => onResolve(incident.incident_id)}
          data-testid={`resolve-${incident.incident_id}`}
        >
          Resolve Incident
        </Button>
      )}
    </div>
  );
}

function IncidentList({ incidents, onSelect, onResolve }) {
  const activeIncidents = incidents.filter((i) => i.status !== "resolved");

  if (activeIncidents.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No active incidents</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      {activeIncidents.map((incident) => (
        <IncidentCard
          key={incident.incident_id}
          incident={incident}
          onClick={() => onSelect(incident)}
          onResolve={onResolve}
        />
      ))}
    </div>
  );
}

function IncidentCard({ incident, onClick, onResolve }) {
  const Icon = INCIDENT_ICONS[incident.type] || AlertTriangle;
  const color = SEVERITY_COLORS[incident.severity];

  return (
    <div
      className="glass-panel p-3 cursor-pointer hover:border-white/20 transition-colors"
      onClick={onClick}
      data-testid={`incident-card-${incident.incident_id}`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: `${color}20`,
            borderColor: `${color}50`,
            borderWidth: 1,
          }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-sm capitalize truncate">
              {incident.type?.replace("_", " ")}
            </span>
            <Badge className={`severity-${incident.severity} text-xs ml-2`}>
              {incident.severity}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-mono truncate">
            {incident.incident_id}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            {new Date(incident.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function DroneList({ drones, onSelect, onRemove }) {
  return (
    <div className="p-2 space-y-2">
      {drones.map((drone) => (
        <DroneCard
          key={drone.id}
          drone={drone}
          onClick={() => onSelect(drone)}
          onRemove={onRemove ? () => onRemove(drone.id) : null}
        />
      ))}
    </div>
  );
}

function DroneCard({ drone, onClick, onRemove }) {
  const statusColors = {
    available: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    "en-route": "text-blue-400 border-blue-500/30 bg-blue-500/10",
    "on-scene": "text-amber-400 border-amber-500/30 bg-amber-500/10",
    returning: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    charging: "text-slate-400 border-slate-500/30 bg-slate-500/10",
  };

  return (
    <div
      className="glass-panel p-3 cursor-pointer hover:border-white/20 transition-colors"
      onClick={onClick}
      data-testid={`drone-card-${drone.id}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-sm flex items-center justify-center border ${statusColors[drone.status]}`}
        >
          <Plane className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-sm">{drone.name || drone.id}</span>
            <div className="flex items-center gap-2">
              <Badge className={`drone-status-${drone.status} text-xs`}>
                {drone.status}
              </Badge>
              {onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500">{drone.model}</p>

          <div className="flex items-center gap-2 mt-2">
            <Battery
              className={`w-3 h-3 ${drone.battery > 50 ? "text-emerald-400" : drone.battery > 20 ? "text-amber-400" : "text-red-400"}`}
            />
            <Progress value={drone.battery} className="flex-1 h-1.5" />
            <span className="text-xs font-mono">
              {Math.round(drone.battery)}%
            </span>
          </div>

          {drone.eta && (
            <div className="flex items-center gap-1 mt-1 text-xs text-amber-400">
              <Clock className="w-3 h-3" />
              ETA: {drone.eta}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="glass-panel p-2 text-center">
      <div className={`text-xl font-bold font-['JetBrains_Mono'] ${color}`}>
        {value}
      </div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

function TimelineItem({ incident }) {
  const Icon = INCIDENT_ICONS[incident.type] || AlertTriangle;
  const color = SEVERITY_COLORS[incident.severity];

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 glass-hud flex-shrink-0 cursor-pointer hover:bg-white/5"
      data-testid={`timeline-${incident.incident_id}`}
    >
      <Icon className="w-4 h-4" style={{ color }} />
      <span className="text-xs font-mono">{incident.incident_id}</span>
      <span className="text-xs text-slate-500">
        {new Date(incident.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}
