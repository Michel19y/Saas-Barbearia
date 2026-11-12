"use client";

import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";

type ToastProps = {
  message: string;
  onDismiss: () => void;
};

export default function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="client-toast fixed top-4 right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-base leading-6 text-zinc-900 shadow-lg md:right-6">
      <CheckCircle2
        aria-hidden="true"
        size={20}
        className="shrink-0 text-green-700"
      />
      <p role="status" aria-live="polite" aria-atomic="true">
        {message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar notificação"
        className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
      >
        <X aria-hidden="true" size={20} />
      </button>
    </div>
  );
}
