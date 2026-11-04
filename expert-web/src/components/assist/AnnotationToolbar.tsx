"use client";

export type AnnotTool = "pointer" | "arrow" | "draw" | "model";

type AnnotationToolbarProps = {
  tool: AnnotTool;
  onToolChange: (tool: AnnotTool) => void;
  onUndo: () => void;
  onClear: () => void;
};

/** Icon rail matching the Assist AR active-session card. */
export function AnnotationToolbar({
  tool,
  onToolChange,
  onUndo,
  onClear,
}: AnnotationToolbarProps) {
  const btn = (active: boolean) =>
    `tool-icon-btn ${active ? "tool-icon-btn-active" : ""}`;

  return (
    <div className="tool-rail" role="toolbar" aria-label="Annotation tools">
      <button
        type="button"
        className={btn(tool === "pointer")}
        title="Pointer (P)"
        aria-pressed={tool === "pointer"}
        onClick={() => onToolChange("pointer")}
      >
        <PointerIcon />
      </button>
      <button
        type="button"
        className={btn(tool === "arrow")}
        title="Arrow (A)"
        aria-pressed={tool === "arrow"}
        onClick={() => onToolChange("arrow")}
      >
        <ArrowDownIcon />
      </button>
      <button
        type="button"
        className={btn(tool === "draw")}
        title="Draw (H)"
        aria-pressed={tool === "draw"}
        onClick={() => onToolChange("draw")}
      >
        <PenIcon />
      </button>
      <button
        type="button"
        className={btn(tool === "model")}
        title="3D Model (M)"
        aria-pressed={tool === "model"}
        onClick={() => onToolChange("model")}
      >
        <CubeIcon />
      </button>
      <button
        type="button"
        className="tool-icon-btn"
        title="Undo (⌘/Ctrl+Z)"
        onClick={onUndo}
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        className="tool-icon-btn"
        title="Clear (Delete)"
        onClick={onClear}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function PointerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 3l14 8.5-6.2 1.6L10 21 5 3z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v12m0 0l-5-5m5 5l5-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="20" r="1.6" fill="currentColor" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 7H5v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 11a7 7 0 1 0 2-4.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M10 11v6M14 11v6M8 7l1-2h6l1 2m-1 0v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CubeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 12l8-4.5M12 12v9M12 12L4 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
