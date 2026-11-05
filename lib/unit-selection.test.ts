import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "./home-search";
import { projectSelectionSearch, selectionFromSearch, unitSelection } from "./unit-selection";

describe("catalogue to unit selection", () => {
  it("carries explicit criteria and studio zero", () => {
    expect(unitSelection({...EMPTY_FILTERS,budget:"20",bedrooms:"0",ownership:"freehold"}))
      .toEqual({budget:"20",bedrooms:"0",ownership:"freehold"});
  });
  it("carries natural-language criteria and honours explicit overrides", () => {
    const filters = {...EMPTY_FILTERS,q:"вилла до 30 млн 3 спальни 2027"};
    expect(unitSelection(filters)).toEqual({budget:"30",bedrooms:"3",ownership:""});
    expect(unitSelection({...filters,budget:"20",bedrooms:"2"})).toEqual({budget:"20",bedrooms:"2",ownership:""});
  });
  it("preserves catalogue context for project navigation and return", () => {
    const filters = {...EMPTY_FILTERS,view:"map",zone:"Bang Tao",q:"студия до 7,5 млн",sort:"price-asc"};
    const search = projectSelectionSearch(filters);
    const context = selectionFromSearch(Object.fromEntries(new URLSearchParams(search)));
    expect(context.search).toBe(search);
    expect(context.selection).toEqual({budget:"7.5",bedrooms:"0",ownership:""});
    expect(projectSelectionSearch(EMPTY_FILTERS)).toBe("");
  });
  it("does not accept invalid or multi-valued criteria", () => {
    expect(selectionFromSearch({budget:"Infinity",bedrooms:"-1",ownership:"invalid"}).selection)
      .toEqual({budget:"",bedrooms:"",ownership:""});
    expect(selectionFromSearch({budget:["10","20"]}).selection.budget).toBe("");
  });
});
