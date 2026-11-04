"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await createSupabaseBrowserClient()?.auth.signOut();
        router.push("/partner/login");
        router.refresh();
      }}
    >
      Выйти
    </button>
  );
}
