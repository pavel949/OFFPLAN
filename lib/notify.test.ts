import { afterEach,expect,it,vi } from "vitest";
import { notifyNewLead } from "./notify";
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it("includes the trusted unit ownership and price in the existing email without sending a real message",async()=>{
 vi.stubEnv("RESEND_API_KEY","local-mocked-key");vi.stubEnv("NOTIFY_FROM","test@example.invalid");vi.stubEnv("LEAD_NOTIFY_EMAIL","owner@example.invalid");
 const request=vi.fn().mockResolvedValue({ok:true});vi.stubGlobal("fetch",request);
 await notifyNewLead({id:"lead-test",name:"Test",email:"buyer@example.invalid",phone:"",message:"",projectName:"Sudara",salesSelection:{id:"00000000-0000-4000-8000-000000000001",unitId:"00000000-0000-4000-8000-000000000002",revision:1,label:"A-201",ownership:"leasehold",price:12139628,currency:"THB",priceDate:"2026-11-04",availabilityDate:"2026-11-04",source:"PRIVATE"}});
 expect(request).toHaveBeenCalledTimes(1);const body=JSON.parse(request.mock.calls[0][1].body);
 expect(body.text).toContain("Unit: A-201");expect(body.text).toContain("Ownership: leasehold");expect(body.text).toContain("Price: 12139628 THB");expect(body.text).not.toContain("PRIVATE");
});
