"use client";

import { motion } from "framer-motion";
import { ArrowRight, CloudUpload, GitBranch, GitCommitHorizontal, RotateCcw } from "lucide-react";

import type { GitAction, RepositoryState } from "@/lib/types";

const iconByType = {
  commit: GitCommitHorizontal,
  push: CloudUpload,
  restore: RotateCcw,
  branch: GitBranch,
} as const;

type ActionPreviewProps = {
  before: RepositoryState;
  after: RepositoryState;
  action?: GitAction | null;
};

function buildBeforeLines(state: RepositoryState) {
  const lastPoint =
    state.commits.find((point) => point.id === state.headId) ?? state.commits[state.commits.length - 1];
  return [
    `Rama activa: ${state.branchName}`,
    `Último punto visible: ${lastPoint?.label ?? "Sin historial"}`,
    `${state.branches.length} ramas visibles en el grafo`,
    `${state.stagedChanges} cambios listos para guardar`,
    state.remoteStatus,
  ];
}

function buildAfterLines(state: RepositoryState, action?: GitAction | null) {
  const lastPoint =
    state.commits.find((point) => point.id === state.headId) ?? state.commits[state.commits.length - 1];
  const commandLine = action ? action.gitTranslation.join("  +  ") : "Esperando una instrucción";

  return [
    `Se aplicará: ${action?.label ?? "Sin acción seleccionada"}`,
    `Resultado esperado: ${lastPoint?.label ?? "Sin cambios"}`,
    `Ramas después del cambio: ${state.branches.length}`,
    state.remoteStatus,
    `Traducción técnica: ${commandLine}`,
  ];
}

export function ActionPreview({ before, after, action }: ActionPreviewProps) {
  const Icon = action ? iconByType[action.type] : GitCommitHorizontal;
  const description = action ? action.naturalExplanation : null;

  return (
    <section className="flex h-full min-h-[320px] flex-col justify-between rounded-[28px] border border-white/10 bg-slate-950/35 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/45">Previsualizacion de accion</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            {action ? action.label : "Before / After"}
          </h2>
          {description ? <p className="mt-3 max-w-2xl text-sm text-slate-300">{description}</p> : null}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2"
        >
          <span className="rounded-full border border-violet-400/30 bg-violet-500/15 p-2 text-violet-200">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-white">Traduccion a Git</p>
            <p className="text-xs text-slate-400">
              {action ? action.gitTranslation.join(" + ") : "Tu instrucción aparecerá aquí"}
            </p>
          </div>
        </motion.div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <PreviewCard title="Estado actual" badge="Before" lines={buildBeforeLines(before)} />
        <div className="flex items-center justify-center text-white/40">
          <ArrowRight className="h-8 w-8" />
        </div>
        <PreviewCard
          title="Estado propuesto"
          badge="After"
          lines={buildAfterLines(after, action)}
          emphasis
        />
      </div>

      {action ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Impacto visual esperado</p>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {action.previewChanges.map((line) => (
              <li
                key={line}
                className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-slate-200"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {before.commits.map((point) => (
          <span
            key={point.id}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400"
          >
            {point.label}
          </span>
        ))}
        {after.commits.length > before.commits.length
          ? after.commits.slice(before.commits.length).map((point) => (
              <span
                key={point.id}
                className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200"
              >
                Nuevo: {point.label}
              </span>
            ))
          : null}
      </div>
    </section>
  );
}

type PreviewCardProps = {
  title: string;
  badge: string;
  lines: string[];
  emphasis?: boolean;
};

function PreviewCard({ title, badge, lines, emphasis = false }: PreviewCardProps) {
  return (
    <div
      className={`rounded-[28px] border p-5 ${
        emphasis
          ? "border-emerald-400/30 bg-emerald-500/10"
          : "border-white/10 bg-slate-950/45"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-300">
          {badge}
        </span>
      </div>

      <ul className="mt-5 space-y-3">
        {lines.map((line) => (
          <li
            key={line}
            className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-200"
          >
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
