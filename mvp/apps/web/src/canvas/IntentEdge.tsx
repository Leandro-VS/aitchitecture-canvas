import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";

const ASYNC = new Set(["async_enqueue", "async_consume"]);

export function IntentEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath(props);
  const intent = (props.data?.intent as string) ?? "request";
  const isGhost = Boolean(props.data?.ghost);
  const isAnchor = intent === "annotation";
  const dashed = isGhost || isAnchor || ASYNC.has(intent);

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        style={{
          stroke: isGhost
            ? "rgba(34,211,238,.7)"
            : isAnchor
              ? "rgba(251,191,36,.5)"
              : props.selected
                ? "#1458E8"
                : "rgba(237,242,253,.35)",
          strokeWidth: props.selected ? 2 : 1.5,
          strokeDasharray: dashed ? "6 4" : undefined,
        }}
      />
      {!isAnchor && (
        <EdgeLabelRenderer>
          <span
            className="nodrag nopan absolute rounded bg-panel px-1 py-0.5 font-mono
                       text-[9px] uppercase tracking-wide text-ink/50"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {intent}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
