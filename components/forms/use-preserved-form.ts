"use client";

import { useActionState, useRef, useTransition, type FormEvent } from "react";

type Result = { ok: boolean; error?: string };

/** React form actions reset uncontrolled inputs even on returned validation errors. */
export function usePreservedForm(action: (previous: Result, data: FormData) => Promise<Result>) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const [, start] = useTransition();
  const [state, dispatch, pending] = useActionState(async (previous: Result, data: FormData) => {
    try {
      const result = await action(previous, data);
      if (result.ok) formRef.current?.reset();
      return result;
    } catch {
      return { ok: false, error: "Не удалось получить результат. Проверьте список перед повторной отправкой; введённые данные сохранены." };
    } finally {
      submitted.current = false;
    }
  }, { ok: false } as Result);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitted.current) return;
    const data = new FormData(event.currentTarget);
    submitted.current = true;
    start(() => dispatch(data));
  };
  return { state, pending, formRef, onSubmit };
}
