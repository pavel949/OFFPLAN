"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  subscribeToProjectByLegacyId,
  unsubscribeFromProjectByLegacyId,
} from "@/app/actions/project-subscribe";

export function ProjectSubscribeBlock({
  legacyId,
  catalogProjectId,
  lang,
}: {
  legacyId: number;
  catalogProjectId: string;
  lang: "en" | "ru";
}) {
  const ru = lang === "ru";
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setSignedIn(false);
      return;
    }
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSignedIn(!!session);
    });
  }, []);

  useEffect(() => {
    if (signedIn !== true) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("project_subscriptions")
        .select("project_id")
        .eq("user_id", user.id)
        .eq("project_id", catalogProjectId)
        .maybeSingle();
      if (!cancelled) setSubscribed(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, catalogProjectId]);

  async function toggle() {
    setBusy(true);
    setMsg(null);
    try {
      if (subscribed) {
        const r = await unsubscribeFromProjectByLegacyId(legacyId);
        if (r.ok) setSubscribed(false);
        else setMsg(r.error ?? "Error");
      } else {
        const r = await subscribeToProjectByLegacyId(legacyId);
        if (r.ok) setSubscribed(true);
        else setMsg(r.error ?? "Error");
      }
    } finally {
      setBusy(false);
    }
  }

  if (signedIn === null) {
    return (
      <p className="text-xs text-[var(--muted)]">…</p>
    );
  }

  if (!signedIn) {
    return (
      <p className="text-xs text-[var(--muted)]">
        {ru ? (
          <>
            <a href="/partner/login" className="underline">
              Войдите
            </a>
            , чтобы подписаться на обновления проекта (email, MVP).
          </>
        ) : (
          <>
            <a href="/partner/login" className="underline">
              Sign in
            </a>{" "}
            to subscribe to project updates (email, MVP).
          </>
        )}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className="text-xs font-semibold px-3 py-1 rounded border border-[var(--bdr)] bg-[var(--gpale)]"
      >
        {subscribed
          ? ru
            ? "Отписаться от апдейтов"
            : "Unsubscribe from updates"
          : ru
            ? "Подписаться на апдейты"
            : "Subscribe to updates"}
      </button>
      {msg ? <span className="text-xs text-[var(--red)]">{msg}</span> : null}
    </div>
  );
}
