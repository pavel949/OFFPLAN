import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({resolve:vi.fn(),append:vi.fn()}));
vi.mock("next/headers",()=>({headers:async()=>new Headers()}));
vi.mock("@/lib/captcha",()=>({verifyCaptcha:async()=>true}));
vi.mock("@/lib/server-rate-limit",()=>({serverRateLimit:async()=>({ok:true})}));
vi.mock("@/lib/admin-server-auth",()=>({getAdminSessionOk:async()=>false}));
vi.mock("@/lib/sales-public-query",()=>({resolveSalesSelection:mocks.resolve}));
vi.mock("@/lib/leads/unified",()=>({appendLeadUnified:mocks.append,getLeadUnified:vi.fn(),listLeadsUnified:vi.fn(),updateLeadUnified:vi.fn()}));
import {submitLead} from "@/app/actions/leads";
const offerId="00000000-0000-4000-8000-000000000002";
function form(){const f=new FormData();for(const [k,v] of Object.entries({name:"Test",email:"test@example.invalid",phone:"",message:"",projectId:"16",projectName:"Client supplied",locale:"ru",consent:"on",offerId,salesRevision:"3",price:"1"}))f.set(k,v);return f;}
describe("buyer selection to lead",()=>{
 beforeEach(()=>vi.resetAllMocks());
 it("resolves the price and project server-side, ignoring forged price",async()=>{
  mocks.resolve.mockResolvedValue({projectName:"Verified project",offer:{id:offerId,unitId:"unit",revision:3,price:1e6,currency:"THB"}});
  const result=await submitLead({ok:false},form());expect(result.ok).toBe(true);expect(mocks.resolve).toHaveBeenCalledWith(16,offerId,3);expect(mocks.append).toHaveBeenCalledWith(expect.objectContaining({projectName:"Verified project",salesSelection:expect.objectContaining({price:1e6,revision:3})}));
 });
 it("rejects a withdrawn or changed offer before writing a lead",async()=>{mocks.resolve.mockRejectedValue(new Error("withdrawn"));expect((await submitLead({ok:false},form())).ok).toBe(false);expect(mocks.append).not.toHaveBeenCalled();});
 it("rejects a missing revision",async()=>{const f=form();f.delete("salesRevision");expect((await submitLead({ok:false},f)).ok).toBe(false);expect(mocks.resolve).not.toHaveBeenCalled();expect(mocks.append).not.toHaveBeenCalled();});
 it("preserves general project inquiries",async()=>{const f=form();f.delete("offerId");f.delete("salesRevision");expect((await submitLead({ok:false},f)).ok).toBe(true);expect(mocks.resolve).not.toHaveBeenCalled();expect(mocks.append.mock.calls[0][0]).not.toHaveProperty("salesSelection");});
});
