import { describe, expect, it } from "vitest";
import { partnerLeadCommand, responseDuration } from "./partner";

describe("partner lead commands", () => {
  const leadId = "00000000-0000-4000-8000-000000000001";
  it("requires an explicit supported action and valid identifier", () => {
    expect(partnerLeadCommand.safeParse({leadId,action:"responded"}).success).toBe(true);
    expect(partnerLeadCommand.safeParse({leadId:"other",action:"claim"}).success).toBe(false);
    expect(partnerLeadCommand.safeParse({leadId,action:"delete"}).success).toBe(false);
  });
  it("requires a real status for a status action", () => {
    expect(partnerLeadCommand.safeParse({leadId,action:"status"}).success).toBe(false);
    expect(partnerLeadCommand.safeParse({leadId,action:"status",status:"delivered"}).success).toBe(false);
    expect(partnerLeadCommand.safeParse({leadId,action:"status",status:"contacted"}).success).toBe(true);
  });
  it("distinguishes missing response data from a fast response", () => {
    expect(responseDuration(null)).toBe("Нет данных");
    expect(responseDuration(-1)).toBe("Нет данных");
    expect(responseDuration(0)).toBe("0 мин");
    expect(responseDuration(90)).toBe("1.5 ч");
    expect(responseDuration(2880)).toBe("2.0 дн");
  });
});
