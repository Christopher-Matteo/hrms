import { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { AlertCircle, RefreshCw, LogOut, ArrowRight, KeyRound, ShieldCheck } from "lucide-react";

const BASE = "/api";

type Branch = { id: number; name: string; address: string; latitude: number | null; longitude: number | null; radius?: number };
type EmployeeInfo = {
  id: number;
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  branchId: number;
  branchName: string;
  photoUrl: string | null;
  faceRegistered: boolean;
};
type TodayAttendance = { id: number; checkIn: string | null; checkOut: string | null; status: string } | null;
type LookupResult = { employee: EmployeeInfo; todayAttendance: TodayAttendance };

type GpsState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "found"; lat: number; lng: number; accuracy: number; branchName?: string }
  | { status: "denied" }
  | { status: "error"; message: string };

type SubmitState = "idle" | "loading" | "success" | "error";

const CHALLENGES = [
  { id: "turn_left", label: "Turn Head Left", instruction: "Turn your head to the left." },
  { id: "turn_right", label: "Turn Head Right", instruction: "Turn your head to the right." },
  { id: "look_up", label: "Look Up", instruction: "Look up towards the ceiling." },
  { id: "look_down", label: "Look Down", instruction: "Look down towards the floor." },
  { id: "blink", label: "Blink Eyes", instruction: "Please blink your eyes." },
  { id: "smile", label: "Smile", instruction: "Smile clearly at the camera." },
];

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

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.stroke();
}

function drawCornerBrackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  const len = 15;

  // Top Left
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.stroke();

  // Top Right
  ctx.beginPath();
  ctx.moveTo(x + w, y + len);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - len, y);
  ctx.stroke();

  // Bottom Left
  ctx.beginPath();
  ctx.moveTo(x, y + h - len);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + len, y + h);
  ctx.stroke();

  // Bottom Right
  ctx.beginPath();
  ctx.moveTo(x + w, y + h - len);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - len, y + h);
  ctx.stroke();
}

interface BiometricAttendanceProps {
  mode: "self" | "kiosk";
  loggedInEmployee?: any; // Required in "self" mode
  loggedInToken?: string | null; // Required in "self" mode
  onExitKiosk?: () => void; // Required in "kiosk" mode to return to login screen
  onAttendanceSuccess?: () => void; // Refresh dashboards
}

