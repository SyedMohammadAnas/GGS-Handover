"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionQuality,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
} from "livekit-client";

import { ActiveSessionCard } from "@/components/assist/ActiveSessionCard";
import type { AnnotTool } from "@/components/assist/AnnotationToolbar";
import { AssistShell } from "@/components/assist/AssistShell";
import { AssistToast } from "@/components/assist/AssistToast";
import { ExpertFooter } from "@/components/assist/ExpertFooter";
import { HomeJoinForm } from "@/components/HomeJoinForm";
import {
  callInfo,
  callWarn,
  explainCallFailure,
  formatCallLogLine,
  type CallLogEntry,
} from "@/lib/callErrors";
import { createClient } from "@/lib/supabase/client";
import { normalizeLiveKitClientUrl } from "@/lib/livekitUrl";
import {
  DEFAULT_MODEL_SCALE,
  type CatalogModel,
  type ModelTransform,
} from "@/lib/models";
import { playCustomerVideoChime } from "@/lib/softChime";
import { rememberRecentConnection } from "@/lib/recentConnections";

const ANNOTATION_TOPIC = "annotations";
const EXPERT_ROLE = "expert";

type CustomerCard = {
  id: string;
  email: string;
  displayName: string | null;
  publicId: string | null;
  avatarUrl: string | null;
};

