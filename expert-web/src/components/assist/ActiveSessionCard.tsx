"use client";

import {
  AnnotationToolbar,
  type AnnotTool,
} from "@/components/assist/AnnotationToolbar";
import { ModelPanel } from "@/components/assist/ModelPanel";
import type { CatalogModel, ModelTransform } from "@/lib/models";
import {
  useExpertDeviceStatus,
  type ExpertBatteryChip,
  type ExpertNetworkChip,
} from "@/hooks/useExpertDeviceStatus";
import { formatPublicId } from "@/lib/publicId";

export type CustomerCardInfo = {
  displayName: string | null;
  email: string;
  publicId: string | null;
  avatarUrl?: string | null;
};

type ActiveSessionCardProps = {
  customer: CustomerCardInfo | null;
  statusLine: string;
  statusIsError?: boolean;
  statusHint?: string | null;
  hasVideo: boolean;
  /** waiting = not in room yet; joined = in room; offline = left / lost. */
  customerPresence?: "waiting" | "joined" | "offline";
  callNetworkLabel?: string | null;
  tool: AnnotTool;
  onToolChange: (tool: AnnotTool) => void;
  onUndo: () => void;
  onClear: () => void;
  models: CatalogModel[];
  modelsLoading: boolean;
  modelsError: string | null;
  selectedModelId: string | null;
  modelLoaded: boolean;
  modelTransform: ModelTransform;
  onSelectModel: (model: CatalogModel) => void;
  onModelTransformChange: (next: ModelTransform) => void;
  onRemoveModel: () => void;
  micOn: boolean;
  speakerOn: boolean;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onCopyLink: () => void;
  linkCopied: boolean;
  onEndCall: () => void;
};

/** Live session summary + annotation tools (Assist AR active card). */
export function ActiveSessionCard({
  customer,
  statusLine,
  statusIsError = false,
  statusHint = null,
  hasVideo,
  customerPresence = "waiting",
  callNetworkLabel = null,
  tool,
  onToolChange,
  onUndo,
  onClear,
  models,
  modelsLoading,
  modelsError,
  selectedModelId,
  modelLoaded,
  modelTransform,
  onSelectModel,
  onModelTransformChange,
  onRemoveModel,
  micOn,
  speakerOn,
  onToggleMic,
  onToggleSpeaker,
  onCopyLink,
  linkCopied,
  onEndCall,
}: ActiveSessionCardProps) {
  const { network, battery } = useExpertDeviceStatus();
  const name = customer?.displayName?.trim() || "Customer";
  const email = customer?.email ?? "—";
  const publicId = customer?.publicId
    ? formatPublicId(customer.publicId)
    : "—";

  const videoChip = videoStatusChip(hasVideo, customerPresence, callNetworkLabel);

  return (
    <div className="active-session-card">
      <p className="active-session-label">Active Session</p>

      <div className="px-4 pt-2 pb-3 flex gap-3">
        <div className="h-14 w-11 rounded-md bg-[#111] border border-[var(--line)] overflow-hidden shrink-0 grid place-items-center">
          {customer?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customer.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <PhoneGlyph />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text)] truncate">
            {name}
          </p>
          <p className="text-[11px] text-[var(--muted)] truncate">ID: {publicId}</p>
          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            <p className="text-[11px] text-[var(--muted)] truncate">{email}</p>
            <span className="role-pill role-pill-customer shrink-0">Customer</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
        <StatusChip
          label={`Net ${callNetworkLabel ?? network.label}`}
          tone={chipToneFromNetwork(callNetworkLabel, network)}
        />
        <StatusChip label={`Batt ${battery.label}`} tone={battery.tone} />
        <StatusChip label={videoChip.label} tone={videoChip.tone} />
      </div>

      <div className="px-4 pb-2 text-[11px] leading-relaxed">
        <p className={statusIsError ? "text-[var(--danger)]" : "text-[var(--muted)]"}>
          Call: {statusLine}
        </p>
        {statusHint ? (
          <p className="text-[var(--danger)] mt-1 whitespace-pre-wrap">{statusHint}</p>
        ) : null}
      </div>

      <AnnotationToolbar
        tool={tool}
        onToolChange={onToolChange}
        onUndo={onUndo}
        onClear={onClear}
      />

      <ModelPanel
        models={models}
        modelsLoading={modelsLoading}
        modelsError={modelsError}
        selectedModelId={selectedModelId}
        modelLoaded={modelLoaded}
        toolIsModel={tool === "model"}
        transform={modelTransform}
        onSelectModel={onSelectModel}
        onTransformChange={onModelTransformChange}
        onRemoveModel={onRemoveModel}
      />

      <div className="px-3 pb-3 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost text-xs py-1.5 px-2.5" onClick={onToggleMic}>
          Mic {micOn ? "On" : "Off"}
        </button>
        <button
          type="button"
          className="btn-ghost text-xs py-1.5 px-2.5"
          onClick={onToggleSpeaker}
        >
          Speaker {speakerOn ? "On" : "Off"}
        </button>
        <button type="button" className="btn-ghost text-xs py-1.5 px-2.5" onClick={onCopyLink}>
          {linkCopied ? "Copied" : "Copy link"}
        </button>
        <button type="button" className="btn-danger text-xs py-1.5 px-2.5" onClick={onEndCall}>
          End call
        </button>
      </div>
    </div>
  );
}

function chipToneFromNetwork(
  callLabel: string | null,
  browser: ExpertNetworkChip
): ExpertNetworkChip["tone"] {
  if (!callLabel) return browser.tone;
  const lower = callLabel.toLowerCase();
  if (lower.includes("excellent") || lower.includes("good")) return "good";
  if (lower.includes("poor") || lower.includes("lost")) return "bad";
  if (lower.includes("fair")) return "ok";
  return browser.tone;
}

function videoStatusChip(
  hasVideo: boolean,
  presence: "waiting" | "joined" | "offline",
  callNetworkLabel: string | null
): { label: string; tone: ExpertBatteryChip["tone"] } {
  if (hasVideo) return { label: "Video live", tone: "good" };
  if (presence === "offline" || callNetworkLabel === "Lost") {
    return { label: "Customer offline", tone: "bad" };
  }
  if (presence === "joined") {
    return { label: "Waiting camera", tone: "ok" };
  }
  return { label: "Waiting customer", tone: "unknown" };
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: ExpertBatteryChip["tone"];
}) {
  const toneClass =
    tone === "good"
      ? "chip-good"
      : tone === "ok"
        ? "chip-ok"
        : tone === "bad"
          ? "chip-bad"
          : "chip-unknown";
  return <span className={`status-chip ${toneClass}`}>{label}</span>;
}

function PhoneGlyph() {
  return (
    <svg width="22" height="34" viewBox="0 0 22 34" fill="none" aria-hidden>
      <rect
        x="1"
        y="1"
        width="20"
        height="32"
        rx="4"
        stroke="#9aa3af"
        strokeWidth="1.5"
      />
      <rect x="4" y="5" width="14" height="20" rx="1" fill="#2a2f38" />
      <circle cx="11" cy="29" r="1.4" fill="#9aa3af" />
    </svg>
  );
}
