import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Lock, Mail, ChevronLeft, Shield, Home } from "lucide-react";

export default function AdminLogin() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login({ email, password, isAdmin: true });
      toast.success("Admin access granted!");
    } catch (error) {
      toast.error(error?.message || "Unable to sign in as admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#020617] text-white flex items-center justify-center"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(2,6,23,0.9), rgba(2,6,23,0.95)), url(https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1800&q=80)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Link
        to="/"
        className="fixed top-4 left-4 z-50 inline-flex items-center justify-center rounded-md bg-black/40 p-2 text-slate-200 hover:bg-black/60 hover:text-white"
      >
        <Home className="w-5 h-5" />
      </Link>
      <div className="w-full max-w-md p-10 rounded-2xl glass-panel border border-white/10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-['Barlow_Condensed'] uppercase tracking-tight">
              Admin Login
            </h1>
            <p className="text-slate-400 mt-2">
              Access administrative controls for the drone system.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-200">
              Admin Email
            </label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                type="email"
                required
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">
              Password
            </label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                required
                className="pl-10"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              "Authenticating…"
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Login as Admin
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-slate-400">
          Not an admin?{" "}
          <Link to="/login" className="text-white font-medium hover:underline">
            User login
          </Link>
        </div>
      </div>
    </div>
  );
}
