"use client";
import { useEffect, useState } from "react";

/** Recheck after background-tab suspension as well as at the publication deadline. */
export function usePublicationExpired(expiresAt?: string) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      const remaining = expiresAt ? Date.parse(expiresAt) - Date.now() : Infinity;
      setExpired(!(remaining > 0));
      if (Number.isFinite(remaining) && remaining > 0) timer = setTimeout(check, Math.min(remaining, 2147483647));
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", check); };
  }, [expiresAt]);
  return expired;
}
