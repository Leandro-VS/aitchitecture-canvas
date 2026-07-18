import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";

import { useCanvas } from "./store";

const ASYNC = new Set(["async_message", "async_enqueue", "async_consume"]);
const ROUTE_FIELDS = ["routeX1", "routeX2", "routeY1", "routeY2"] as const;
type RouteField = (typeof ROUTE_FIELDS)[number];

interface MovableEdgeData extends Record<string, unknown> {
  intent?: string;
  ghost?: boolean;
  /** Campos antigos da alça curva — usados como fallback ao abrir diagramas salvos. */
  controlX?: number;
  controlY?: number;
  routeX1?: number;
  routeX2?: number;
  routeY1?: number;
  routeY2?: number;
  labelX?: number;
  labelY?: number;
}

interface RoutePoint {
  x: number;
  y: number;
  xFields?: RouteField[];
  yFields?: RouteField[];
}

const isHorizontal = (position: Position) =>
  position === Position.Left || position === Position.Right;

const samePoint = (a: RoutePoint, b: RoutePoint) =>
  Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

const sameLine = (a: RoutePoint, b: RoutePoint, c: RoutePoint) =>
  (Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01) ||
  (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01);

function compactRoute(raw: RoutePoint[]): RoutePoint[] {
  const deduplicated: RoutePoint[] = [];
  for (const point of raw) {
    const previous = deduplicated.at(-1);
    if (previous && samePoint(previous, point)) continue;
    deduplicated.push(point);
  }

  let route = deduplicated;
  let changed = true;
  while (changed && route.length > 2) {
    changed = false;
    const next = [route[0]];
    for (let index = 1; index < route.length - 1; index += 1) {
      if (sameLine(next.at(-1)!, route[index], route[index + 1])) {
        changed = true;
        continue;
      }
      next.push(route[index]);
    }
    next.push(route.at(-1)!);
    route = next;
  }
  return route;
}

function pathFrom(points: RoutePoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function midpointOf(points: RoutePoint[]): { x: number; y: number } {
  const segments = points.slice(1).map((point, index) => {
    const previous = points[index];
    return {
      from: previous,
      to: point,
      length: Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y),
    };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = total / 2;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const ratio = segment.length === 0 ? 0 : remaining / segment.length;
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * ratio,
        y: segment.from.y + (segment.to.y - segment.from.y) * ratio,
      };
    }
    remaining -= segment.length;
  }
  return points[Math.floor(points.length / 2)];
}