export default function BiometricAttendance({
  mode,
  loggedInEmployee,
  loggedInToken,
  onExitKiosk,
  onAttendanceSuccess,
}: BiometricAttendanceProps) {
  const now = useNow();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [empCode, setEmpCode] = useState(mode === "self" && loggedInEmployee ? loggedInEmployee.employeeId : "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(mode === "self" ? loggedInToken || null : null);

  // Screen State FSM
  const [kioskState, setKioskState] = useState<"ID_GATE" | "PASSWORD_GATE" | "REGISTER_GATE" | "DASHBOARD" | "SUCCESS">(
    mode === "self" ? "DASHBOARD" : "ID_GATE"
  );

  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [, setActionType] = useState<"checkin" | "checkout">("checkin");
  const [, setSubmitState] = useState<SubmitState>("idle");
  const [submitResult, setSubmitResult] = useState<{ type: string; time: string; workingHours?: number; similarity?: number } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Biometrics States
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [faceActive, setFaceActive] = useState(false);
  const [, setFaceDetected] = useState(false);
  const [, setLivenessVerified] = useState(false);
  const [faceFeedback, setFaceFeedback] = useState("Searching for Face...");
  const [faceSimilarity, setFaceSimilarity] = useState<number | null>(null);
  const [verificationAttempts, setVerificationAttempts] = useState(0);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const [challengeSequence, setChallengeSequence] = useState<typeof CHALLENGES>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [livenessCompleted, setLivenessCompleted] = useState(false);
  const [, setCurrentState] = useState("IDLE");

  // Inactivity timeout ref
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);

  // Ref wrappers to prevent stale closures
  const countdownRef = useRef<number | null>(null);
  const capturedImageRef = useRef<string | null>(null);
  const faceActiveRef = useRef<boolean>(false);
  const livenessVerifiedRef = useRef<boolean>(false);
  const challengeSequenceRef = useRef<typeof CHALLENGES>([]);
  const currentChallengeIndexRef = useRef<number>(0);
  const prevSequenceRef = useRef<string[]>([]);
  const livenessCompletedRef = useRef<boolean>(false);
  const currentStateRef = useRef<string>("IDLE");
  const actionTypeRef = useRef<"checkin" | "checkout">("checkin");

  const updateCountdown = (val: number | null) => {
    countdownRef.current = val;
    setCountdown(val);
  };
  const updateActionType = (val: "checkin" | "checkout") => {
    actionTypeRef.current = val;
    setActionType(val);
  };
  const updateCapturedImage = (val: string | null) => {
    capturedImageRef.current = val;
    setCapturedImage(val);
  };
  const updateFaceActive = (val: boolean) => {
    faceActiveRef.current = val;
    setFaceActive(val);
  };
  const updateLivenessVerified = (val: boolean) => {
    livenessVerifiedRef.current = val;
    setLivenessVerified(val);
  };
  const updateChallengeSequence = (seq: typeof CHALLENGES) => {
    challengeSequenceRef.current = seq;
    setChallengeSequence(seq);
  };
  const updateCurrentChallengeIndex = (idx: number) => {
    currentChallengeIndexRef.current = idx;
    setCurrentChallengeIndex(idx);
  };
  const updateLivenessCompleted = (val: boolean) => {
    livenessCompletedRef.current = val;
    setLivenessCompleted(val);
  };
  const updateCurrentState = (state: string) => {
    if (currentStateRef.current !== state) {
      currentStateRef.current = state;
      setCurrentState(state);
    }
  };

  const blinkState = useRef<"open" | "closed">("open");
  const lastCenter = useRef<{ x: number; y: number } | null>(null);
  const stableStart = useRef<number | null>(null);
  const countdownTimeRef = useRef<number | null>(null);
  const isVerifyingRef = useRef(false);

  // Reset/Logout logic (Secure Kiosk cleaning)
  const resetAll = () => {
    stopCamera();
    if (mode === "kiosk") {
      setEmpCode("");
      setAuthToken(null);
      setLookup(null);
      setKioskState("ID_GATE");
    } else {
      fetchSelfLookup();
      setKioskState("DASHBOARD");
    }
    setPassword("");
    setConfirmPassword("");
    setLookupError("");
    setSubmitState("idle");
    setSubmitResult(null);
    setSubmitError("");
    updateFaceActive(false);
    setFaceDetected(false);
    updateLivenessVerified(false);
    updateLivenessCompleted(false);
    setFaceSimilarity(null);
    setVerificationAttempts(0);
    setAnnouncements([]);
    updateActionType("checkin");
    updateCurrentState("IDLE");
  };

  // Reset activity timer (Kiosk mode only)
  const resetActivityTimer = useCallback(() => {
    if (mode !== "kiosk") return;
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    if (kioskState !== "ID_GATE" && kioskState !== "SUCCESS") {
      activityTimeoutRef.current = setTimeout(() => {
        console.log("Kiosk auto-logout triggered due to 60s inactivity.");
        resetAll();
      }, 60000);
    }
  }, [kioskState, mode]);

  // Activity listeners
  useEffect(() => {
    if (mode !== "kiosk") return;
    const handleActivity = () => resetActivityTimer();
    const events = ["mousemove", "mousedown", "click", "scroll", "keypress", "touchstart"];
    events.forEach((e) => window.addEventListener(e, handleActivity));
    resetActivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
    };
  }, [resetActivityTimer, kioskState, mode]);

  const generateChallengeSequence = (): typeof CHALLENGES => {
    updateCurrentState("GENERATE_CHALLENGES");
    const count = Math.random() < 0.5 ? 2 : 3;
    let newSeq: typeof CHALLENGES = [];

    const shuffle = () => {
      const list = [...CHALLENGES];
      const res: typeof CHALLENGES = [];
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * list.length);
        res.push(list.splice(idx, 1)[0]!);
      }
      return res;
    };

    let attempts = 0;
    do {
      newSeq = shuffle();
      attempts++;
    } while (
      attempts < 10 &&
      newSeq.map(c => c.id).join(",") === prevSequenceRef.current.join(",")
    );

    prevSequenceRef.current = newSeq.map(c => c.id);
    return newSeq;
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${BASE}/kiosk/branches`);
      const data = await res.json();
      setBranches(data);
      return data;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const requestGPS = useCallback(async () => {
    if (!navigator.geolocation) {
      setGps({ status: "error", message: "Geolocation is not supported by this browser." });
      return;
    }
    setGps({ status: "requesting" });
    
    let activeBranches = branches;
    if (activeBranches.length === 0) {
      activeBranches = await fetchBranches();
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        let nearest: Branch | null = null;
        let minDist = Infinity;
        for (const b of activeBranches) {
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
          accuracy,
          branchName: nearest && minDist < 5000 ? nearest.name : undefined,
        });
      },
      (err) => {
        if (err.code === 1) setGps({ status: "denied" });
        else setGps({ status: "error", message: err.message });
      },
      { enableHighAccuracy: false, timeout: 15000 }
    );
  }, [branches]);

  const mockGPS = async () => {
    let activeBranches = branches;
    if (activeBranches.length === 0) {
      activeBranches = await fetchBranches();
    }
    const targetBranchId = selectedBranchId || (activeBranches.length > 0 ? activeBranches[0].id : null);
    const b = activeBranches.find(x => x.id === targetBranchId) || activeBranches[0];
    if (b) {
      setGps({
        status: "found",
        lat: b.latitude ?? 12.9716,
        lng: b.longitude ?? 77.5946,
        accuracy: 10,
        branchName: b.name,
      });
    } else {
      setGps({
        status: "found",
        lat: 12.9716,
        lng: 77.5946,
        accuracy: 10,
        branchName: "Mock Branch",
      });
    }
  };

  const getSelectedBranchDistance = () => {
    if (!selectedBranchId || gps.status !== "found") return null;
    const branch = branches.find(b => b.id === selectedBranchId);
    if (!branch || branch.latitude === null || branch.longitude === null) return null;
    return haversineDistance(gps.lat, gps.lng, branch.latitude, branch.longitude);
  };

  const selectedBranchDistance = getSelectedBranchDistance();
  const isNearSelectedBranch = selectedBranchDistance !== null && selectedBranchDistance <= 200;

  const fetchSelfLookup = async () => {
    if (mode !== "self" || !loggedInEmployee) return;
    try {
      const lr = await fetch(`${BASE}/kiosk/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: loggedInEmployee.employeeId }),
      });
      if (lr.ok) {
        const ldata = await lr.json();
        setLookup(ldata as LookupResult);
      }
    } catch (e) {
      console.error("Lookup error:", e);
    }
  };

  useEffect(() => {
    fetchBranches().then(() => {
      requestGPS();
      if (mode === "self" && loggedInEmployee) {
        fetchSelfLookup();
      }
    });
  }, [mode, loggedInEmployee]);

  useEffect(() => {
    if (lookup?.employee) {
      setSelectedBranchId(lookup.employee.branchId);
    } else {
      setSelectedBranchId(null);
    }
  }, [lookup]);

  const loadFaceModels = async () => {
    if (modelsLoaded || modelsLoading) return;
    setModelsLoading(true);
    setFaceFeedback("Loading face recognition models...");
    try {
      const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      setFaceFeedback("Models loaded. Ready.");
    } catch (e: any) {
      console.error(e);
      setLookupError("Failed to load face recognition models: " + (e.message ?? "unknown"));
    } finally {
      setModelsLoading(false);
    }
  };

  const startCamera = async () => {
    await loadFaceModels();
    updateFaceActive(true);
    setFaceDetected(false);
    updateLivenessVerified(true);
    updateLivenessCompleted(true);
    setFaceSimilarity(null);
    updateCountdown(null);
    updateCapturedImage(null);
    blinkState.current = "open";
    isVerifyingRef.current = false;
    stableStart.current = null;
    lastCenter.current = null;

    updateCurrentState("DETECT_FACE");

    updateChallengeSequence([]);
    updateCurrentChallengeIndex(0);

    setFaceFeedback("Camera Started");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      startDetectionLoop();
    } catch (err: any) {
      console.error(err);
      setFaceFeedback("");
      updateFaceActive(false);
      setSubmitError("Could not access webcam. Verify browser permissions.");
    }
  };

  const stopCamera = () => {
    updateFaceActive(false);
    setFaceDetected(false);
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startDetectionLoop = () => {
    const loop = async () => {
      if (!faceActiveRef.current || !streamRef.current || !videoRef.current || !canvasRef.current || isVerifyingRef.current) {
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.paused || video.ended || video.readyState < 2) {
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const guideWidth = 240;
      const guideHeight = 240;
      const guideX = (canvas.width - guideWidth) / 2;
      const guideY = (canvas.height - guideHeight) / 2;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      drawRoundedRect(ctx, guideX, guideY, guideWidth, guideHeight, 20);
      ctx.setLineDash([]);

      try {
        let detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (detections.length === 0) {
          detections = await faceapi
            .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
            .withFaceLandmarks()
            .withFaceDescriptors();
        }

        if (detections.length > 1) {
          setFaceFeedback("Multiple Faces Detected! Resetting...");
          if (!livenessCompletedRef.current) {
            const newSeq = generateChallengeSequence();
            updateChallengeSequence(newSeq);
            updateCurrentChallengeIndex(0);
            updateLivenessVerified(false);
          }
          stableStart.current = null;
          updateCountdown(null);
          requestRef.current = requestAnimationFrame(loop);
          return;
        }

        if (detections.length === 0) {
          setFaceDetected(false);
          setFaceFeedback("Searching for Face...");
          updateCurrentState("DETECT_FACE");
          if (!livenessCompletedRef.current && currentChallengeIndexRef.current > 0) {
            const newSeq = generateChallengeSequence();
            updateChallengeSequence(newSeq);
            updateCurrentChallengeIndex(0);
            updateLivenessVerified(false);
          }
          stableStart.current = null;
          lastCenter.current = null;
          updateCountdown(null);
          requestRef.current = requestAnimationFrame(loop);
          return;
        }

        setFaceDetected(true);
        const detection = detections[0]!;
        const box = detection.detection.box;
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        const canvasCenterX = canvas.width / 2;
        const canvasCenterY = canvas.height / 2;

        const isCentered = Math.abs(centerX - canvasCenterX) < 60 && Math.abs(centerY - canvasCenterY) < 60;
        const isSizeOk = box.width >= 120 && box.width <= 280;

        if (!isCentered || !isSizeOk) {
          if (!isCentered) setFaceFeedback("Center Your Face");
          else if (box.width < 120) setFaceFeedback("Move Closer");
          else setFaceFeedback("Move Back");

          if (!livenessCompletedRef.current && currentChallengeIndexRef.current > 0) {
            updateCurrentChallengeIndex(0);
          }
          stableStart.current = null;
          updateCountdown(null);
          requestRef.current = requestAnimationFrame(loop);
          return;
        }

        const landmarks = detection.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const mouth = landmarks.getMouth();
        const nose = landmarks.getNose();

        const noseTip = nose[3];
        const leftCorner = leftEye[0];
        const rightCorner = rightEye[3];
        const distLeft = Math.hypot(noseTip.x - leftCorner.x, noseTip.y - leftCorner.y);
        const distRight = Math.hypot(rightCorner.x - noseTip.x, rightCorner.y - noseTip.y);
        const yawRatio = distLeft / (distRight || 1);

        const eyeY = (leftCorner.y + rightCorner.y) / 2;
        const mouthCenterY = (mouth[0].y + mouth[6].y) / 2;
        const distNoseToEyes = noseTip.y - eyeY;
        const distMouthToNose = mouthCenterY - noseTip.y;
        const pitchRatio = distNoseToEyes / (distMouthToNose || 1);

        const eyeDist = Math.hypot(leftCorner.x - rightCorner.x, leftCorner.y - rightCorner.y);
        const mouthWidth = Math.hypot(mouth[0].x - mouth[6].x, mouth[0].y - mouth[6].y);
        const smileRatio = mouthWidth / (eyeDist || 1);
        const isSmiling = smileRatio > 0.46;

        const getEAR = (eye: faceapi.Point[]) => {
          const p2_p6 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
          const p3_p5 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
          const p1_p4 = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
          return (p2_p6 + p3_p5) / (2.0 * p1_p4 || 1);
        };
        const leftEAR = getEAR(leftEye);
        const rightEAR = getEAR(rightEye);
        const averageEAR = (leftEAR + rightEAR) / 2.0;

        let localLiveness = livenessCompletedRef.current;
        const activeChallenge = challengeSequenceRef.current[currentChallengeIndexRef.current];

        if (!localLiveness && activeChallenge) {
          updateCurrentState(`RUN_CHALLENGE_${currentChallengeIndexRef.current + 1}`);
          let challengePassed = false;

          if (activeChallenge.id === "blink") {
            if (blinkState.current === "open" && averageEAR < 0.23) {
              blinkState.current = "closed";
            } else if (blinkState.current === "closed" && averageEAR > 0.25) {
              blinkState.current = "open";
              challengePassed = true;
            }
          } else if (activeChallenge.id === "smile") {
            if (isSmiling) challengePassed = true;
          } else if (activeChallenge.id === "turn_left") {
            if (yawRatio > 1.5) challengePassed = true;
          } else if (activeChallenge.id === "turn_right") {
            if (yawRatio < 0.65) challengePassed = true;
          } else if (activeChallenge.id === "look_up") {
            if (pitchRatio < 0.7) challengePassed = true;
          } else if (activeChallenge.id === "look_down") {
            if (pitchRatio > 1.6) challengePassed = true;
          }

          if (challengePassed) {
            const nextIdx = currentChallengeIndexRef.current + 1;
            if (nextIdx < challengeSequenceRef.current.length) {
              updateCurrentChallengeIndex(nextIdx);
              blinkState.current = "open";
            } else {
              updateLivenessCompleted(true);
              updateLivenessVerified(true);
              localLiveness = true;
              updateCurrentState("LIVENESS_COMPLETE");
            }
          }
        }

        let statusMsg = "Face Detected";
        let isReady = false;
        let boxColor = "rgba(234, 179, 8, 0.8)"; // yellow

        if (!localLiveness && activeChallenge) {
          statusMsg = `Challenge ${currentChallengeIndexRef.current + 1}/${challengeSequenceRef.current.length}: ${activeChallenge.instruction}`;
        } else {
          statusMsg = "Hold Still";
          isReady = true;
          boxColor = "rgba(34, 197, 94, 0.8)"; // green
        }

        setFaceFeedback(statusMsg);
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 12);
        drawCornerBrackets(ctx, box.x, box.y, box.width, box.height, boxColor);

        let currentShift = 0;
        if (lastCenter.current) {
          currentShift = Math.hypot(centerX - lastCenter.current.x, centerY - lastCenter.current.y);
        }

        if (isReady && !capturedImageRef.current && !isVerifyingRef.current) {
          updateCurrentState("WAIT_FOR_STABLE_FACE");
          if (lastCenter.current) {
            if (currentShift < 15) {
              if (stableStart.current === null) {
                stableStart.current = Date.now();
              } else if (countdownRef.current === null && Date.now() - stableStart.current >= 1000) {
                updateCountdown(3);
                countdownTimeRef.current = Date.now();
                stableStart.current = null;
              }
            } else {
              stableStart.current = Date.now();
            }
          }
          lastCenter.current = { x: centerX, y: centerY };
        } else if (!isReady) {
          stableStart.current = null;
          updateCountdown(null);
        }

        if (countdownRef.current !== null) {
          const diff = Date.now() - (countdownTimeRef.current || 0);
          if (diff >= 1000) {
            const nextCount = countdownRef.current - 1;
            if (nextCount > 0) {
              updateCountdown(nextCount);
              countdownTimeRef.current = Date.now();
            } else {
              updateCountdown(null);
              isVerifyingRef.current = true;
              updateCurrentState("CAPTURE_FACE");
              triggerCapture(video);
            }
          }
        }

      } catch (err: any) {
        console.error("Error in face loop:", err);
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
  };

  const triggerCapture = (video: HTMLVideoElement) => {
    setFaceFeedback("Capturing...");
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");
    let photoData = "";
    if (tempCtx) {
      tempCtx.drawImage(video, 0, 0);
      photoData = tempCanvas.toDataURL("image/jpeg");
      updateCapturedImage(photoData);
    }
    stopCamera();
    updateCurrentState("GENERATE_EMBEDDING");

    setTimeout(() => {
      updateCapturedImage(null);
      handleVerifyEmbedding(photoData);
    }, 1000);
  };

  const handleVerifyEmbedding = async (photo: string) => {
    if (!lookup) return;
    setSubmitState("loading");
    setSubmitError("");
    setFaceSimilarity(null);
    updateCurrentState("COMPARE_EMBEDDING");
    
    const nextAttempts = verificationAttempts + 1;
    setVerificationAttempts(nextAttempts);

    try {
      const payload: Record<string, any> = {
        employeeCode: lookup.employee.employeeId,
        photo: photo,
        type: actionTypeRef.current,
        faceAttempts: nextAttempts,
        source: mode === "self" ? "PORTAL" : "KIOSK",
        selectedBranchId: selectedBranchId,
      };

      if (gps.status === "found") {
        payload.latitude = gps.lat;
        payload.longitude = gps.lng;
        payload.accuracy = gps.accuracy;
      }

      const r = await fetch(`${BASE}/kiosk/verify-face`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authToken ? `Bearer ${authToken}` : "",
        },
        body: JSON.stringify(payload),
      });

      const data = await r.json();
      if (!r.ok) {
        setSubmitError(data.error ?? "Face verification failed");
        setFaceSimilarity(data.similarity ?? null);
        setSubmitState("error");
        updateCurrentState("ATTENDANCE_FAILED");
      } else {
        setFaceSimilarity(data.similarity);
        setSubmitResult({ type: data.type, time: data.time, workingHours: data.workingHours, similarity: data.similarity });
        setSubmitState("success");
        setKioskState("SUCCESS");
        updateCurrentState("ATTENDANCE_SUCCESS");
        
        if (onAttendanceSuccess) {
          onAttendanceSuccess();
        }

        setTimeout(() => {
          resetAll();
        }, 5000);
      }
    } catch {
      setSubmitError("Network error. Please try again.");
      setSubmitState("error");
      updateCurrentState("ATTENDANCE_FAILED");
    } finally {
      isVerifyingRef.current = false;
    }
  };

  // Step 1: Check Employee status and ID exist (Kiosk mode only)
  const handleIdGate = async () => {
    if (!empCode.trim()) return;
    setLookupLoading(true);
    setLookupError("");
    try {
      const r = await fetch(`${BASE}/auth/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: empCode.trim() }),
      });
      const data = await r.json();
      if (!r.ok) {
        setLookupError(data.error ?? "Employee not found");
      } else {
        if (data.registered) {
          setKioskState("PASSWORD_GATE");
        } else {
          setKioskState("REGISTER_GATE");
        }
      }
    } catch {
      setLookupError("Network error. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  // Step 2a: Create Password (Registration Gate - Kiosk mode only)
  const handleRegister = async () => {
    if (!password || password !== confirmPassword) {
      setLookupError("Passwords do not match");
      return;
    }
    setLookupLoading(true);
    setLookupError("");
    try {
      const r = await fetch(`${BASE}/auth/register-employee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: empCode.trim(), password }),
      });
      const data = await r.json();
      if (!r.ok) {
        setLookupError(data.error ?? "Registration failed");
      } else {
        handleLogin();
      }
    } catch {
      setLookupError("Network error. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  // Step 2b: Login and fetch session details (Kiosk mode only)
  const handleLogin = async () => {
    setLookupLoading(true);
    setLookupError("");
    try {
      const r = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: empCode.trim(), password, client: "KIOSK" }),
      });
      const data = await r.json();
      if (!r.ok) {
        setLookupError(data.error ?? "Invalid password credentials");
      } else {
        setAuthToken(data.token);
        
        const lr = await fetch(`${BASE}/kiosk/lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeCode: empCode.trim() }),
        });
        const ldata = await lr.json();
        setLookup(ldata as LookupResult);

        const ar = await fetch(`${BASE}/announcements`, {
          headers: { "Authorization": `Bearer ${data.token}` }
        });
        if (ar.ok) {
          const adata = await ar.json();
          setAnnouncements(adata.slice(0, 3));
        }

        setKioskState("DASHBOARD");
      }
    } catch {
      setLookupError("Network error. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAction = (type: "checkin" | "checkout") => {
    updateActionType(type);
    setSubmitState("idle");
    setSubmitError("");
    startCamera();
  };

  const gpsReady = gps.status === "found" && isNearSelectedBranch;
  const gpsBlocked = gps.status === "denied" || gps.status === "error";
  const gpsLoading = gps.status === "idle" || gps.status === "requesting";

  // RENDER FOR SELF-PORTAL TAB
  if (mode === "self") {
    return (
      <div className="space-y-6 max-w-xl mx-auto animate-in fade-in duration-300">
        <div>
          <h3 className="text-xl font-bold dark:text-white">Biometric Attendance Check-In</h3>
          <p className="text-xs text-muted-foreground">Verify your physical presence and mark daily attendance via facial recognition</p>
        </div>

        {/* GPS Banner */}
        {gpsLoading && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl animate-pulse">📍</span>
            <div className="flex-1">
              <p className="text-blue-800 dark:text-blue-300 font-semibold text-sm">Detecting location…</p>
              <p className="text-blue-600 dark:text-blue-400 text-xs mt-0.5">Mandatory for biometric geofencing.</p>
            </div>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
            </div>
          </div>
        )}

        {gps.status === "found" && (
          <div className={`border rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm ${
            !lookup || isNearSelectedBranch 
              ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50 text-green-700 dark:text-green-400" 
              : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50 text-red-700 dark:text-red-400"
          }`}>
            <span className="text-base">{(!lookup || isNearSelectedBranch) ? "✅" : "❌"}</span>
            <span className="flex-1 font-medium text-slate-800 dark:text-zinc-200">
              {!lookup 
                ? "Location active"
                : `Near selected branch: ${branches.find(b => b.id === selectedBranchId)?.name || ""}`
              }
              {lookup && !isNearSelectedBranch && (
                `Too far from selected branch — must be within 200m`
              )}
              {selectedBranchDistance !== null && (
                <span className="text-xs text-muted-foreground block">
                  Current distance: {Math.round(selectedBranchDistance)}m (Accuracy: {Math.round((gps as any).accuracy)}m)
                </span>
              )}
            </span>
          </div>
        )}

        {gpsBlocked && (
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="text-center">
              <span className="text-3xl">📵</span>
              <h2 className="font-bold text-lg text-foreground mt-2">Location Required</h2>
              <p className="text-muted-foreground text-xs mt-1">Please allow GPS location permission to mark attendance.</p>
            </div>
            <button
              onClick={requestGPS}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold active:scale-95 transition"
            >
              Retry GPS Location Permission
            </button>
            <button
              onClick={mockGPS}
              className="w-full py-1.5 bg-zinc-800 text-white rounded-xl text-xs font-mono"
            >
              🔧 Dev: Mock GPS (Selected Branch)
            </button>
          </div>
        )}

        {kioskState === "SUCCESS" && lookup && submitResult && (
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-md p-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-950/30 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-10 h-10 text-green-600 dark:text-green-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground dark:text-white">
                {submitResult.type === "checkin" ? "Check In Verified!" : "Check Out Verified!"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Hello, {lookup.employee.name}</p>
            </div>
            <div className="bg-muted/50 dark:bg-zinc-800 rounded-xl px-6 py-4">
              <p className="text-3xl font-bold text-primary font-mono">{submitResult.time}</p>
              {submitResult.workingHours !== undefined && submitResult.workingHours > 0 && (
                <p className="text-sm text-muted-foreground mt-1 font-medium">Working Hours: {submitResult.workingHours.toFixed(2)} hrs</p>
              )}
              {submitResult.similarity !== undefined && (
                <p className="text-xs text-muted-foreground mt-1 font-medium">Similarity: {submitResult.similarity.toFixed(1)}%</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{lookup.employee.branchName}</p>
            </div>
          </div>
        )}

        {kioskState === "DASHBOARD" && lookup && (
          <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-5">
            {/* Branch Selection */}
            <div className="space-y-2 text-left border-b dark:border-zinc-800 pb-4">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Worksite Branch
              </label>
              <select
                value={selectedBranchId ?? ""}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                disabled={faceActive}
                className="w-full bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100/50 dark:hover:bg-zinc-700/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition font-semibold disabled:opacity-50"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-center py-2 border-b dark:border-zinc-800">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Today's Attendance Status</p>
              {lookup.todayAttendance?.checkIn ? (
                <p className="text-green-600 dark:text-green-400 font-bold text-sm mt-0.5">
                  Checked In at {lookup.todayAttendance.checkIn}
                  {lookup.todayAttendance.checkOut && ` · Checked Out at ${lookup.todayAttendance.checkOut}`}
                </p>
              ) : (
                <p className="text-amber-600 dark:text-amber-400 font-bold text-sm mt-0.5">Not Checked In Yet</p>
              )}
            </div>

            {!faceActive ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAction("checkin")}
                  disabled={!!lookup.todayAttendance?.checkIn || !gpsReady}
                  className="py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                >
                  Mark Check In
                </button>
                <button
                  onClick={() => handleAction("checkout")}
                  disabled={!lookup.todayAttendance?.checkIn || !!lookup.todayAttendance?.checkOut || !gpsReady}
                  className="py-3.5 bg-primary hover:bg-opacity-95 text-primary-foreground rounded-xl text-sm font-bold shadow-md active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                >
                  Mark Check Out
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative border dark:border-zinc-800 rounded-xl bg-black overflow-hidden aspect-video w-full">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none scale-x-[-1]"
                  />

                  {challengeSequence.length > 0 && !livenessCompleted && (
                    <div className="absolute top-3 left-3 right-3 bg-black/60 p-2 rounded-md space-y-1">
                      <div className="flex justify-between text-[10px] text-white font-bold tracking-wider">
                        <span>LIVENESS CHALLENGES</span>
                        <span>{currentChallengeIndex} / {challengeSequence.length} DONE</span>
                      </div>
                      <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-green-500 h-full transition-all duration-300" 
                          style={{ width: `${(currentChallengeIndex / challengeSequence.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/75 text-white text-[11px] text-center font-medium">
                    {faceFeedback}
                  </div>

                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                      <span className="text-white text-6xl font-bold font-mono animate-ping">
                        {countdown}
                      </span>
                    </div>
                  )}

                  {capturedImage && (
                    <div className="absolute inset-0 bg-black">
                      <img src={capturedImage} className="w-full h-full object-cover scale-x-[-1]" alt="Captured Frame" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                        <span className="text-white text-xs font-semibold tracking-wider animate-pulse flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          VERIFYING BIOMETRICS...
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={stopCamera}
                  className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 border dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                >
                  Cancel Scan
                </button>
              </div>
            )}

            {submitError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-destructive text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">{submitError}</p>
                  {faceSimilarity !== null && faceSimilarity < 60 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Facial similarity score ({faceSimilarity.toFixed(1)}%) is below the required 60.0% threshold.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // RENDER FOR FULL-SCREEN TERMINAL (KIOSK MODE)
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[hsl(348,70%,15%)] to-[hsl(348,70%,28%)] flex flex-col items-center justify-start pb-10">
      {/* Header */}
      <header className="w-full bg-white/10 backdrop-blur-sm border-b border-white/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-sm">RF</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Red Fox Hotel</p>
            <p className="text-white/70 text-xs">Shared Attendance Kiosk</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white font-mono text-lg font-bold leading-tight">{formatTime(now)}</p>
            <p className="text-white/70 text-xs">{formatDate(now)}</p>
          </div>
        </div>
      </header>

      <main className="w-full max-w-md px-4 mt-6 space-y-4">
        {/* GPS Banner */}
        {gpsLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl animate-pulse">📍</span>
            <div className="flex-1">
              <p className="text-blue-800 font-semibold text-sm">Detecting location…</p>
              <p className="text-blue-600 text-xs mt-0.5">Mandatory for biometric geofencing.</p>
            </div>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
            </div>
          </div>
        )}

        {gps.status === "found" && (
          <div className={`border rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm ${
            !lookup || isNearSelectedBranch 
              ? "bg-green-50 border-green-200 text-green-700" 
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            <span className="text-base">{(!lookup || isNearSelectedBranch) ? "✅" : "❌"}</span>
            <span className="flex-1 font-medium text-slate-800 dark:text-zinc-200">
              {!lookup 
                ? "Location active"
                : `Near selected branch: ${branches.find(b => b.id === selectedBranchId)?.name || ""}`
              }
              {lookup && !isNearSelectedBranch && (
                `Too far from selected branch — must be within 200m`
              )}
              {selectedBranchDistance !== null && (
                <span className="text-xs text-muted-foreground block">
                  Current distance: {Math.round(selectedBranchDistance)}m (Accuracy: {Math.round((gps as any).accuracy)}m)
                </span>
              )}
            </span>
          </div>
        )}

        {gpsBlocked && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden p-5 space-y-4">
            <div className="text-center">
              <span className="text-3xl">📵</span>
              <h2 className="font-bold text-lg text-foreground mt-2">Location Required</h2>
              <p className="text-muted-foreground text-xs mt-1">Please allow GPS location permission to mark attendance.</p>
            </div>
            <button
              onClick={requestGPS}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold active:scale-95 transition"
            >
              Retry GPS Location Permission
            </button>
            <button
              onClick={mockGPS}
              className="w-full py-1.5 bg-zinc-800 text-white rounded-xl text-xs font-mono"
            >
              🔧 Dev: Mock GPS (Selected Branch)
            </button>
          </div>
        )}

        {/* Screen 1: Employee ID Gate */}
        {kioskState === "ID_GATE" && (
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-foreground font-bold text-xl mb-0.5">Welcome</h2>
                <p className="text-muted-foreground text-sm">Enter your Employee ID to get started</p>
              </div>
              {onExitKiosk && (
                <button
                  onClick={onExitKiosk}
                  className="text-xs text-zinc-500 hover:text-primary font-bold border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-zinc-50 transition active:scale-95"
                >
                  Exit Kiosk
                </button>
              )}
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={empCode}
                onChange={(e) => {
                  setEmpCode(e.target.value.toUpperCase());
                  setLookupError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleIdGate()}
                placeholder="EMP001"
                className="w-full px-4 py-3 border rounded-xl text-base font-mono focus:outline-none focus:ring-2 focus:ring-primary uppercase bg-white text-zinc-800"
                disabled={lookupLoading}
              />
              <button
                onClick={handleIdGate}
                disabled={lookupLoading || !empCode.trim()}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
              >
                {lookupLoading ? "Processing..." : "Continue"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {lookupError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{lookupError}</span>
              </div>
            )}
          </div>
        )}

        {/* Screen 2a: Create Password (Registration Gate) */}
        {kioskState === "REGISTER_GATE" && (
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4 animate-in fade-in duration-300">
            <div>
              <span className="text-2xl">🔑</span>
              <h2 className="text-foreground font-bold text-xl mt-1">First Time Setup</h2>
              <p className="text-muted-foreground text-sm">Create a secure password to register your employee account</p>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create Password"
                className="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary bg-white text-zinc-800"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary bg-white text-zinc-800"
              />
              <button
                onClick={handleRegister}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition"
              >
                Register & Log In
              </button>
              <button
                onClick={resetAll}
                className="w-full py-2 border rounded-xl text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>

            {lookupError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{lookupError}</span>
              </div>
            )}
          </div>
        )}

        {/* Screen 2b: Enter Password Gate */}
        {kioskState === "PASSWORD_GATE" && (
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <KeyRound className="w-6 h-6 text-primary" />
              <div>
                <h2 className="text-foreground font-bold text-xl leading-tight">Enter Password</h2>
                <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider">{empCode}</p>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary bg-white text-zinc-800"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button
                onClick={handleLogin}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition"
              >
                Sign In
              </button>
              <button
                onClick={resetAll}
                className="w-full py-2 border rounded-xl text-sm text-muted-foreground"
              >
                Back
              </button>
            </div>

            {lookupError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{lookupError}</span>
              </div>
            )}
          </div>
        )}

        {/* Screen 3: Dashboard & Camera view */}
        {kioskState === "DASHBOARD" && lookup && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Profile widget */}
            <div className="bg-white rounded-2xl shadow-xl p-5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg overflow-hidden flex-shrink-0">
                {lookup.employee.photoUrl ? (
                  <img src={lookup.employee.photoUrl} alt={lookup.employee.name} className="w-full h-full object-cover" />
                ) : (
                  lookup.employee.name.charAt(0)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">{lookup.employee.name}</p>
                <p className="text-muted-foreground text-xs truncate">{lookup.employee.designation} · {lookup.employee.department}</p>
                <p className="text-muted-foreground text-xs">{lookup.employee.branchName}</p>
              </div>
              <button onClick={resetAll} className="p-2 text-muted-foreground hover:text-destructive">
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Attendance state & Actions */}
            <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
              {/* Branch Selection Dropdown */}
              <div className="space-y-1.5 text-left border-b pb-3.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Checking In/Out Branch
                </label>
                <select
                  value={selectedBranchId ?? ""}
                  onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                  disabled={faceActive}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition font-semibold disabled:opacity-50"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-center py-2 border-b">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Today's Status</p>
                {lookup.todayAttendance?.checkIn ? (
                  <p className="text-green-600 font-bold text-sm mt-0.5">
                    Checked In at {lookup.todayAttendance.checkIn}
                    {lookup.todayAttendance.checkOut && ` · Checked Out at ${lookup.todayAttendance.checkOut}`}
                  </p>
                ) : (
                  <p className="text-amber-600 font-bold text-sm mt-0.5">Not Checked In yet</p>
                )}
              </div>

              {!faceActive ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAction("checkin")}
                    disabled={!!lookup.todayAttendance?.checkIn || !gpsReady}
                    className="py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold shadow-md active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Check In
                  </button>
                  <button
                    onClick={() => handleAction("checkout")}
                    disabled={!lookup.todayAttendance?.checkIn || !!lookup.todayAttendance?.checkOut || !gpsReady}
                    className="py-3.5 bg-primary hover:bg-opacity-95 text-primary-foreground rounded-xl text-sm font-semibold shadow-md active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Check Out
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active Camera view */}
                  <div className="relative border rounded-lg bg-black overflow-hidden aspect-video w-full">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full pointer-events-none scale-x-[-1]"
                    />

                    {challengeSequence.length > 0 && !livenessCompleted && (
                      <div className="absolute top-3 left-3 right-3 bg-black/60 p-2 rounded-md space-y-1">
                        <div className="flex justify-between text-[10px] text-white font-bold tracking-wider">
                          <span>LIVENESS CHALLENGES</span>
                          <span>{currentChallengeIndex} / {challengeSequence.length} DONE</span>
                        </div>
                        <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-green-500 h-full transition-all duration-300" 
                            style={{ width: `${(currentChallengeIndex / challengeSequence.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/75 text-white text-[11px] text-center font-medium">
                      {faceFeedback}
                    </div>

                    {countdown !== null && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                        <span className="text-white text-6xl font-bold font-mono animate-ping">
                          {countdown}
                        </span>
                      </div>
                    )}

                    {capturedImage && (
                      <div className="absolute inset-0 bg-black">
                        <img src={capturedImage} className="w-full h-full object-cover scale-x-[-1]" alt="Captured Frame" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                          <span className="text-white text-xs font-semibold tracking-wider animate-pulse flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            VERIFYING BIOMETRICS...
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={stopCamera}
                    className="w-full py-2 bg-zinc-100 border text-sm text-zinc-700 rounded-xl hover:bg-zinc-200 transition"
                  >
                    Cancel Biometrics Check
                  </button>
                </div>
              )}

              {submitError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-destructive text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">{submitError}</p>
                    {faceSimilarity !== null && faceSimilarity < 60 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Facial similarity score ({faceSimilarity.toFixed(1)}%) is below the required 60.0% threshold.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Announcements carousel */}
            {announcements.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-5 space-y-3">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">📢 Branch Announcements</p>
                <div className="space-y-2">
                  {announcements.map((a) => (
                    <div key={a.id} className="p-3 bg-muted/40 rounded-xl border border-border">
                      <p className="font-semibold text-sm text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Screen 4: Success Biometric Feedback */}
        {kioskState === "SUCCESS" && lookup && submitResult && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-10 h-10 text-green-600 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {submitResult.type === "checkin" ? "Check In Verified!" : "Check Out Verified!"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Hello, {lookup.employee.name}</p>
            </div>
            <div className="bg-muted/50 rounded-xl px-6 py-4">
              <p className="text-3xl font-bold text-primary font-mono">{submitResult.time}</p>
              {submitResult.workingHours !== undefined && submitResult.workingHours > 0 && (
                <p className="text-sm text-muted-foreground mt-1 font-medium">Working Hours: {submitResult.workingHours.toFixed(2)} hrs</p>
              )}
              {submitResult.similarity !== undefined && (
                <p className="text-xs text-muted-foreground mt-1 font-medium">Similarity: {submitResult.similarity.toFixed(1)}%</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{lookup.employee.branchName}</p>
            </div>
            <p className="text-xs text-muted-foreground animate-pulse">Session clearing in 5 seconds...</p>
            <button
              onClick={resetAll}
              className="w-full py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition"
            >
              Done
            </button>
          </div>
        )}

        <p className="text-center text-white/40 text-[10px]">
          Red Fox Hotel Shared Attendance Kiosk
        </p>
      </main>
    </div>
  );
}