type JoinPayload = {
  sessionId: string;
  roomName: string;
  joinCode: string;
  status: string;
  token: string;
  livekitUrl: string;
  customer?: CustomerCard | null;
};

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/** Expert call room — Assist AR shell + customer POV + annotation TX. */
export default function SessionCallPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomRef = useRef<Room | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState("Connecting…");
  const [statusIsError, setStatusIsError] = useState(false);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [joinMeta, setJoinMeta] = useState<JoinPayload | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  /** Waiting for customer in room vs joined vs dropped offline. */
  const [customerPresence, setCustomerPresence] = useState<
    "waiting" | "joined" | "offline"
  >("waiting");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [callNetworkLabel, setCallNetworkLabel] = useState<string | null>(null);
  const [tool, setTool] = useState<AnnotTool>("draw");
  const [micOn, setMicOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [expertName, setExpertName] = useState("Expert");
  const [expertEmail, setExpertEmail] = useState("");
  const [expertAvatar, setExpertAvatar] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<CatalogModel | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelTransform, setModelTransform] = useState<ModelTransform>({
    rotationX: 0,
    rotationY: 0,
    scale: DEFAULT_MODEL_SCALE,
  });

  const drawingRef = useRef(false);
  const strokeIdRef = useRef<string | null>(null);
  const strokePointCountRef = useRef(0);
  const arrowNumberRef = useRef(0);
  const lastPointerRef = useRef(0);
  const toolRef = useRef<AnnotTool>("draw");
  const didChimeRef = useRef(false);
  /** Prevents double leave when both session_end and participant disconnect fire. */
  const endingRef = useRef(false);
  const selectedModelRef = useRef<CatalogModel | null>(null);
  const modelLoadedRef = useRef(false);
  const modelTransformRef = useRef<ModelTransform>({
    rotationX: 0,
    rotationY: 0,
    scale: DEFAULT_MODEL_SCALE,
  });
  const modelPointerRef = useRef<{
    x: number;
    y: number;
    norm: { x: number; y: number };
    dragged?: boolean;
  } | null>(null);
  const loadedModelIdRef = useRef<string | null>(null);
  const transformThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Stable hook for LiveKit listeners to trigger a graceful leave. */
  const leaveCallRef = useRef<
    (opts?: { notifyPeer?: boolean; reason?: string }) => Promise<void>
  >(async () => {});
  const placeModelRef = useRef<
    (norm: { x: number; y: number }) => Promise<void>
  >(async () => {});
  const scheduleTransformPublishRef = useRef<() => void>(() => {});

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  useEffect(() => {
    modelLoadedRef.current = modelLoaded;
  }, [modelLoaded]);

  useEffect(() => {
    modelTransformRef.current = modelTransform;
  }, [modelTransform]);

  // Load expert identity for the sidebar footer.
  useEffect(() => {
    let cancelled = false;
    async function loadExpert() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, display_name, role, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile || cancelled) return;
      setExpertEmail(profile.email ?? user.email ?? "");
      setExpertName(
        profile.display_name?.trim() || profile.email || user.email || "Expert"
      );
      setExpertAvatar(profile.avatar_url ?? null);
      setIsAdmin(profile.role === "admin");
    }
    void loadExpert();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyLog = useCallback((entry: CallLogEntry) => {
    setStatus(`[${entry.at}] ${entry.phase}: ${entry.message}`);
    setStatusIsError(entry.level === "error");
    setStatusHint(entry.hint ?? null);
    const line = formatCallLogLine(entry);
    if (entry.level === "error") {
      console.error("[ExpertCall]", line);
    } else if (entry.level === "warn") {
      console.warn("[ExpertCall]", line);
    } else {
      console.log("[ExpertCall]", line);
    }
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const fitStageToVideo = useCallback(() => {
    // Stage is full viewport height; only resize the hit canvas.
    resizeCanvas();
  }, [resizeCanvas]);

  const normFromEvent = useCallback(
    (event: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      const video = videoRef.current;
      if (!video) return null;
      const rect = video.getBoundingClientRect();
      const src =
        "touches" in event && event.touches.length
          ? event.touches[0]
          : (event as MouseEvent);
      const vw = video.videoWidth || rect.width;
      const vh = video.videoHeight || rect.height;
      if (!vw || !vh) return null;

      const scale = Math.min(rect.width / vw, rect.height / vh);
      const contentW = vw * scale;
      const contentH = vh * scale;
      const ox = (rect.width - contentW) / 2;
      const oy = (rect.height - contentH) / 2;

      const x = src.clientX - rect.left - ox;
      const y = src.clientY - rect.top - oy;
      if (x < 0 || y < 0 || x > contentW || y > contentH) return null;

      return { x: clamp01(x / contentW), y: clamp01(y / contentH) };
    },
    []
  );

  const publishAnnotation = useCallback(
    async (payload: Record<string, unknown>, reliable = true) => {
      const room = roomRef.current;
      if (!room?.localParticipant) {
        console.warn("[ExpertCall] publish skipped — not connected");
        return;
      }
      const body: Record<string, unknown> = { ...payload, role: EXPERT_ROLE };
      const bytes = new TextEncoder().encode(JSON.stringify(body));
      try {
        await room.localParticipant.publishData(bytes, {
          reliable,
          topic: ANNOTATION_TOPIC,
        });
        console.log("[ExpertCall] TX", body["type"], body);
      } catch (err) {
        applyLog(explainCallFailure(err, "Annotation TX"));
      }
    },
    [applyLog]
  );

  const placeArrow = useCallback(
    async (norm: { x: number; y: number }) => {
      arrowNumberRef.current += 1;
      await publishAnnotation(
        {
          type: "arrow",
          x: norm.x,
          y: norm.y,
          number: arrowNumberRef.current,
        },
        true
      );
    },
    [publishAnnotation]
  );

  const endStroke = useCallback(async () => {
    if (toolRef.current === "model" && modelPointerRef.current) {
      const ptr = modelPointerRef.current;
      modelPointerRef.current = null;
      if (!ptr.dragged) {
        await placeModelRef.current(ptr.norm);
      }
      return;
    }

    if (!drawingRef.current || !strokeIdRef.current) {
      drawingRef.current = false;
      return;
    }
    const id = strokeIdRef.current;
    const count = strokePointCountRef.current;
    drawingRef.current = false;
    strokeIdRef.current = null;
    strokePointCountRef.current = 0;

    if (count < 2) {
      await publishAnnotation({ type: "stroke_cancel", id }, true);
    } else {
      await publishAnnotation({ type: "stroke_end", id }, true);
    }
  }, [publishAnnotation]);

  const startStroke = useCallback(
    async (event: MouseEvent | TouchEvent) => {
      const currentTool = toolRef.current;
      if (currentTool === "pointer") return;

      const norm = normFromEvent(event);
      if (!norm) return;

      if (currentTool === "arrow") {
        await placeArrow(norm);
        event.preventDefault();
        return;
      }

      if (currentTool === "model") {
        const src =
          "touches" in event && event.touches.length
            ? event.touches[0]
            : (event as MouseEvent);
        modelPointerRef.current = {
          x: src.clientX,
          y: src.clientY,
          norm,
        };
        event.preventDefault();
        return;
      }

      if (currentTool !== "draw") return;
      drawingRef.current = true;
      strokeIdRef.current = crypto.randomUUID();
      strokePointCountRef.current = 1;
      await publishAnnotation(
        {
          type: "stroke_begin",
          id: strokeIdRef.current,
          x: norm.x,
          y: norm.y,
        },
        true
      );
      event.preventDefault();
    },
    [normFromEvent, placeArrow, publishAnnotation]
  );

  const moveStroke = useCallback(
    async (event: MouseEvent | TouchEvent) => {
      const currentTool = toolRef.current;

      if (currentTool === "pointer") {
        const norm = normFromEvent(event);
        if (!norm) return;
        const now = performance.now();
        if (now - lastPointerRef.current < 50) return;
        lastPointerRef.current = now;
        await publishAnnotation(
          { type: "pointer", x: norm.x, y: norm.y },
          false
        );
        event.preventDefault();
        return;
      }

      if (currentTool === "model" && modelPointerRef.current) {
        const src =
          "touches" in event && event.touches.length
            ? event.touches[0]
            : (event as MouseEvent);
        const deltaX = src.clientX - modelPointerRef.current.x;
        if (Math.abs(deltaX) >= 6) {
          modelPointerRef.current.dragged = true;
          modelPointerRef.current.x = src.clientX;
          const nextY = Math.max(
            -180,
            Math.min(180, modelTransformRef.current.rotationY + deltaX * 0.4)
          );
          const next = { ...modelTransformRef.current, rotationY: nextY };
          setModelTransform(next);
          modelTransformRef.current = next;
          scheduleTransformPublishRef.current();
        }
        event.preventDefault();
        return;
      }

      if (!drawingRef.current || currentTool !== "draw" || !strokeIdRef.current) {
        return;
      }
      const norm = normFromEvent(event);
      if (!norm) return;
      strokePointCountRef.current += 1;
      await publishAnnotation(
        {
          type: "stroke_point",
          id: strokeIdRef.current,
          x: norm.x,
          y: norm.y,
        },
        false
      );
      event.preventDefault();
    },
    [normFromEvent, publishAnnotation]
  );

  const undoRemote = useCallback(async () => {
    await publishAnnotation({ type: "undo" }, true);
    applyLog(callInfo("Annotate", "Undo sent to customer AR"));
  }, [applyLog, publishAnnotation]);

  const clearRemote = useCallback(async () => {
    if (!window.confirm("Clear all marks on the customer view?")) return;
    arrowNumberRef.current = 0;
    await publishAnnotation({ type: "clear" }, true);
    applyLog(callInfo("Annotate", "Clear sent to customer AR"));
  }, [applyLog, publishAnnotation]);

  const publishTransform = useCallback(async () => {
    const t = modelTransformRef.current;
    await publishAnnotation(
      {
        type: "transform",
        rotationX: t.rotationX,
        rotationY: t.rotationY,
        scale: t.scale,
      },
      false
    );
  }, [publishAnnotation]);

  const scheduleTransformPublish = useCallback(() => {
    if (transformThrottleRef.current) return;
    transformThrottleRef.current = setTimeout(() => {
      transformThrottleRef.current = null;
      void publishTransform();
    }, 50);
  }, [publishTransform]);

  const loadModelOnCustomer = useCallback(
    async (model: CatalogModel) => {
      setSelectedModel(model);
      setModelLoaded(false);
      modelLoadedRef.current = false;
      loadedModelIdRef.current = null;
      await publishAnnotation(
        {
          type: "load_model",
          modelId: model.id,
          url: model.url,
          name: model.name,
        },
        true
      );
      applyLog(
        callInfo("Model", `Sent load for "${model.name}" — waiting for phone…`)
      );
    },
    [applyLog, publishAnnotation]
  );

  const waitForModelLoaded = useCallback(async (modelId: string, timeoutMs: number) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (loadedModelIdRef.current === modelId && modelLoadedRef.current) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return false;
  }, []);

  const placeModel = useCallback(
    async (norm: { x: number; y: number }) => {
      const model = selectedModelRef.current;
      if (!model) {
        applyLog(callWarn("Model", "Select a model from the sidebar first"));
        return;
      }
      if (loadedModelIdRef.current !== model.id || !modelLoadedRef.current) {
        await loadModelOnCustomer(model);
        const ready = await waitForModelLoaded(model.id, 20000);
        if (!ready) {
          applyLog(
            callWarn(
              "Model",
              `"${model.name}" did not load on the customer phone — check AR logs`
            )
          );
          return;
        }
      }
      await publishAnnotation(
        { type: "place_model", x: norm.x, y: norm.y },
        true
      );
      await publishTransform();
      applyLog(
        callInfo(
          "Model",
          `Placement sent for "${model.name}" at ${norm.x.toFixed(2)}, ${norm.y.toFixed(2)}`
        )
      );
    },
    [applyLog, loadModelOnCustomer, publishAnnotation, publishTransform, waitForModelLoaded]
  );

  const removeModelRemote = useCallback(async () => {
    await publishAnnotation({ type: "remove_model" }, true);
    setModelLoaded(false);
    applyLog(callInfo("Model", "Remove model sent to customer"));
  }, [applyLog, publishAnnotation]);

  const handleModelTransformChange = useCallback(
    (next: ModelTransform) => {
      setModelTransform(next);
      modelTransformRef.current = next;
      scheduleTransformPublish();
    },
    [scheduleTransformPublish]
  );

  const handleSelectModel = useCallback(
    (model: CatalogModel) => {
      setTool("model");
      void loadModelOnCustomer(model);
    },
    [loadModelOnCustomer]
  );

  const applySpeaker = useCallback((on: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    room.remoteParticipants.forEach((participant: RemoteParticipant) => {
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track) {
          if (on) {
            pub.track.attach();
          } else {
            pub.track.detach();
          }
        }
      });
    });
  }, []);

  const connectLiveKit = useCallback(
    async (url: string, token: string) => {
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      applyLog(callInfo("LiveKit", `Dialing ${url}`));
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      const onCustomerVideo = (identity: string) => {
        setHasVideo(true);
        setCustomerPresence("joined");
        fitStageToVideo();
        applyLog(callInfo("Video", `Customer camera live (${identity})`));
        if (!didChimeRef.current) {
          didChimeRef.current = true;
          void playCustomerVideoChime();
        }
      };

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
          onCustomerVideo(participant.identity);
        }
        if (track.kind === Track.Kind.Audio && speakerOn) {
          track.attach();
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
        if (track.kind === Track.Kind.Video) {
          setHasVideo(false);
          applyLog(callWarn("Video", "Customer video stopped"));
        }
      });

      // Customer entered the LiveKit room (before or without camera yet).
      room.on(RoomEvent.ParticipantConnected, (participant) => {
        setCustomerPresence("joined");
        const label =
          participant.name?.trim() ||
          participant.identity.slice(0, 8) ||
          "Customer";
        setToastMessage(`${label} joined the room`);
        applyLog(callInfo("Session", `Customer joined (${participant.identity})`));
        if (!didChimeRef.current) {
          didChimeRef.current = true;
          void playCustomerVideoChime();
        }
      });

      room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        const label =
          reason !== undefined ? DisconnectReason[reason] ?? String(reason) : "unknown";
        applyLog(
          callWarn("LiveKit", `Disconnected (${label})`, "Reconnect or end the call and join again.")
        );
        setHasVideo(false);
        setCustomerPresence("offline");
        setCallNetworkLabel("Lost");
      });

      // Customer hung up / left the room — end session and return home.
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        applyLog(callInfo("Session", `Customer left (${participant.identity})`));
        setHasVideo(false);
        setCustomerPresence("offline");
        setToastMessage("Customer left the room");
        if (room.remoteParticipants.size === 0) {
          void leaveCallRef.current({
            notifyPeer: false,
            reason: "customer_left_room",
          });
        }
      });

      room.on(RoomEvent.Reconnecting, () => {
        applyLog(callWarn("LiveKit", "Reconnecting media…"));
      });

      room.on(RoomEvent.Reconnected, () => {
        applyLog(callInfo("LiveKit", "Reconnected"));
      });

      room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        if (participant && !participant.isLocal) {
          const label =
            quality === ConnectionQuality.Excellent
              ? "Excellent"
              : quality === ConnectionQuality.Good
                ? "Good"
                : quality === ConnectionQuality.Poor
                  ? "Poor"
                  : quality === ConnectionQuality.Lost
                    ? "Lost"
                    : "Unknown";
          setCallNetworkLabel(label);
        }
      });

      room.on(RoomEvent.MediaDevicesError, (error) => {
        applyLog(explainCallFailure(error, "Mic/devices"));
      });

      room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
        if (topic && topic !== ANNOTATION_TOPIC) return;
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload)) as {
            role?: string;
            type?: string;
            reason?: string;
            modelId?: string;
            name?: string;
            ok?: boolean;
            error?: string;
          };
          if (msg.role === EXPERT_ROLE) return;
          console.log("[ExpertCall] RX customer", msg.type, msg);
          if (msg.type === "model_load_status") {
            if (msg.ok) {
              loadedModelIdRef.current = msg.modelId ?? null;
              setModelLoaded(true);
              modelLoadedRef.current = true;
              applyLog(
                callInfo(
                  "Model",
                  `"${msg.name ?? msg.modelId ?? "Model"}" loaded on customer phone`
                )
              );
            } else {
              loadedModelIdRef.current = null;
              setModelLoaded(false);
              modelLoadedRef.current = false;
              applyLog(
                callWarn(
                  "Model",
                  `Load failed on phone: ${msg.error ?? "unknown error"}`
                )
              );
            }
            return;
          }
          if (msg.type === "model_placed" && msg.ok) {
            applyLog(
              callInfo(
                "Model",
                `"${msg.name ?? msg.modelId ?? "Model"}" visible in customer AR`
              )
            );
            return;
          }
          // Instant End Call — leave Assist AR without re-notifying the phone.
          if (msg.type === "session_end") {
            applyLog(
              callInfo(
                "Session",
                `Customer ended call (${msg.reason ?? "session_end"})`
              )
            );
            void leaveCallRef.current({
              notifyPeer: false,
              reason: msg.reason ?? "customer_ended",
            });
          }
        } catch (err) {
          console.warn("[ExpertCall] bad annotation packet", err);
        }
      });

      try {
        await room.connect(url, token);
        await room.startAudio();
        await room.localParticipant.setMicrophoneEnabled(micOn);
      } catch (err) {
        applyLog(explainCallFailure(err, "LiveKit connect"));
        throw err;
      }

      for (const participant of room.remoteParticipants.values()) {
        setCustomerPresence("joined");
        for (const pub of participant.trackPublications.values()) {
          if (pub.track && pub.kind === Track.Kind.Video && videoRef.current) {
            pub.track.attach(videoRef.current);
            onCustomerVideo(participant.identity);
          }
        }
      }

      applyLog(
        callInfo(
          "LiveKit",
          `Connected — ${room.numParticipants} in room (waiting for customer video if empty)`
        )
      );
    },
    [applyLog, fitStageToVideo, micOn, speakerOn]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const urlToken =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("token")
            : null;

        applyLog(callInfo("Session", "Rejoining session…"));
        const rejoinRes = await fetch(`/api/sessions/${sessionId}/rejoin`, {
          method: "POST",
        });
        const rejoinJson = (await rejoinRes.json()) as JoinPayload & {
          error?: string;
        };
        if (!rejoinRes.ok) {
          throw new Error(rejoinJson.error ?? `Rejoin failed (${rejoinRes.status})`);
        }

        const payload: JoinPayload = urlToken
          ? { ...rejoinJson, token: urlToken }
          : rejoinJson;

        if (urlToken) {
          router.replace(`/s/${sessionId}`);
        }

        if (cancelled) return;
        setJoinMeta(payload);

        if (payload.customer?.publicId) {
          rememberRecentConnection({
            publicId: payload.customer.publicId,
            label:
              payload.customer.displayName ||
              payload.customer.email ||
              payload.customer.publicId,
          });
        }

        const livekitUrl = normalizeLiveKitClientUrl(payload.livekitUrl);
        applyLog(callInfo("LiveKit", "Connecting to media…"));
        await connectLiveKit(livekitUrl, payload.token);
      } catch (err) {
        if (!cancelled) {
          applyLog(explainCallFailure(err, "Session bootstrap"));
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      void roomRef.current?.disconnect();
    };
  }, [applyLog, connectLiveKit, router, sessionId]);

  // Catalog is independent of LiveKit — load immediately so the Models panel
  // never stays stuck on "Loading models…" if media connect is slow/retries.
  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const modelsRes = await fetch("/api/models", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        const modelsJson = (await modelsRes.json()) as {
          models?: CatalogModel[];
          error?: string;
        };
        if (!modelsRes.ok) {
          throw new Error(modelsJson.error ?? `Models failed (${modelsRes.status})`);
        }
        if (cancelled) return;
        setModels(modelsJson.models ?? []);
        applyLog(
          callInfo(
            "Model",
            `Loaded ${modelsJson.models?.length ?? 0} model(s) from catalog`
          )
        );
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setModelsError(message);
        applyLog(callWarn("Model", `Catalog unavailable: ${message}`));
      } finally {
        if (!cancelled) {
          setModelsLoading(false);
        }
      }
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [applyLog]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: MouseEvent) => {
      void startStroke(e);
    };
    const onMove = (e: MouseEvent) => {
      void moveStroke(e);
    };
    const onUp = () => {
      void endStroke();
    };
    const onTouchStart = (e: TouchEvent) => {
      void startStroke(e);
    };
    const onTouchMove = (e: TouchEvent) => {
      void moveStroke(e);
    };
    const onTouchEnd = () => {
      void endStroke();
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [endStroke, moveStroke, startStroke]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "a") {
        setTool("arrow");
      } else if (key === "h") {
        setTool("draw");
      } else if (key === "p") {
        setTool("pointer");
      } else if (key === "m") {
        setTool("model");
      } else if ((e.metaKey || e.ctrlKey) && key === "z") {
        e.preventDefault();
        void undoRemote();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        void clearRemote();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearRemote, undoRemote]);

  useEffect(() => {
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  async function toggleMic() {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }

  async function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    applySpeaker(next);
  }

  const endCall = useCallback(
    async (opts?: { notifyPeer?: boolean; reason?: string }) => {
      if (endingRef.current) return;
      endingRef.current = true;
      const notifyPeer = opts?.notifyPeer !== false;
      const reason = opts?.reason ?? "expert_ended";
      applyLog(callInfo("Session", `Ending call (${reason})`));

      // Signal Instant first so the phone leaves before we tear down the room.
      if (notifyPeer) {
        try {
          await publishAnnotation(
            { type: "session_end", reason },
            true
          );
        } catch (err) {
          console.warn("[ExpertCall] session_end publish failed", err);
        }
      }

      try {
        await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
      } catch (err) {
        console.warn("[ExpertCall] end session failed", err);
      }

      try {
        await roomRef.current?.disconnect();
      } catch (err) {
        console.warn("[ExpertCall] disconnect failed", err);
      }
      roomRef.current = null;
      router.push("/");
    },
    [applyLog, publishAnnotation, router, sessionId]
  );

  useEffect(() => {
    leaveCallRef.current = endCall;
  }, [endCall]);

  useEffect(() => {
    placeModelRef.current = placeModel;
  }, [placeModel]);

  useEffect(() => {
    scheduleTransformPublishRef.current = scheduleTransformPublish;
  }, [scheduleTransformPublish]);

  async function copySessionLink() {
    const url = `${window.location.origin}/s/${sessionId}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <AssistShell
      sidebar={
        <>
          <div className="assist-brand">Assist AR</div>

          <section className="assist-section">
            <h2 className="assist-section-title">Provide support using ID</h2>
            <HomeJoinForm />
          </section>

          <ActiveSessionCard
            customer={
              joinMeta?.customer
                ? {
                    displayName: joinMeta.customer.displayName,
                    email: joinMeta.customer.email,
                    publicId: joinMeta.customer.publicId,
                    avatarUrl: joinMeta.customer.avatarUrl,
                  }
                : null
            }
            statusLine={status}
            statusIsError={statusIsError}
            statusHint={statusHint}
            hasVideo={hasVideo}
            customerPresence={customerPresence}
            callNetworkLabel={callNetworkLabel}
            tool={tool}
            onToolChange={setTool}
            onUndo={() => void undoRemote()}
            onClear={() => void clearRemote()}
            models={models}
            modelsLoading={modelsLoading}
            modelsError={modelsError}
            selectedModelId={selectedModel?.id ?? null}
            modelLoaded={modelLoaded}
            modelTransform={modelTransform}
            onSelectModel={handleSelectModel}
            onModelTransformChange={handleModelTransformChange}
            onRemoveModel={() => void removeModelRemote()}
            micOn={micOn}
            speakerOn={speakerOn}
            onToggleMic={() => void toggleMic()}
            onToggleSpeaker={() => void toggleSpeaker()}
            onCopyLink={() => void copySessionLink()}
            linkCopied={linkCopied}
            onEndCall={() => void endCall()}
          />

          <ExpertFooter
            name={expertName}
            email={expertEmail}
            roleLabel={isAdmin ? "Admin" : "Expert"}
            avatarUrl={expertAvatar}
            showAdmin={isAdmin}
          />
        </>
      }
    >
      <div className="flex flex-col items-center justify-center h-full w-full bg-black">
        <div ref={stageRef} className="phone-stage">
          <video
            ref={videoRef}
            className="phone-video"
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="annotate-hit"
            style={{
              cursor:
                tool === "pointer"
                  ? "pointer"
                  : tool === "model"
                    ? "copy"
                    : "crosshair",
            }}
          />
          {!hasVideo ? (
            <div className="phone-empty">
              <div className="max-w-xs space-y-2">
                <p className="font-medium text-white/90">
                  {statusIsError
                    ? "Call error"
                    : customerPresence === "offline" ||
                        callNetworkLabel === "Lost"
                      ? "Customer offline"
                      : customerPresence === "joined"
                        ? "Customer connected"
                        : "Waiting for customer"}
                </p>
                <p className="text-xs text-white/55">
                  {statusIsError
                    ? status
                    : customerPresence === "offline" ||
                        callNetworkLabel === "Lost"
                      ? "They left the room or the connection dropped. Ask them to reopen Instant."
                      : customerPresence === "joined"
                        ? "In the room — waiting for their camera feed…"
                        : "Share your connect / wait for Instant to join this session."}
                </p>
                {statusIsError && statusHint ? (
                  <p className="text-xs text-white/70 whitespace-pre-wrap">
                    {statusHint}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        {joinMeta?.joinCode ? (
          <p className="absolute bottom-3 text-xs text-white/50 font-mono bg-black/60 px-2 py-1 rounded">
            Code {joinMeta.joinCode}
          </p>
        ) : null}
      </div>

      <AssistToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </AssistShell>
  );
}
