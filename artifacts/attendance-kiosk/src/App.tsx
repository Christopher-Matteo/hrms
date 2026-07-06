import { useState, useEffect, useRef, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";

const queryClient = new QueryClient();

const BASE = "/api";

type Branch = { id: number; name: string; address: string; latitude: number | null; longitude: number | null };
type EmployeeInfo = {
  id: number;
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  branchId: number;
  branchName: string;
  photoUrl: string | null;
};
type TodayAttendance = { id: number; checkIn: string | null; checkOut: string | null; status: string } | null;
type LookupResult = { employee: EmployeeInfo; todayAttendance: TodayAttendance };

type GpsState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "found"; lat: number; lng: number; branchName?: string }
  | { status: "denied" }
  | { status: "error"; message: string };

type SubmitState = "idle" | "loading" | "success" | "error";

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function KioskApp() {
  const now = useNow();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [empCode, setEmpCode] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [actionType, setActionType] = useState<"checkin" | "checkout">("checkin");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitResult, setSubmitResult] = useState<{ type: string; time: string; workingHours?: number } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${BASE}/kiosk/branches`)
      .then((r) => r.json())
      .then(setBranches)
      .catch(() => {});
  }, []);

  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGps({ status: "error", message: "Geolocation is not supported by this browser." });
      return;
    }
    setGps({ status: "requesting" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let nearest: Branch | null = null;
        let minDist = Infinity;
        for (const b of branches) {
          if (b.latitude !== null && b.longitude !== null) {
            const d = haversineDistance(lat, lng, b.latitude, b.longitude);
            if (d < minDist) {
              minDist = d;
              nearest = b;
            }
          }
        }
        setGps({
          status: "found",
          lat,
          lng,
          branchName: nearest && minDist < 5000 ? nearest.name : undefined,
        });
      },
      (err) => {
        if (err.code === 1) {
          setGps({ status: "denied" });
        } else {
          setGps({ status: "error", message: err.message });
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, [branches]);

  const hasRequestedOnce = useRef(false);
  useEffect(() => {
    if (!hasRequestedOnce.current && branches.length >= 0) {
      hasRequestedOnce.current = true;
      requestGPS();
    }
  }, [branches.length]);

  const handleLookup = async () => {
    if (!empCode.trim()) return;
    if (gps.status !== "found") {
      requestGPS();
      return;
    }
    setLookupLoading(true);
    setLookupError("");
    setLookup(null);
    setSubmitState("idle");
    setSubmitResult(null);
    try {
      const r = await fetch(`${BASE}/kiosk/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: empCode.trim() }),
      });
      const data = await r.json();
      if (!r.ok) {
        setLookupError(data.error ?? "Employee not found");
      } else {
        setLookup(data as LookupResult);
        const att = (data as LookupResult).todayAttendance;
        if (att?.checkIn && !att?.checkOut) {
          setActionType("checkout");
        } else {
          setActionType("checkin");
        }
      }
    } catch {
      setLookupError("Network error. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!lookup) return;
    if (gps.status !== "found") {
      requestGPS();
      return;
    }
    setSubmitState("loading");
    setSubmitError("");
    try {
      const r = await fetch(`${BASE}/kiosk/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: lookup.employee.id,
          type: actionType,
          latitude: gps.lat,
          longitude: gps.lng,
          branchId: lookup.employee.branchId,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setSubmitError(data.error ?? "Submission failed");
        setSubmitState("error");
      } else {
        setSubmitResult({ type: data.type, time: data.time, workingHours: data.workingHours });
        setSubmitState("success");
        setTimeout(() => {
          setEmpCode("");
          setLookup(null);
          setSubmitState("idle");
          setSubmitResult(null);
          setActionType("checkin");
          inputRef.current?.focus();
        }, 5000);
      }
    } catch {
      setSubmitError("Network error. Please try again.");
      setSubmitState("error");
    }
  };

  const resetAll = () => {
    setEmpCode("");
    setLookup(null);
    setLookupError("");
    setSubmitState("idle");
    setSubmitResult(null);
    setSubmitError("");
    inputRef.current?.focus();
  };

  const alreadyCheckedIn = lookup?.todayAttendance?.checkIn && !lookup?.todayAttendance?.checkOut;
  const alreadyCheckedOut = lookup?.todayAttendance?.checkOut;

  const gpsBlocked = gps.status === "denied" || gps.status === "error";
  const gpsLoading = gps.status === "idle" || gps.status === "requesting";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(348,70%,15%)] to-[hsl(348,70%,28%)] flex flex-col items-center justify-start pb-10">
      <header className="w-full bg-white/10 backdrop-blur-sm border-b border-white/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-sm">RF</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Red Fox Hotel</p>
            <p className="text-white/70 text-xs">Attendance Kiosk</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white font-mono text-lg font-bold leading-tight">{formatTime(now)}</p>
          <p className="text-white/70 text-xs">{formatDate(now)}</p>
        </div>
      </header>

      <main className="w-full max-w-md px-4 mt-6 space-y-4">
        {gpsLoading && <GpsLoadingScreen />}

        {gpsBlocked && (
          <GpsBlockedScreen
            isDenied={gps.status === "denied"}
            errorMessage={gps.status === "error" ? gps.message : undefined}
            onRetry={requestGPS}
          />
        )}

        {gps.status === "found" && (
          <>
            {submitState === "success" && submitResult ? (
              <SuccessScreen result={submitResult} employee={lookup!.employee} onReset={resetAll} />
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-green-700">
                  <span className="text-base">📍</span>
                  <span className="flex-1">
                    Location verified
                    {gps.branchName ? ` · ${gps.branchName}` : ` · ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`}
                  </span>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
                  <div>
                    <h2 className="text-foreground font-bold text-lg mb-1">Employee Lookup</h2>
                    <p className="text-muted-foreground text-sm">Enter your employee ID to mark attendance</p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={empCode}
                      onChange={(e) => {
                        setEmpCode(e.target.value.toUpperCase());
                        setLookupError("");
                        if (lookup) setLookup(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                      placeholder="e.g. EMP001"
                      className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                      autoComplete="off"
                      autoCapitalize="characters"
                    />
                    <button
                      onClick={handleLookup}
                      disabled={lookupLoading || !empCode.trim()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                    >
                      {lookupLoading ? "..." : "Find"}
                    </button>
                  </div>

                  {lookupError && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-destructive text-sm flex items-center gap-2">
                      <span>⚠</span> {lookupError}
                    </div>
                  )}

                  {lookup && (
                    <EmployeeCard employee={lookup.employee} todayAttendance={lookup.todayAttendance} />
                  )}
                </div>

                {lookup && (
                  <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
                    {!alreadyCheckedOut && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setActionType("checkin")}
                            className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                              actionType === "checkin"
                                ? "border-green-500 bg-green-50 text-green-700"
                                : "border-border text-muted-foreground hover:border-green-200"
                            }`}
                          >
                            <span className="block text-xl mb-1">🟢</span>
                            Check In
                            {lookup.todayAttendance?.checkIn && (
                              <span className="block text-xs mt-0.5 opacity-60">
                                at {lookup.todayAttendance.checkIn}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => setActionType("checkout")}
                            disabled={!alreadyCheckedIn}
                            className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                              actionType === "checkout"
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/30"
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            <span className="block text-xl mb-1">🔴</span>
                            Check Out
                            {!alreadyCheckedIn && (
                              <span className="block text-xs mt-0.5 opacity-60">Check in first</span>
                            )}
                          </button>
                        </div>

                        {submitError && (
                          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-destructive text-sm">
                            ⚠ {submitError}
                          </div>
                        )}

                        <button
                          onClick={handleSubmit}
                          disabled={submitState === "loading"}
                          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-base font-semibold hover:opacity-90 transition disabled:opacity-50 shadow-md"
                        >
                          {submitState === "loading"
                            ? "Submitting..."
                            : actionType === "checkin"
                            ? "Mark Check In"
                            : "Mark Check Out"}
                        </button>
                      </>
                    )}

                    {alreadyCheckedOut && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <div className="text-2xl mb-1">✅</div>
                        <p className="text-green-700 font-semibold text-sm">Attendance complete for today</p>
                        <p className="text-green-600 text-xs mt-1">
                          In: {lookup.todayAttendance?.checkIn} · Out: {lookup.todayAttendance?.checkOut}
                        </p>
                        <button onClick={resetAll} className="mt-3 text-xs text-muted-foreground underline">
                          New employee
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="text-center text-white/40 text-xs">
          Scan QR code or enter employee ID · Red Fox Hotel HRMS
        </div>
      </main>
    </div>
  );
}

function GpsLoadingScreen() {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center">
        <span className="text-3xl animate-pulse">📍</span>
      </div>
      <div>
        <h2 className="font-bold text-lg text-foreground">Detecting Your Location</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Please allow location access when prompted by your browser.
        </p>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function GpsBlockedScreen({
  isDenied,
  errorMessage,
  onRetry,
}: {
  isDenied: boolean;
  errorMessage?: string;
  onRetry: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-red-600 px-6 py-5 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-3">
          <span className="text-3xl">📵</span>
        </div>
        <h2 className="font-bold text-xl text-white">Location Access Required</h2>
        <p className="text-red-100 text-sm mt-1">
          You cannot mark attendance without enabling location.
        </p>
      </div>

      <div className="p-6 space-y-5">
        <p className="text-foreground text-sm leading-relaxed text-center">
          {isDenied
            ? "Location permission was denied. Tap the button below — your browser will ask for permission again."
            : `Location error: ${errorMessage ?? "Unable to detect location."} Tap the button to try again.`}
        </p>

        <button
          onClick={onRetry}
          className="w-full py-4 bg-primary text-primary-foreground rounded-xl text-base font-bold hover:opacity-90 active:scale-95 transition shadow-lg"
        >
          📍 Turn On Location Permission
        </button>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
          <p className="text-amber-800 font-semibold text-xs text-center">
            If the permission popup doesn't appear:
          </p>
          <p className="text-amber-700 text-xs">
            <strong>iPhone / Safari:</strong> Go to Settings → Safari → Location → set to "Ask" or "Allow"
          </p>
          <p className="text-amber-700 text-xs">
            <strong>Android / Chrome:</strong> Tap the 🔒 lock icon in the address bar → Site settings → Location → Allow
          </p>
          <p className="text-amber-700 text-xs">
            Then come back to this page and tap the button above.
          </p>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          GPS coordinates are recorded with every check-in and check-out to verify physical presence.
        </p>
      </div>
    </div>
  );
}

function EmployeeCard({ employee, todayAttendance }: { employee: EmployeeInfo; todayAttendance: TodayAttendance }) {
  return (
    <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0 overflow-hidden">
        {employee.photoUrl ? (
          <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover" />
        ) : (
          employee.name.charAt(0)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm truncate">{employee.name}</p>
        <p className="text-muted-foreground text-xs truncate">{employee.designation}</p>
        <p className="text-muted-foreground text-xs">{employee.branchName}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
        {todayAttendance?.checkIn && (
          <p className="text-xs text-muted-foreground mt-1">In: {todayAttendance.checkIn}</p>
        )}
      </div>
    </div>
  );
}

function SuccessScreen({
  result,
  employee,
  onReset,
}: {
  result: { type: string; time: string; workingHours?: number };
  employee: EmployeeInfo;
  onReset: () => void;
}) {
  const isCheckIn = result.type === "checkin";
  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-5xl">{isCheckIn ? "🟢" : "✅"}</div>
      <div>
        <h2 className="text-xl font-bold text-foreground">{isCheckIn ? "Checked In!" : "Checked Out!"}</h2>
        <p className="text-muted-foreground text-sm mt-1">{employee.name}</p>
      </div>
      <div className="bg-muted/50 rounded-xl px-6 py-4">
        <p className="text-3xl font-bold text-primary font-mono">{result.time}</p>
        {!isCheckIn && result.workingHours !== undefined && (
          <p className="text-sm text-muted-foreground mt-1">Working hours: {result.workingHours.toFixed(2)} hrs</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{employee.branchName}</p>
      </div>
      <p className="text-xs text-muted-foreground">This screen will close in 5 seconds…</p>
      <button
        onClick={onReset}
        className="w-full py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/50 transition"
      >
        Next Employee
      </button>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <KioskApp />
    </QueryClientProvider>
  );
}
