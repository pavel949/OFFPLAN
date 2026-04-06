/** Legacy catalogue row — mirrors `P[]` from Ignatev Estate HTML export. */

export type RecLabel = "BUY" | "WATCH" | "AVOID";

export interface CatalogProject {
  id: number;
  n: string;
  dev: string;
  dt: string;
  zone: string;
  seg: string;
  type: string;
  pT: string;
  pN: number;
  pU: string;
  sqmP: string;
  units: string;
  unitSzM2: string;
  minBR: number;
  stK: string;
  stT: string;
  compY: number;
  compQ: string;
  beach: string;
  own: string;
  mgmt: string;
  focus: string;
  yield: string;
  yN: number;
  rat: number;
  risk: number;
  desc: string;
  tags: string[];
  bdg: string[];
  rec: RecLabel;
  recText: string;
  src: string;
}

export interface CatalogMeta {
  quarterLabel: string;
  totalProjects: number;
  totalValueBnTHB: number;
  avgYieldPct: number;
  buyCount: number;
  watchCount: number;
  avoidCount: number;
}

export interface Developer {
  code: string;
  nameEn: string;
  nameRu: string;
}

export interface ZoneRow {
  slug: string;
  labelEn: string;
  labelRu: string;
}
