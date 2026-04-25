"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  ArrowUpToLine,
  Cloud,
  GitBranch,
  GitMerge,
  Minus,
  Move,
  Plus,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import type { RepositoryState, SavePoint, TimelinePointType } from "@/lib/types";

type GitTreeVisualizerProps = {
  repository: RepositoryState;
  pending?: RepositoryState;
  title?: string;
  compact?: boolean;
  onCheckoutSelect?: (pointId: string) => void;
};

type PositionedPoint = {
  point: SavePoint;
  x: number;
  y: number;
  color: string;
  branchIndex: number;
  isHead: boolean;
  isClickable: boolean;
};

const iconMap = {
  commit: ShieldCheck,
  push: Cloud,
  restore: ArrowUpToLine,
  branch: GitBranch,
  merge: GitMerge,
  rebase: Workflow,
} satisfies Record<TimelinePointType, typeof ShieldCheck>;

const typeLabelMap: Record<TimelinePointType, string> = {
  commit: "Guardado",
  push: "Nube",
  restore: "Salto",
  branch: "Rama",
  merge: "Merge",
  rebase: "Rebase",
};

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(element);
    setSize({
      width: element.clientWidth,
      height: element.clientHeight,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, size };
}

function buildGraph(repository: RepositoryState, compact: boolean) {
  const points = compact
    ? repository.commits.slice(Math.max(repository.commits.length - 6, 0))
    : repository.commits;
  const branchOrder = repository.branches.map((branch) => branch.name);
  const branchIndexMap = new Map(branchOrder.map((name, index) => [name, index]));
  const branchColorMap = new Map(repository.branches.map((branch) => [branch.name, branch.color]));
  const filteredIds = new Set(points.map((point) => point.id));
  const xGap = compact ? 138 : 182;
  const yGap = compact ? 78 : 112;
  const paddingX = compact ? 96 : 148;
  const paddingTop = compact ? 88 : 142;
  const paddingBottom = compact ? 132 : 210;
  const cardWidth = compact ? 148 : 176;
  const cardHeight = compact ? 88 : 128;
  const badgeWidth = 82;
  const badgeHeight = 30;
  const width = Math.max(paddingX * 2 + Math.max(points.length - 1, 0) * xGap, compact ? 560 : 1080);
  const height = Math.max(
    paddingTop + paddingBottom + Math.max(branchOrder.length - 1, 0) * yGap + cardHeight,
    compact ? 300 : 560,
  );

  const positioned: PositionedPoint[] = points.map((point, index) => {
    const branchIndex = branchIndexMap.get(point.branch) ?? 0;
    return {
      point,
      x: paddingX + index * xGap,
      y: paddingTop + branchIndex * yGap,
      color: branchColorMap.get(point.branch) ?? "#34d399",
      branchIndex,
      isHead: repository.headId === point.id,
      isClickable: point.type === "commit" || point.type === "branch",
    };
  });

  const positionedMap = new Map(positioned.map((entry) => [entry.point.id, entry]));

  const edges = positioned.flatMap((entry) => {
    const parent = entry.point.parentId ? positionedMap.get(entry.point.parentId) : undefined;
    if (!parent) {
      return [];
    }

    const controlX = (parent.x + entry.x) / 2;
    return [
      {
        id: `${parent.point.id}-${entry.point.id}`,
        d: `M ${parent.x} ${parent.y} C ${controlX} ${parent.y}, ${controlX} ${entry.y}, ${entry.x} ${entry.y}`,
        color: entry.color,
      },
    ];
  });

  const jumpEdges = positioned.flatMap((entry) => {
    if (!entry.point.targetId || !filteredIds.has(entry.point.targetId)) {
      return [];
    }

    const target = positionedMap.get(entry.point.targetId);
    if (!target || target.point.id === entry.point.parentId) {
      return [];
    }

    const midY = (entry.y + target.y) / 2;
    return [
      {
        id: `${entry.point.id}-${target.point.id}-target`,
        d: `M ${entry.x} ${entry.y} Q ${Math.max(entry.x, target.x) - 42} ${midY}, ${target.x} ${target.y}`,
        color: entry.color,
      },
    ];
  });

  return {
    points: positioned,
    edges,
    jumpEdges,
    width,
    height,
    cardWidth,
    cardHeight,
    badgeWidth,
    badgeHeight,
    branchOrder,
    branchColorMap,
  };
}

