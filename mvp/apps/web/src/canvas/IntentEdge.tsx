import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";

import { useCanvas } from "./store";

const ASYNC = new Set(["async_message", "async_enqueue", "async_consume"]);

interface MovableEdgeData extends Record<string, unknown> {
  intent?: string;
  ghost?: boolean;
  controlX?: number;
  controlY?: number;
  labelX?: number;
  labelY?: number;
}

export function IntentEdge(props: EdgeProps) {
  const { screenToFlowPosition } = useReactFlow();
  const updateEdgeData = useCanvas((state) => state.updateEdgeData);
  const data = (props.data ?? {}) as MovableEdgeData;
  const [defaultPath, defaultLabelX, defaultLabelY] = getSmoothStepPath(props);
  const hasControl = typeof data.controlX === "number" && typeof data.controlY === "number";
  const controlX = hasControl ? data.controlX! : (props.sourceX + props.targetX) / 2;
  const controlY = hasControl ? data.controlY! : (props.sourceY + props.targetY) / 2;
  // Antes da primeira edição, a alça fica afastada do label central para que
  // ambos sejam alcançáveis de forma independente.
  const handleX = controlX;
  const handleY = hasControl ? controlY : controlY + 32;
  const path = hasControl
    ? `M ${props.sourceX} ${props.sourceY} Q ${controlX} ${controlY} ${props.targetX} ${props.targetY}`
    : defaultPath;
  const curveLabelX = 0.25 * props.sourceX + 0.5 * controlX + 0.25 * props.targetX;
  const curveLabelY = 0.25 * props.sourceY + 0.5 * controlY + 0.25 * props.targetY;
  const labelX = data.labelX ?? (hasControl ? curveLabelX : defaultLabelX);
  const labelY = data.labelY ?? (hasControl ? curveLabelY : defaultLabelY);
  const intent = data.intent ?? "request";
  const isGhost = Boolean(data.ghost);
  const isAnchor = intent === "annotation";
  const isDeadLetter = intent === "dead_letter";
  const dashed = isGhost || isAnchor || isDeadLetter || ASYNC.has(intent);

  const startDrag = (kind: "control" | "label") => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const move = (pointer: PointerEvent) => {
      const position = screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY });
      updateEdgeData(
        props.id,
        kind === "control"
          ? { controlX: position.x, controlY: position.y }
          : { labelX: position.x, labelY: position.y },
      );
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        style={{
          stroke: isGhost
            ? "rgba(34,211,238,.7)"
            : isDeadLetter
              ? "rgba(248,113,113,.7)"
            : isAnchor
              ? "rgba(251,191,36,.5)"
              : props.selected
                ? "#E8622C"
                : "rgba(237,242,253,.35)",
          strokeWidth: props.selected ? 2 : 1.5,
          strokeDasharray: dashed ? "6 4" : undefined,
        }}
      />
      {props.selected && !isAnchor && !isGhost && (
        <circle
          cx={handleX}
          cy={handleY}
          r={5}
          fill="#111827"
          stroke="#E8622C"
          strokeWidth={2}
          style={{ cursor: "move", pointerEvents: "all" }}
          onPointerDown={startDrag("control")}
          onDoubleClick={() => updateEdgeData(props.id, { controlX: undefined, controlY: undefined })}
        />
      )}
      {!isAnchor && (
        <EdgeLabelRenderer>
          <span
            className="nodrag nopan absolute rounded bg-panel px-1 py-0.5 font-mono
                       cursor-move text-[9px] uppercase tracking-wide text-ink/50"
            title="arraste o texto; duplo clique restaura a posição"
            onPointerDown={startDrag("label")}
            onDoubleClick={() => updateEdgeData(props.id, { labelX: undefined, labelY: undefined })}
            style={{
              pointerEvents: "all",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {intent}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
