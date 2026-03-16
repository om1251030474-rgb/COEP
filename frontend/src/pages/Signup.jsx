import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { User, Mail, Lock, ChevronLeft, Home } from "lucide-react";

export default function Signup() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await signup({ name, email, password });
      toast.success("Account created! Redirecting to dashboard...");
    } catch (error) {
      toast.error(error?.message || "Unable to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#020617] text-white flex items-center justify-center"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(2,6,23,0.9), rgba(2,6,23,0.95)), url(https://images.unsplash.com/photo-1519985176271-adb1088fa94c?auto=format&fit=crop&w=1800&q=80)`,
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
            <h1 className="text-3xl  font-['Barlow_Condensed'] uppercase tracking-tight">
              Create account
            </h1>
            <p className="text-slate-400 mt-2">
              Sign up and start monitoring your city’s emergency response.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-200">
              Full Name
            </label>
            <div className="relative mt-2">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                type="text"
                required
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">Email</label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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

          <div>
            <label className="text-sm font-medium text-slate-200">
              Confirm Password
            </label>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                required
                className="pl-10"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating Account…" : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="text-white font-medium hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
