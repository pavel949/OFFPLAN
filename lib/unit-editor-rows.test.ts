import { describe, expect, it } from "vitest";
import { reconcileUnitEditorRows, type UnitEditorRow } from "./unit-editor-rows";
const row = (id: string, price: string, dirty = false): UnitEditorRow => ({id,key:id,label:id,price,bedrooms:"1",floor:"2",sqm:"35",status:"unknown",dirty,at:null,baseline:price});
describe("unit table server refresh", () => {
  it("shows imported rows and refreshes clean values, removing deleted clean rows", () => {
    expect(reconcileUnitEditorRows([row("a","1"),row("removed","1")],[row("a","2"),row("new","3")]).map(x=>[x.id,x.price])).toEqual([["a","2"],["new","3"]]);
  });
  it("preserves edited fields and unsaved new rows when a different row changes", () => {
    const edit={...row("a","1",true),price:"local"};const draft={...row("draft","4",true),id:undefined};
    const result=reconcileUnitEditorRows([edit,draft],[row("a","1"),row("new","2")]);
    expect(result[0].price).toBe("local");expect(result[0].conflict).toBeUndefined();expect(result[2]).toEqual(draft);
  });
  it("flags changed and deleted dirty rows without losing unsaved work", () => {
    const result=reconcileUnitEditorRows([{...row("a","1",true),price:"local"},row("gone","1",true)],[row("a","2")]);
    expect(result[0].price).toBe("local");expect(result[0].conflict).toBe("changed");expect(result[1].conflict).toBe("deleted");
    expect(reconcileUnitEditorRows(result,[row("a","2")])[0].conflict).toBe("changed");
  });
});
