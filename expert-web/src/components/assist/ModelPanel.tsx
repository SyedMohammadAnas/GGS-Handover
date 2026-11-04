"use client";

import type { CatalogModel, ModelTransform } from "@/lib/models";
import { formatModelSize } from "@/lib/models";

type ModelPanelProps = {
  models: CatalogModel[];
  modelsLoading: boolean;
  modelsError: string | null;
  selectedModelId: string | null;
  modelLoaded: boolean;
  toolIsModel: boolean;
  transform: ModelTransform;
  onSelectModel: (model: CatalogModel) => void;
  onTransformChange: (next: ModelTransform) => void;
  onRemoveModel: () => void;
};

/** Sidebar panel — pick a USDZ model, adjust rotation/scale, remove from customer AR. */
export function ModelPanel({
  models,
  modelsLoading,
  modelsError,
  selectedModelId,
  modelLoaded,
  toolIsModel,
  transform,
  onSelectModel,
  onTransformChange,
  onRemoveModel,
}: ModelPanelProps) {
  return (
    <div className="model-panel">
      <div className="px-4 pt-1 pb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-[var(--text)]">3D Models</p>
        {toolIsModel ? (
          <span className="text-[10px] font-semibold text-[var(--brand)] uppercase tracking-wide">
            Tap video to place
          </span>
        ) : null}
      </div>

      <div className="px-3 pb-2">
        {modelsLoading ? (
          <p className="text-[11px] text-[var(--muted)] px-1 py-2">Loading models…</p>
        ) : modelsError ? (
          <p className="text-[11px] text-[var(--danger)] px-1 py-2 whitespace-pre-wrap">
            {modelsError}
          </p>
        ) : models.length === 0 ? (
          <p className="text-[11px] text-[var(--muted)] px-1 py-2">No models on server</p>
        ) : (
          <div className="model-list" role="listbox" aria-label="3D models">
            {models.map((model) => {
              const active = selectedModelId === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`model-card ${active ? "model-card-active" : ""}`}
                  onClick={() => onSelectModel(model)}
                >
                  <span className="model-card-name">{model.name}</span>
                  <span className="model-card-meta">
                    {formatModelSize(model.fileSizeBytes)}
                    {active && modelLoaded ? " · loaded" : active ? " · loading…" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 pb-2 space-y-2">
        <SliderRow
          label="Rotate X"
          value={transform.rotationX}
          min={-180}
          max={180}
          step={1}
          suffix="°"
          onChange={(rotationX) =>
            onTransformChange({ ...transform, rotationX })
          }
        />
        <SliderRow
          label="Rotate Y"
          value={transform.rotationY}
          min={-180}
          max={180}
          step={1}
          suffix="°"
          onChange={(rotationY) =>
            onTransformChange({ ...transform, rotationY })
          }
        />
        <SliderRow
          label="Scale"
          value={transform.scale}
          min={0.02}
          max={0.5}
          step={0.01}
          decimals={2}
          onChange={(scale) => onTransformChange({ ...transform, scale })}
        />
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          className="btn-ghost w-full text-xs py-1.5"
          onClick={onRemoveModel}
          disabled={!selectedModelId}
        >
          Remove model from scene
        </button>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  decimals = 0,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  decimals?: number;
  onChange: (value: number) => void;
}) {
  const display =
    decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));

  return (
    <label className="model-slider-row">
      <span className="model-slider-label">
        {label}{" "}
        <span className="model-slider-value">
          {display}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        className="model-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
