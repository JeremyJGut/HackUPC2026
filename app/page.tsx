"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudUpload, ShieldCheck, Sparkles } from "lucide-react";
import { ChatPanel } from "@/components/chat-panel";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { GitTreeVisualizer } from "@/components/git-tree-visualizer";
import {
  checkoutToPoint,
  createAssistantConfirmation,
  createAssistantResult,
  createInitialRepository,
  createInitialMessages,
  getActionFromInput,
  simulateAction,
} from "@/lib/git-simulator";
import type { ChatMessage, PendingAction, RepositoryState } from "@/lib/types";

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
  }>;
};

const suggestionPhrases = [
  "Guarda lo que he hecho ahora",
  "Crea una rama paralela para experimentar",
  "Súbelo a internet",
  "Quiero volver a lo de ayer",
];

export default function Home() {
  const [repository, setRepository] = useState<RepositoryState>(createInitialRepository());
  const [messages, setMessages] = useState<ChatMessage[]>(createInitialMessages());
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const stats = useMemo(
    () => [
      {
        label: "Puntos de guardado",
        value: repository.commits.length.toString().padStart(2, "0"),
        icon: ShieldCheck,
      },
      {
        label: "Cambios preparados",
        value: String(repository.stagedChanges),
        icon: Sparkles,
      },
      {
        label: "Estado de nube",
        value: repository.lastAction === "push" ? "Sincronizado" : "Local",
        icon: CloudUpload,
      },
    ],
    [repository],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();

      if (!transcript) {
        return;
      }

      setInput(transcript);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Te escuché decir: "${transcript}". Puedes enviarlo o editarlo antes de confirmar.`,
          timestamp: new Date().toISOString(),
          kind: "transcript",
        },
      ]);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.onerror = () => {
      setIsListening(false);
    };
    recognitionRef.current = recognition;
  }, []);

  const handleSubmit = (input: string) => {
    const trimmed = input.trim();

    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const action = getActionFromInput(trimmed, repository);
    const simulation = simulateAction(repository, action);

    setMessages((current) => [...current, userMessage, createAssistantConfirmation(action)]);
    setPendingAction({
      action,
      before: repository,
      after: simulation.nextState,
      summary: simulation.summary,
      backupLabel: simulation.backupLabel,
    });
    setInput("");
  };

  const handleConfirm = () => {
    if (!pendingAction) {
      return;
    }

    setRepository(pendingAction.after);
    setMessages((current) => [...current, createAssistantResult(pendingAction.action, pendingAction.summary)]);
    setPendingAction(null);
  };

  const handleClose = () => {
    setPendingAction(null);
  };

  const handleCheckoutSelect = (pointId: string) => {
    const targetPoint = repository.commits.find((point) => point.id === pointId);
    if (!targetPoint) {
      return;
    }

    const nextRepository = checkoutToPoint(repository, pointId);
    setRepository(nextRepository);
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `He movido el HEAD hacia ${targetPoint.label}. Es una simulación visual de checkout para que veas cómo cambiaría tu historia.`,
        timestamp: new Date().toISOString(),
        kind: "result",
      },
    ]);
  };

  const handleMicClick = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
        return;
      }

      recognitionRef.current.start();
      setIsListening(true);
      return;
    }

    setIsListening(true);
    window.setTimeout(() => {
      const fallbackTranscript = "Súbelo a internet";
      setInput(fallbackTranscript);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Modo demo: he simulado la voz con "${fallbackTranscript}".`,
          timestamp: new Date().toISOString(),
          kind: "transcript",
        },
      ]);
      setIsListening(false);
    }, 1200);
  };

  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_35%),linear-gradient(180deg,#07111f,#020617)] px-4 py-6 text-slate-100 sm:px-6 lg:h-[100dvh] lg:overflow-hidden xl:px-8">
      <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col gap-6">
        <motion.header
          className="flex flex-col gap-5 rounded-[32px] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              GitEase MVP
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Git explicado como si fuera una historia.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Traduce voz o lenguaje natural a acciones seguras, muestra una copia de seguridad antes de
                ejecutar y visualiza la evolucion del proyecto con puntos de guardado intuitivos.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {stats.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="min-w-[160px] rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-4"
              >
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Icon className="h-4 w-4 text-indigo-300" />
                  {label}
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>
        </motion.header>

        <section className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_clamp(300px,28vw,390px)]">
          <motion.section
            className="min-h-[640px] lg:min-h-0 lg:h-full"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
          >
            <GitTreeVisualizer
              repository={repository}
              pending={pendingAction?.after}
              onCheckoutSelect={handleCheckoutSelect}
            />
          </motion.section>

          <motion.aside
            className="min-h-[640px] rounded-[32px] border border-white/10 bg-white/6 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-xl lg:min-h-0 lg:h-full lg:overflow-hidden"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <ChatPanel
              messages={messages}
              input={input}
              isListening={isListening}
              onInputChange={setInput}
              onSubmit={() => handleSubmit(input)}
              onMicClick={handleMicClick}
              suggestions={suggestionPhrases}
            />
          </motion.aside>
        </section>
      </div>

      <AnimatePresence>
        {pendingAction && (
          <ConfirmationModal pending={pendingAction} onClose={handleClose} onConfirm={handleConfirm} />
        )}
      </AnimatePresence>
    </main>
  );
}
