"use client";

import { useEffect, useRef } from "react";
import { Mic, Send, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import type { ChatMessage } from "@/lib/types";

type ChatPanelProps = {
  messages: ChatMessage[];
  input: string;
  isListening: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onMicClick: () => void;
  suggestions: string[];
};

export function ChatPanel({
  messages,
  input,
  isListening,
  onInputChange,
  onSubmit,
  onMicClick,
  suggestions,
}: ChatPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Asistente GitEase
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Habla como una persona.
          </h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 p-3">
          <Volume2 className="h-5 w-5 text-cyan-200" />
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2"
      >
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`max-w-[92%] rounded-3xl px-4 py-3 ${
              message.role === "assistant"
                ? "bg-white/7 text-slate-100"
                : "ml-auto bg-cyan-400 text-slate-950"
            }`}
          >
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-inherit/70">
              {message.role === "assistant" ? "GitEase" : "Tú"}
            </p>
            <p className="text-sm leading-6">{message.content}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onInputChange(suggestion)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 rounded-[28px] border border-white/10 bg-slate-950/70 p-2">
          <button
            type="button"
            onClick={onMicClick}
            className={`relative flex h-16 w-16 items-center justify-center rounded-full transition ${
              isListening
                ? "bg-rose-400 text-slate-950 shadow-[0_0_40px_rgba(251,113,133,0.45)]"
                : "bg-cyan-300 text-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.35)]"
            }`}
          >
            <Mic className="h-7 w-7" />
            {isListening ? (
              <span className="absolute inset-0 rounded-full border border-rose-200/80 animate-ping" />
            ) : null}
          </button>

          <label className="flex-1">
            <span className="sr-only">Escribe una orden</span>
            <input
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Ej. Guarda lo que hice ahora"
              className="w-full bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>

          <button
            type="button"
            onClick={onSubmit}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-950 transition hover:scale-105"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
