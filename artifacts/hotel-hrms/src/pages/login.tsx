import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@redfoxhotel.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const loginMutation = useLogin();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data) => {
          login(data.token);
          setLocation("/");
        },
        onError: () => {
          setError("Invalid email or password");
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex w-1/2 bg-primary flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full translate-x-1/2 translate-y-1/2" />
        </div>
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-3xl">RF</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Red Fox Hotel</h1>
          <p className="text-white/80 text-lg">HR Management System</p>
          <div className="mt-12 grid grid-cols-2 gap-4 text-left">
            {["Employee Management", "Payroll Processing", "Attendance Tracking", "Leave Management"].map(f => (
              <div key={f} className="bg-white/10 rounded-lg px-4 py-3">
                <p className="text-white text-sm font-medium">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">RF</span>
            </div>
            <div>
              <h1 className="font-bold text-foreground">Red Fox Hotel</h1>
              <p className="text-xs text-muted-foreground">HR Management System</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Sign in</h2>
            <p className="text-muted-foreground mt-1">Enter your credentials to access the HRMS</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@redfoxhotel.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <p className="text-xs font-medium text-muted-foreground mb-2">Test accounts</p>
            <div className="space-y-1">
              {[
                { label: "Super Admin", email: "admin@redfoxhotel.com", pass: "admin123" },
                { label: "HR Manager", email: "hr@redfoxhotel.com", pass: "hr123" },
                { label: "Branch Manager", email: "manager@redfoxhotel.com", pass: "manager123" },
              ].map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  className="w-full text-left"
                  onClick={() => { setEmail(acc.email); setPassword(acc.pass); }}
                >
                  <div className="flex items-center justify-between hover:bg-background rounded px-2 py-1 transition-colors">
                    <span className="text-xs font-medium">{acc.label}</span>
                    <span className="text-xs text-muted-foreground">{acc.email}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
