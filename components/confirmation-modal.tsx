"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { GitTreeVisualizer } from "@/components/git-tree-visualizer";
import type { PendingAction } from "@/lib/types";

type ConfirmationModalProps = {
  pending: PendingAction;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmationModal({ pending, onClose, onConfirm }: ConfirmationModalProps) {
  const details = [
    {
      title: "Accion traducida",
      value: pending.action.label,
    },
    {
      title: "Resumen",
      value: pending.summary,
    },
    {
      title: "Copia segura",
      value: pending.backupLabel,
    },
    {
      title: "Comandos Git",
      value: pending.action.gitTranslation.join(" + "),
    },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 p-3 backdrop-blur-sm sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex max-h-[92dvh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/95 p-4 shadow-2xl shadow-cyan-500/10 sm:p-6"
        initial={{ y: 18, opacity: 0, scale: 0.985 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.985 }}
        transition={{ duration: 0.22 }}
      >
        <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <ShieldCheck className="h-4 w-4" />
              Copia de seguridad antes de actuar
            </div>
            <h2 className="text-2xl font-semibold text-white">Comparacion de seguridad</h2>
            <p className="max-w-2xl text-sm text-slate-300">
              Para hacer esto, voy a crear una &quot;Copia de Seguridad&quot;. Esto guardara tu
              trabajo actual en el {pending.backupLabel} para que nunca lo pierdas. ¿Confirmas?
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto pr-1">
          <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <div className="space-y-4">
            {details.map((detail) => (
              <div
                key={detail.title}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{detail.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-100">{detail.value}</p>
              </div>
            ))}
            </div>

            <div className="grid min-h-0 gap-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-200">
                    <Sparkles className="h-4 w-4 text-slate-400" />
                    Antes
                  </div>
                  <div className="min-h-[280px]">
                    <GitTreeVisualizer repository={pending.before} compact />
                  </div>
                </div>

                <div className="flex items-center justify-center text-white/35">
                  <ArrowRight className="h-8 w-8" />
                </div>

                <div className="rounded-[1.75rem] border border-cyan-400/20 bg-cyan-400/5 p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium text-cyan-100">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    Despues
                  </div>
                  <div className="min-h-[280px]">
                    <GitTreeVisualizer repository={pending.after} compact />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] hover:bg-cyan-100"
          >
            Confirmar y continuar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
