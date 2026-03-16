import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  Radio,
  Shield,
  Crosshair,
  MapPin,
  AlertTriangle,
  ChevronRight,
  Zap,
  Eye,
  Clock,
  UserPlus,
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";

export default function LandingPage() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Hero Section */}
      <div
        className="relative min-h-screen flex flex-col"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(2,6,23,0.7), rgba(2,6,23,0.95)), url(https://images.unsplash.com/photo-1768571761104-df1cd3e6070c)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 py-4 md:px-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-blue-600 flex items-center justify-center">
              <Radio className="w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight font-['Barlow_Condensed'] uppercase">
              DroneGuard
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 px-4"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-sm font-medium text-white">
                      {user?.name?.[0]?.toUpperCase() ??
                        user?.email?.[0]?.toUpperCase()}
                    </span>
                    <span className="hidden md:inline">
                      {user?.name ?? user?.email}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Command Center
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
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-slate-400 hover:text-white transition-colors text-sm uppercase tracking-wider"
                >
                  Login
                </Link>
                <Link
                  to="/admin-login"
                  className="text-slate-400 hover:text-white transition-colors text-sm uppercase tracking-wider"
                >
                  Admin
                </Link>
                <Link to="/signup">
                  <Button
                    data-testid="header-report-btn"
                    className="btn-emergency px-6"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </header>

        {/* Hero Content */}
        <div className="flex-1 flex items-center px-6 md:px-12 lg:px-24">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 text-sm font-mono uppercase tracking-wider">
                System Online
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black font-['Barlow_Condensed'] uppercase leading-none mb-6">
              AI-Powered
              <br />
              <span className="text-blue-500">Emergency</span>
              <br />
              Response
            </h1>

            <p className="text-slate-400 text-lg md:text-xl max-w-xl mb-10 font-['IBM_Plex_Sans']">
              Autonomous drone dispatch system with real-time AI detection.
              Report incidents instantly. Drones respond in minutes.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/report">
                <Button
                  data-testid="hero-report-btn"
                  className="btn-emergency h-14 px-8 text-lg"
                >
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Report Emergency
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button
                  data-testid="hero-dashboard-btn"
                  variant="outline"
                  className="h-14 px-8 text-lg border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                >
                  View Command Center
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="relative z-10 glass-panel mx-6 md:mx-12 mb-8 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatItem
              icon={<Radio className="w-5 h-5 text-blue-500" />}
              value="5"
              label="Active Drones"
            />
            <StatItem
              icon={<Eye className="w-5 h-5 text-emerald-500" />}
              value="24/7"
              label="AI Monitoring"
            />
            <StatItem
              icon={<Clock className="w-5 h-5 text-amber-500" />}
              value="< 3 min"
              label="Avg Response"
            />
            <StatItem
              icon={<Shield className="w-5 h-5 text-purple-500" />}
              value="100%"
              label="Coverage"
            />
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="py-24 px-6 md:px-12 bg-[#0F172A]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black font-['Barlow_Condensed'] uppercase mb-4">
              How It Works
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Our AI-powered system detects emergencies and dispatches drones
              automatically
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<AlertTriangle className="w-8 h-8" />}
              title="Report Incident"
              description="Upload video or photo evidence with GPS location. Our mobile-first interface makes reporting instant."
              step="01"
              color="red"
            />
            <FeatureCard
              icon={<Eye className="w-8 h-8" />}
              title="AI Analysis"
              description="YOLOv8 AI analyzes the footage to verify and classify the incident type and severity."
              step="02"
              color="blue"
            />
            <FeatureCard
              icon={<Crosshair className="w-8 h-8" />}
              title="Drone Dispatch"
              description="Nearest available drone is automatically dispatched with optimal routing and live tracking."
              step="03"
              color="emerald"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6 md:px-12 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-y border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <Zap className="w-12 h-12 text-amber-500 mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-black font-['Barlow_Condensed'] uppercase mb-4">
            Ready to Experience the Future?
          </h2>
          <p className="text-slate-400 mb-8">
            Access the command center dashboard to see real-time drone
            operations
          </p>
          <Link to="/dashboard">
            <Button
              data-testid="cta-dashboard-btn"
              className="btn-primary h-12 px-8"
            >
              <MapPin className="w-5 h-5 mr-2" />
              Open Command Center
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 md:px-12 bg-[#020617] border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-blue-500" />
            <span className="font-bold font-['Barlow_Condensed'] uppercase">
              DroneGuard
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            AI-Powered Urban Emergency Response System
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatItem({ icon, value, label }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-sm bg-slate-800 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold font-['JetBrains_Mono']">{value}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wider">
          {label}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, step, color }) {
  const colorClasses = {
    red: "text-red-500 bg-red-500/10 border-red-500/20",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  };

  return (
    <div className="glass-panel p-6 hover:border-white/20 transition-colors duration-300">
      <div className="flex items-start justify-between mb-6">
        <div
          className={`w-14 h-14 rounded-sm flex items-center justify-center border ${colorClasses[color]}`}
        >
          {icon}
        </div>
        <span className="text-4xl font-black font-['Barlow_Condensed'] text-slate-800">
          {step}
        </span>
      </div>
      <h3 className="text-xl font-bold font-['Barlow_Condensed'] uppercase mb-3">
        {title}
      </h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
