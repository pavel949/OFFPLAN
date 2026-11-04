/** Legacy catalogue row — mirrors `P[]` from Ignatev Estate HTML export. */

export type RecLabel = "BUY" | "WATCH" | "AVOID";

/** Editorial text fields that exist per language (Russian is held outside the canonical payload). */
export interface ProjectTexts {
  desc: string;
  stT: string;
  compQ: string;
  tags: string[];
  /** machine = AI/automatic draft awaiting editor review; reviewed = approved by an editor. */
  reviewStatus?: "machine" | "reviewed";
}

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
  /** Attached at load time from translations; never part of the stored payload. */
  i18n?: { ru?: ProjectTexts };
  /** Authoritative database confirmation date; never accepted from payload JSON. */
  dataConfirmedAt?: string | null;
  sales?: {stage?:string; available?:number; recorded?:number};
  /** Registry verification (attached at load time from catalog_projects; not part of the payload). */
  ver?: { level: 0 | 1 | 2; verifiedAt: string | null; expiresAt: string | null };
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
