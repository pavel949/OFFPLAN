import { beforeEach,describe,expect,it,vi } from "vitest";
import { emptySalesModel } from "@/lib/sales-model";
const mocks=vi.hoisted(()=>({auth:vi.fn(),client:vi.fn(),refresh:vi.fn()}));
vi.mock("@/lib/admin-server-auth",()=>({getAdminSessionOk:mocks.auth}));
vi.mock("@/lib/supabase/service",()=>({createServiceRoleClient:mocks.client}));
vi.mock("next/cache",()=>({revalidatePath:mocks.refresh}));
import {adminGetSalesModel,adminSaveSalesModel} from "@/app/actions/sales-model";
const project="00000000-0000-4000-8000-000000000001";
describe("sales model server boundary",()=>{
  beforeEach(()=>vi.resetAllMocks());
  it("rejects reads and writes without admin before creating privileged client",async()=>{
    mocks.auth.mockResolvedValue(false);
    await expect(adminGetSalesModel(project)).rejects.toThrow();
    expect((await adminSaveSalesModel(project,0,emptySalesModel())).ok).toBe(false);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("does not insert an invalid model",async()=>{
    mocks.auth.mockResolvedValue(true);const from=vi.fn();mocks.client.mockReturnValue({from});
    expect((await adminSaveSalesModel(project,0,{...emptySalesModel(),projectType:"invented"})).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
  it("reports a stale revision instead of overwriting",async()=>{
    mocks.auth.mockResolvedValue(true);
    const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:null,error:null}),insert:vi.fn().mockResolvedValue({error:{code:"P0001",message:"revision conflict"}})};
    mocks.client.mockReturnValue({from:()=>query});
    const result=await adminSaveSalesModel(project,0,emptySalesModel());
    expect(result.ok).toBe(false);expect(result.error).toContain("Другой сотрудник");expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("blocks silent area reinterpretation",async()=>{
    mocks.auth.mockResolvedValue(true);
    const old=emptySalesModel();old.units=[{id:project,kind:"villa",phaseId:"",buildingId:"",floorLabel:"",additionalFloors:"",plotNumber:"",internalArea:null,totalArea:100,landArea:null,availability:"unknown",source:"",sourceDate:"",checkedOn:"",verification:"unknown"}];
    const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{model:old},error:null}),insert:vi.fn()};mocks.client.mockReturnValue({from:()=>query});
    const result=await adminSaveSalesModel(project,1,{...old,areaUnit:"sqft"});expect(result.ok).toBe(false);expect(query.insert).not.toHaveBeenCalled();
  });
  it("saves a new revision and refreshes only the internal project",async()=>{
    mocks.auth.mockResolvedValue(true);
    const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:null,error:null}),insert:vi.fn().mockResolvedValue({error:null})};mocks.client.mockReturnValue({from:()=>query});
    expect(await adminSaveSalesModel(project,0,emptySalesModel())).toEqual({ok:true,revision:1});
    expect(query.insert).toHaveBeenCalledWith({project_id:project,revision:1,model:emptySalesModel()});expect(mocks.refresh).toHaveBeenCalledWith(`/admin/projects/${project}`);
  });
});
