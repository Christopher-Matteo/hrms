import { useState, useEffect, useRef } from "react";
import * as faceapi from "@vladmandic/face-api";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, RefreshCw, ScanFace } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const BASE = (import.meta as any).env.VITE_API_URL && !(import.meta as any).env.VITE_API_URL.includes("railway.app") ? ((import.meta as any).env.VITE_API_URL.replace(/\/+$/, "") + "/api") : "/api";

interface FaceEnrollmentProps {
  employeeId: number;
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

export default function FaceEnrollment({ employeeId }: FaceEnrollmentProps) {
  const [registered, setRegistered] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [active, setActive] = useState(false);
  const [feedback, setFeedback] = useState<string>("Searching for Face...");
  const [error, setError] = useState<string>("");

  const [faceDetected, setFaceDetected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Debug Panel States
  const [debugData, setDebugData] = useState({
    detected: "No",
    confidence: "0%",
    width: 0,
    height: 0,
    centered: "No",
    numFaces: 0,
    ready: "No",
    liveness: "N/A"
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);

  // Ref wrappers to prevent stale closure bugs in requestAnimationFrame loop
  const countdownRef = useRef<number | null>(null);
  const capturedImageRef = useRef<string | null>(null);
  const activeRef = useRef<boolean>(false);

  const updateCountdown = (val: number | null) => {
    countdownRef.current = val;
    setCountdown(val);
  };
  const updateCapturedImage = (val: string | null) => {
    capturedImageRef.current = val;
    setCapturedImage(val);
  };
  const updateActive = (val: boolean) => {
    activeRef.current = val;
    setActive(val);
  };

  // Stability Tracking
  const lastCenter = useRef<{ x: number; y: number } | null>(null);
  const stableStart = useRef<number | null>(null);
  const countdownTimeRef = useRef<number | null>(null);
  const isVerifyingRef = useRef(false);

  // Telemetry Change Tracking Ref
  const telemetryState = useRef({
    isCountingDown: false,
    countdownValue: null as number | null,
    stableSince: null as number | null,
    faceMovement: 0,
    faceDetected: false,
    faceCentered: false,
    faceSizeValid: false,
    livenessVerified: true,
    captureReady: false,
  });

  // Helper to trace and log biometrics state changes
  const logTelemetryChanges = (current: typeof telemetryState.current) => {
    const prev = telemetryState.current;
    const changes: string[] = [];

    if (current.isCountingDown !== prev.isCountingDown) changes.push(`isCountingDown: ${current.isCountingDown}`);
    if (current.countdownValue !== prev.countdownValue) changes.push(`countdownValue: ${current.countdownValue}`);
    if (current.stableSince !== prev.stableSince) changes.push(`stableSince: ${current.stableSince}`);
    if (Math.abs(current.faceMovement - prev.faceMovement) > 5) changes.push(`faceMovement: ${current.faceMovement}px`);
    if (current.faceDetected !== prev.faceDetected) changes.push(`faceDetected: ${current.faceDetected}`);
    if (current.faceCentered !== prev.faceCentered) changes.push(`faceCentered: ${current.faceCentered}`);
    if (current.faceSizeValid !== prev.faceSizeValid) changes.push(`faceSizeValid: ${current.faceSizeValid}`);
    if (current.livenessVerified !== prev.livenessVerified) changes.push(`livenessVerified: ${current.livenessVerified}`);
    if (current.captureReady !== prev.captureReady) changes.push(`captureReady: ${current.captureReady}`);

    if (changes.length > 0) {
      console.log(`[Telemetry Update] ${changes.join(" | ")}`);
      telemetryState.current = current;
    }
  };

  // 1. Fetch current registration status
  const checkStatus = async () => {
    try {
      const res = await fetch(`${BASE}/employees/${employeeId}/face-embedding`);
      if (res.ok) {
        const data = await res.json();
        setRegistered(data.registered);
      }
    } catch (e) {
      console.error("Error checking face embedding status", e);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [employeeId]);

  // 2. Load face-api models
  const loadModels = async () => {
    if (modelsLoaded) return;
    setLoadingStatus("Loading face recognition models...");
    setError("");
    try {
      const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      console.log("Model loaded successfully");
      setLoadingStatus("");
    } catch (err: any) {
      console.error(err);
      const msg = err.message ?? "Network issues fetching model weights";
      setError(`Failed to load face recognition models: ${msg}`);
      setLoadingStatus("");
      throw err;
    }
  };

  // 3. Start Camera
  const startCamera = async () => {
    try {
      await loadModels();
    } catch (e) {
      return; // Stop if models fail
    }

    setError("");
    setFeedback("Camera Started");
    updateActive(true);
    setFaceDetected(false);
    updateCountdown(null);
    updateCapturedImage(null);
    capturedDescriptorsRef.current = [];
    latestDescriptorRef.current = null;
    isVerifyingRef.current = false;
    stableStart.current = null;
    lastCenter.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      console.log("Camera started successfully");
      startDetectionLoop();
    } catch (err: any) {
      console.error(err);
      setError("Could not access webcam. Please check camera permissions.");
      updateActive(false);
    }
  };

  // 4. Stop Camera
  const stopCamera = () => {
    updateActive(false);
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
    latestDescriptorRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const latestDescriptorRef = useRef<Float32Array | null>(null);
  const capturedDescriptorsRef = useRef<Float32Array[]>([]);

  // 5. Continuous Loop using requestAnimationFrame
  const startDetectionLoop = () => {
    const loop = async () => {
      if (!activeRef.current || !streamRef.current || !videoRef.current || !canvasRef.current) {
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.paused || video.ended || video.readyState < 2) {
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      // Sync canvas dimensions
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

      // Draw Guide Box
      const guideWidth = 240;
      const guideHeight = 240;
      const guideX = (canvas.width - guideWidth) / 2;
      const guideY = (canvas.height - guideHeight) / 2;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      drawRoundedRect(ctx, guideX, guideY, guideWidth, guideHeight, 20);
      ctx.setLineDash([]); // reset

      let isCountdownActive = false;

      try {
        // Run TinyFaceDetector first
        let detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        // Fallback to SsdMobilenet
        if (!detection) {
          detection = await faceapi
            .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        }

        if (!detection) {
          setFaceDetected(false);
          latestDescriptorRef.current = null;
          setFeedback("Searching for Face...");
          setDebugData(prev => ({
            ...prev,
            detected: "No",
            confidence: "0%",
            width: 0,
            height: 0,
            centered: "No",
            ready: "No",
            numFaces: 0
          }));

          logTelemetryChanges({
            isCountingDown: false,
            countdownValue: null,
            stableSince: null,
            faceMovement: 0,
            faceDetected: false,
            faceCentered: false,
            faceSizeValid: false,
            livenessVerified: true,
            captureReady: false,
          });

          // Reset stability tracking
          stableStart.current = null;
          lastCenter.current = null;
          updateCountdown(null);

          requestRef.current = requestAnimationFrame(loop);
          return;
        }

        setFaceDetected(true);
        latestDescriptorRef.current = detection.descriptor;

        const box = detection.detection.box;
        const score = detection.detection.score;
        const confPct = Math.round(score * 100);

        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        // Check alignment: within 60px of the center of canvas
        const canvasCenterX = canvas.width / 2;
        const canvasCenterY = canvas.height / 2;
        const isCentered = Math.abs(centerX - canvasCenterX) < 60 && Math.abs(centerY - canvasCenterY) < 60;

        // Size rules
        const isSizeOk = box.width >= 120 && box.width <= 280;

        let statusMsg = "Face Detected";
        let isReady = false;
        let boxColor = "rgba(234, 179, 8, 0.8)"; // yellow/orange

        if (!isCentered) {
          statusMsg = "Center Your Face";
        } else if (box.width < 120) {
          statusMsg = "Move Closer";
        } else if (box.width > 280) {
          statusMsg = "Move Back";
        } else {
          statusMsg = "Hold Still";
          isReady = true;
          boxColor = "rgba(34, 197, 94, 0.8)"; // green
        }

        setFeedback(statusMsg);

        // Draw active bounding box on canvas
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 12);
        drawCornerBrackets(ctx, box.x, box.y, box.width, box.height, boxColor);

        // Update debug variables
        setDebugData({
          detected: "Yes",
          confidence: `${confPct}%`,
          width: Math.round(box.width),
          height: Math.round(box.height),
          centered: isCentered ? "Yes" : "No",
          numFaces: 1,
          ready: isReady ? "Yes" : "No",
          liveness: "N/A"
        });

        let currentShift = 0;
        if (lastCenter.current) {
          currentShift = Math.hypot(centerX - lastCenter.current.x, centerY - lastCenter.current.y);
        }

        // Trigger or continue stability countdown
        if (isReady && !capturedImageRef.current && !isVerifyingRef.current) {
          if (lastCenter.current) {
            if (currentShift < 15) {
              if (stableStart.current === null) {
                stableStart.current = Date.now();
              } else if (countdownRef.current === null && Date.now() - stableStart.current >= 1000) {
                // Stable for 1 second! Start countdown
                console.log("Countdown started");
                updateCountdown(3);
                countdownTimeRef.current = Date.now();
                stableStart.current = null;
              }
            } else {
              stableStart.current = Date.now(); // reset timer
            }
          }
          lastCenter.current = { x: centerX, y: centerY };
        } else if (!isReady) {
          stableStart.current = null;
          updateCountdown(null);
        }

        // Manage countdown ticking
        if (countdownRef.current !== null) {
          isCountdownActive = true;
          const diff = Date.now() - (countdownTimeRef.current || 0);
          if (diff >= 1000) {
            const nextCount = countdownRef.current - 1;
            if (nextCount > 0) {
              updateCountdown(nextCount);
              countdownTimeRef.current = Date.now();
            } else {
              updateCountdown(null);
              isVerifyingRef.current = true;
              const finalDescriptor = detection.descriptor;
              triggerCapture(video, finalDescriptor);
            }
          }
        }

        // Log Telemetry Changes
        logTelemetryChanges({
          isCountingDown: countdownRef.current !== null,
          countdownValue: countdownRef.current,
          stableSince: stableStart.current,
          faceMovement: Math.round(currentShift),
          faceDetected: true,
          faceCentered: isCentered,
          faceSizeValid: isSizeOk,
          livenessVerified: true,
          captureReady: isReady,
        });

      } catch (err: any) {
        console.error("Error in face loop:", err);
        setFeedback("Camera detection issue: " + (err.message ?? "unknown"));
      }

      // Loop only if active
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
  };

  // 6. Capture Image frame, display, generate embedding, and clean up
  const triggerCapture = (video: HTMLVideoElement, descriptor: Float32Array) => {
    console.log("Image captured");
    setFeedback("Capturing...");
    
    // Extract frame
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");
    if (tempCtx) {
      tempCtx.drawImage(video, 0, 0);
      updateCapturedImage(tempCanvas.toDataURL("image/jpeg"));
    }

    // Stop webcam stream immediately
    stopCamera();

    setTimeout(() => {
      // Clear image from memory completely
      updateCapturedImage(null);
      console.log("Embedding generated");
      saveEmbedding(descriptor);
    }, 1000);
  };

  // 7. Save to backend database
  const saveEmbedding = async (descriptor: Float32Array) => {
    setLoadingStatus("Saving face embedding securely...");
    try {
      const res = await fetch(`${BASE}/employees/${employeeId}/face-embedding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embedding: Array.from(descriptor),
        }),
      });

      if (res.ok) {
        setRegistered(true);
        console.log("Embedding stored in Supabase");
        console.log("Registration completed");
        setFeedback("Face Registered Successfully");
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to save face embedding.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error. Could not register face biometrics.");
    } finally {
      setLoadingStatus("");
      isVerifyingRef.current = false;
    }
  };

  return (
    <div className="space-y-4">
      {/* Registration Status Indicator */}
      <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-lg">
        {registered ? (
          <>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Face Authentication Active</p>
              <p className="text-xs text-muted-foreground">This employee can log attendance using face recognition.</p>
            </div>
            <Button variant="outline" size="sm" onClick={startCamera} disabled={active || !!loadingStatus}>
              Re-register Face
            </Button>
          </>
        ) : (
          <>
            <ScanFace className="w-8 h-8 text-yellow-600 animate-pulse" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Face Authentication Not Set</p>
              <p className="text-xs text-muted-foreground">Register face biometrics to enable attendance kiosk login.</p>
            </div>
            <Button size="sm" onClick={startCamera} disabled={active || !!loadingStatus}>
              Register Face
            </Button>
          </>
        )}
      </div>

      {/* Loading & Errors */}
      {loadingStatus && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/20 rounded-md">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>{loadingStatus}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Camera / Calibration View */}
      {active && (
        <div className="relative border rounded-lg bg-black overflow-hidden max-w-md mx-auto aspect-video flex flex-col justify-between">
          <div className="relative w-full h-full aspect-video">
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

            {/* Visual feedback status overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/70 text-white text-xs text-center font-medium">
              {feedback}
            </div>

            {/* Countdown Display overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="text-white text-7xl font-bold font-mono animate-ping">
                  {countdown}
                </span>
              </div>
            )}

            {/* Captured frame preview overlay */}
            {capturedImage && (
              <div className="absolute inset-0 bg-black">
                <img src={capturedImage} className="w-full h-full object-cover scale-x-[-1]" alt="Captured Frame" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <span className="text-white text-sm font-semibold tracking-wider animate-pulse flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    GENERATING EMBEDDING...
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 bg-muted border-t flex justify-between items-center">
            <Button variant="outline" size="sm" onClick={stopCamera}>
              Cancel
            </Button>
            <div className="text-xs text-muted-foreground font-semibold px-2 py-1 rounded bg-muted-foreground/15">
              AUTO-CAPTURE MODE
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Debug Panel */}
      {active && (
        <div className="max-w-md mx-auto border border-border/80 rounded-lg p-3.5 bg-zinc-950 text-zinc-300 font-mono text-[11px] leading-relaxed shadow-sm">
          <p className="text-zinc-500 font-semibold mb-2 text-xs border-b border-zinc-800 pb-1 uppercase tracking-wider">🛠️ Real-time Biometrics Debug Panel</p>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
            <div className="flex justify-between">
              <span>Face detected:</span>
              <span className={debugData.detected === "Yes" ? "text-green-400" : "text-amber-500"}>{debugData.detected}</span>
            </div>
            <div className="flex justify-between">
              <span>Confidence:</span>
              <span className="text-zinc-100">{debugData.confidence}</span>
            </div>
            <div className="flex justify-between">
              <span>Face width:</span>
              <span className="text-zinc-100">{debugData.width} px</span>
            </div>
            <div className="flex justify-between">
              <span>Face height:</span>
              <span className="text-zinc-100">{debugData.height} px</span>
            </div>
            <div className="flex justify-between">
              <span>Face centered:</span>
              <span className={debugData.centered === "Yes" ? "text-green-400" : "text-amber-500"}>{debugData.centered}</span>
            </div>
            <div className="flex justify-between">
              <span>Number of faces:</span>
              <span className="text-zinc-100">{debugData.numFaces}</span>
            </div>
            <div className="flex justify-between">
              <span>Capture ready:</span>
              <span className={debugData.ready === "Yes" ? "text-green-400 font-bold" : "text-amber-500"}>{debugData.ready}</span>
            </div>
            <div className="flex justify-between">
              <span>Liveness status:</span>
              <span className="text-zinc-400">{debugData.liveness}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
