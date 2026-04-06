"use client";

import { useState } from "react";

export function LeadAiPanel({
  leadText,
}: {
  leadText: string;
}) {
  const [out, setOut] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setOut(null);
    try {
      const res = await fetch("/api/ai/lead-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: leadText }),
      });
      const data = (await res.json()) as {
        summary?: string;
        suggestedNextStep?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Request failed");
      setOut(
        `${data.summary ?? ""}\n\nNext: ${data.suggestedNextStep ?? ""}`,
      );
    } catch (e) {
      setOut(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 border border-[var(--line)] rounded-lg p-4 bg-[var(--panel)]">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-2">
        ИИ (stub)
      </h3>
      <button
        type="button"
        className="admin-btn mb-2"
        disabled={loading}
        onClick={run}
      >
        {loading ? "…" : "Суммаризировать лид"}
      </button>
      {out ? (
        <pre className="text-xs whitespace-pre-wrap font-mono text-[var(--text)]">
          {out}
        </pre>
      ) : null}
    </div>
  );
}