export function GitTreeVisualizer({
  repository,
  pending,
  title = "Mapa de Historia",
  compact = false,
  onCheckoutSelect,
}: GitTreeVisualizerProps) {
  const current = pending ?? repository;
  const [zoomFactor, setZoomFactor] = useState(1);
  const graph = useMemo(() => buildGraph(current, compact), [current, compact]);
  const { ref: viewportRef, size: viewportSize } = useElementSize<HTMLDivElement>();

  const setSafeZoom = (delta: number) => {
    setZoomFactor((currentZoom) => Math.min(1.8, Math.max(0.72, Number((currentZoom + delta).toFixed(2)))));
  };

  const fitScale = compact ? 1 : viewportSize.width > 0 ? viewportSize.width / graph.width : 1;
  const appliedScale = compact ? 1 : fitScale * zoomFactor;
  const scaledWidth = graph.width * appliedScale;
  const scaledHeight = graph.height * appliedScale;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-white/35">{title}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Historial de version</h2>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60">
          <GitBranch className="h-4 w-4" />
          <span>{current.branchName}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-[26px] border border-white/10 bg-slate-950/45 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {current.branches.map((branch) => (
              <span
                key={branch.name}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em]"
                style={{
                  borderColor: withAlpha(branch.color, "33"),
                  backgroundColor: withAlpha(branch.color, "18"),
                  color: branch.color,
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: branch.color }}
                />
                {branch.name}
              </span>
            ))}
          </div>

          {!compact ? (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-white/50">
                <Move className="h-3.5 w-3.5" />
                Pan + scroll
              </div>
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
                <button
                  type="button"
                  onClick={() => setSafeZoom(-0.12)}
                  className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[54px] text-center text-xs text-white/60">
                  {Math.round(appliedScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setSafeZoom(0.12)}
                  className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-[22px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.7),rgba(2,6,23,0.9))] p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Parent / child
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
              <Sparkles className="h-3.5 w-3.5" />
              Head actual
            </span>
            {!compact ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                <ArrowUpToLine className="h-3.5 w-3.5" />
                Click en commit = checkout
              </span>
            ) : null}
          </div>

          <div
            ref={viewportRef}
            className="min-h-[280px] flex-1 overflow-auto rounded-[18px] border border-white/8 bg-black/20"
          >
            <div
              style={{
                width: scaledWidth,
                height: scaledHeight,
                minWidth: compact ? scaledWidth : "100%",
                minHeight: compact ? scaledHeight : "100%",
              }}
            >
              <svg
                viewBox={`0 0 ${graph.width} ${graph.height}`}
                className="block h-full w-full"
                aria-label="Git multiverse graph"
              >
                {graph.branchOrder.map((branchName, index) => {
                  const y = 132 + index * (compact ? 78 : 112);
                  const color = graph.branchColorMap.get(branchName) ?? "#94a3b8";
                  return (
                    <g key={branchName}>
                      <line
                        x1={36}
                        x2={graph.width - 40}
                        y1={y}
                        y2={y}
                        stroke={withAlpha(color, "26")}
                        strokeWidth="1.5"
                        strokeDasharray="6 10"
                      />
                      <text
                        x={32}
                        y={y - 16}
                        textAnchor="start"
                        fill={color}
                        fontSize="12"
                        fontWeight="600"
                      >
                        {branchName}
                      </text>
                    </g>
                  );
                })}

                {graph.edges.map((edge) => (
                  <path
                    key={edge.id}
                    d={edge.d}
                    fill="none"
                    stroke={withAlpha(edge.color, "a6")}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                ))}

                {graph.jumpEdges.map((edge) => (
                  <path
                    key={edge.id}
                    d={edge.d}
                    fill="none"
                    stroke={withAlpha(edge.color, "90")}
                    strokeWidth="2"
                    strokeDasharray="8 7"
                    strokeLinecap="round"
                  />
                ))}

                {graph.points.map(({ point, x, y, color, isHead, isClickable }) => {
                  const Icon = iconMap[point.type];
                  return (
                    <g
                      key={point.id}
                      onClick={() => {
                        if (!compact && isClickable && onCheckoutSelect) {
                          onCheckoutSelect(point.id);
                        }
                      }}
                      className={isClickable && !compact ? "cursor-pointer" : undefined}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={isHead ? 18 : 14}
                        fill={withAlpha(color, isHead ? "2f" : "24")}
                        stroke={withAlpha(color, "f0")}
                        strokeWidth={isHead ? 3 : 2}
                      />
                      <foreignObject x={x - 10} y={y - 10} width={20} height={20}>
                        <div className="flex h-full w-full items-center justify-center text-white">
                          <Icon className="h-4 w-4" />
                        </div>
                      </foreignObject>

                      <foreignObject
                        x={x - graph.cardWidth / 2}
                        y={y + 22}
                        width={graph.cardWidth}
                        height={graph.cardHeight}
                      >
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`h-full rounded-2xl border border-white/10 bg-slate-950/78 p-3 text-center shadow-[0_14px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm transition ${
                            isClickable && !compact ? "hover:border-white/20 hover:bg-slate-900/88" : ""
                          }`}
                        >
                          <p className="truncate text-sm font-medium text-white">{point.label}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/50">
                            {point.description}
                          </p>
                          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/45">
                            <span>{formatTime(point.timestamp)}</span>
                            <span
                              className="rounded-full border px-2 py-0.5"
                              style={{
                                borderColor: withAlpha(color, "33"),
                                backgroundColor: withAlpha(color, "18"),
                                color,
                              }}
                            >
                              {typeLabelMap[point.type]}
                            </span>
                          </div>
                        </motion.div>
                      </foreignObject>

                      {isHead ? (
                        <foreignObject
                          x={x + 20}
                          y={y - 16}
                          width={graph.badgeWidth}
                          height={graph.badgeHeight}
                        >
                          <div className="inline-flex items-center gap-1 rounded-full border border-violet-300/20 bg-violet-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-violet-100">
                            <Sparkles className="h-3 w-3" />
                            HEAD
                          </div>
                        </foreignObject>
                      ) : null}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