export function IntentEdge(props: EdgeProps) {
  const { screenToFlowPosition } = useReactFlow();
  const updateEdgeData = useCanvas((state) => state.updateEdgeData);
  const data = (props.data ?? {}) as MovableEdgeData;
  const sourceHorizontal = isHorizontal(props.sourcePosition);
  const targetHorizontal = isHorizontal(props.targetPosition);
  const middleX = (props.sourceX + props.targetX) / 2;
  const middleY = (props.sourceY + props.targetY) / 2;
  const hasLegacyRoute = typeof data.controlX === "number" && typeof data.controlY === "number";

  const routeX1 = data.routeX1 ?? (
    hasLegacyRoute && sourceHorizontal && targetHorizontal
      ? (props.sourceX + data.controlX!) / 2
      : data.controlX ?? middleX
  );
  const routeX2 = data.routeX2 ?? (
    hasLegacyRoute && sourceHorizontal && targetHorizontal
      ? (data.controlX! + props.targetX) / 2
      : data.controlX ?? middleX
  );
  const routeY1 = data.routeY1 ?? (
    hasLegacyRoute && !sourceHorizontal && !targetHorizontal
      ? (props.sourceY + data.controlY!) / 2
      : data.controlY ?? middleY
  );
  const routeY2 = data.routeY2 ?? (
    hasLegacyRoute && !sourceHorizontal && !targetHorizontal
      ? (data.controlY! + props.targetY) / 2
      : data.controlY ?? middleY
  );
  const start: RoutePoint = { x: props.sourceX, y: props.sourceY };
  const end: RoutePoint = { x: props.targetX, y: props.targetY };

  let rawRoute: RoutePoint[];
  if (sourceHorizontal && targetHorizontal) {
    rawRoute = [
      start,
      { x: routeX1, y: props.sourceY, xFields: ["routeX1"] },
      { x: routeX1, y: routeY1, xFields: ["routeX1"], yFields: ["routeY1"] },
      { x: routeX2, y: routeY1, xFields: ["routeX2"], yFields: ["routeY1"] },
      { x: routeX2, y: props.targetY, xFields: ["routeX2"] },
      end,
    ];
  } else if (!sourceHorizontal && !targetHorizontal) {
    rawRoute = [
      start,
      { x: props.sourceX, y: routeY1, yFields: ["routeY1"] },
      { x: routeX1, y: routeY1, xFields: ["routeX1"], yFields: ["routeY1"] },
      { x: routeX1, y: routeY2, xFields: ["routeX1"], yFields: ["routeY2"] },
      { x: props.targetX, y: routeY2, yFields: ["routeY2"] },
      end,
    ];
  } else if (sourceHorizontal) {
    rawRoute = [
      start,
      { x: routeX1, y: props.sourceY, xFields: ["routeX1"] },
      { x: routeX1, y: routeY1, xFields: ["routeX1"], yFields: ["routeY1"] },
      { x: props.targetX, y: routeY1, yFields: ["routeY1"] },
      end,
    ];
  } else {
    rawRoute = [
      start,
      { x: props.sourceX, y: routeY1, yFields: ["routeY1"] },
      { x: routeX1, y: routeY1, xFields: ["routeX1"], yFields: ["routeY1"] },
      { x: routeX1, y: props.targetY, xFields: ["routeX1"] },
      end,
    ];
  }

  const route = compactRoute(rawRoute);
  const path = pathFrom(route);
  const automaticLabel = midpointOf(route);
  const labelX = data.labelX ?? automaticLabel.x;
  const labelY = data.labelY ?? automaticLabel.y;
  const intent = data.intent ?? "request";
  const isGhost = Boolean(data.ghost);
  const isAnchor = intent === "annotation";
  const isDeadLetter = intent === "dead_letter";
  const dashed = isGhost || isAnchor || isDeadLetter || ASYNC.has(intent);

  const resetRoute = () =>
    updateEdgeData(
      props.id,
      Object.fromEntries(
        [...ROUTE_FIELDS, "controlX", "controlY"].map((field) => [field, undefined]),
      ),
    );

  const startRouteDrag = (point: RoutePoint) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const move = (pointer: PointerEvent) => {
      const position = screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY });
      const fields: Record<string, number> = {};
      for (const field of point.xFields ?? []) fields[field] = position.x;
      for (const field of point.yFields ?? []) fields[field] = position.y;
      updateEdgeData(props.id, fields);
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };

  const startDetour = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const move = (pointer: PointerEvent) => {
      const position = screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY });
      if (sourceHorizontal && targetHorizontal) {
        updateEdgeData(props.id, {
          routeX1: props.sourceX + (props.targetX - props.sourceX) / 3,
          routeX2: props.sourceX + ((props.targetX - props.sourceX) * 2) / 3,
          routeY1: position.y,
        });
      } else if (!sourceHorizontal && !targetHorizontal) {
        updateEdgeData(props.id, {
          routeY1: props.sourceY + (props.targetY - props.sourceY) / 3,
          routeY2: props.sourceY + ((props.targetY - props.sourceY) * 2) / 3,
          routeX1: position.x,
        });
      } else {
        updateEdgeData(props.id, { routeX1: position.x, routeY1: position.y });
      }
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };

  const startLabelDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const move = (pointer: PointerEvent) => {
      const position = screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY });
      updateEdgeData(props.id, { labelX: position.x, labelY: position.y });
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };

  const bends = route.slice(1, -1);
  const straightHandle = {
    x: automaticLabel.x + (sourceHorizontal ? 0 : 28),
    y: automaticLabel.y + (sourceHorizontal ? 28 : 0),
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
      {props.selected && !isAnchor && !isGhost && bends.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}-${index}`}
          cx={point.x}
          cy={point.y}
          r={5}
          fill="#111827"
          stroke="#E8622C"
          strokeWidth={2}
          style={{ cursor: "move", pointerEvents: "all" }}
          onPointerDown={startRouteDrag(point)}
          onDoubleClick={resetRoute}
        >
          <title>Arraste a quebra; duplo clique restaura o traçado automático</title>
        </circle>
      ))}
      {props.selected && !isAnchor && !isGhost && bends.length === 0 && (
        <circle
          cx={straightHandle.x}
          cy={straightHandle.y}
          r={5}
          fill="#111827"
          stroke="#E8622C"
          strokeWidth={2}
          style={{ cursor: "move", pointerEvents: "all" }}
          onPointerDown={startDetour}
          onDoubleClick={resetRoute}
        >
          <title>Arraste para criar um desvio ortogonal</title>
        </circle>
      )}
      {!isAnchor && (
        <EdgeLabelRenderer>
          <span
            className="nodrag nopan absolute cursor-move rounded bg-panel px-1 py-0.5 font-mono
                       text-[9px] uppercase tracking-wide text-ink/50"
            title="arraste o texto; duplo clique restaura a posição"
            onPointerDown={startLabelDrag}
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
