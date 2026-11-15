import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  execute: null as null | ((previous: { ok: boolean }, data: FormData) => Promise<{ ok: boolean; error?: string }>),
  dispatch: vi.fn(),
}));
vi.mock("react", () => ({
  useRef: (current: unknown) => ({ current }),
  useTransition: () => [false, (callback: () => void) => callback()],
  useActionState: (execute: typeof fixture.execute, initial: { ok: boolean }) => {
    fixture.execute = execute;
    return [initial, fixture.dispatch, false];
  },
}));
import { usePreservedForm } from "./use-preserved-form";

describe("preserved form action lifecycle", () => {
  beforeEach(() => { fixture.dispatch.mockReset(); });
  it("retains inputs on returned errors and resets only after acknowledged success", async () => {
    const action = vi.fn().mockResolvedValueOnce({ ok: false, error: "Validation" }).mockResolvedValueOnce({ ok: true });
    const form = usePreservedForm(action);
    const reset = vi.fn();
    form.formRef.current = { reset } as unknown as HTMLFormElement;
    const data = new FormData(); data.set("title", "Draft text");
    expect(await fixture.execute!({ ok: false }, data)).toEqual({ ok: false, error: "Validation" });
    expect(reset).not.toHaveBeenCalled();
    expect(await fixture.execute!({ ok: false }, data)).toEqual({ ok: true });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenLastCalledWith({ ok: false }, data);
  });
  it("retains inputs and describes uncertain outcome on thrown transport errors", async () => {
    const form = usePreservedForm(async () => { throw new Error("Transport"); });
    const reset = vi.fn(); form.formRef.current = { reset } as unknown as HTMLFormElement;
    const result = await fixture.execute!({ ok: false }, new FormData());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Проверьте список");
    expect(reset).not.toHaveBeenCalled();
  });
});
