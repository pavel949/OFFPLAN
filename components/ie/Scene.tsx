import type { CSSProperties } from "react";

/**
 * Generative "establishing shot" for projects without a photo: a stylised coast / hills / skyline at dusk,
 * deterministic per project so the grid has rhythm. Replaced by the developer's real photo as soon as one
 * is published. Pure CSS + inline SVG, no network.
 */
const PALETTES = [
  { sky: ["#0a1c36", "#1b4a63", "#d9a85b"], sea: "#0d3a4e", land: "#07182a" }, // golden hour
  { sky: ["#0b1830", "#2a3f6b", "#e7b17a"], sea: "#12325a", land: "#081426" }, // dusk
  { sky: ["#071a2c", "#0f5a6b", "#9fd3c7"], sea: "#0b4a5a", land: "#06202e" }, // lagoon
  { sky: ["#0a1426", "#3a3560", "#f0a98a"], sea: "#1c2a55", land: "#0a1226" }, // rose
] as const;

export function Scene({ seed, kind }: { seed: number; kind: "villa" | "condo" | "house" }) {
  const pal = PALETTES[Math.abs(seed) % PALETTES.length];
  const sunX = 18 + ((seed * 37) % 64);
  const style = {
    background: `radial-gradient(60% 70% at ${sunX}% 62%, ${pal.sky[2]}cc, transparent 60%), linear-gradient(180deg, ${pal.sky[0]} 0%, ${pal.sky[1]} 62%, ${pal.sea} 62%, ${pal.sea} 100%)`,
  } as CSSProperties;
  const towers = kind === "condo";
  return (
    <div className="ie-scene" style={style} aria-hidden="true">
      <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
        <path d={`M0 160 Q ${60 + (seed % 40)} 110 140 150 T 290 140 T 400 150 V250 H0Z`} fill={pal.land} opacity="0.9" />
        {towers ? (
          <g fill="#050f1d" opacity="0.92">
            <rect x={70 + (seed % 20)} y="82" width="26" height="86" />
            <rect x="104" y="104" width="22" height="64" />
            <rect x={210 + (seed % 15)} y="94" width="30" height="76" />
            <rect x="248" y="120" width="20" height="50" />
          </g>
        ) : (
          <g fill="#050f1d" opacity="0.92">
            <path d="M80 168 L80 140 L130 122 L180 140 L180 168Z" />
            <path d="M210 168 L210 146 L250 130 L292 146 L292 168Z" />
          </g>
        )}
        <g stroke="rgba(255,255,255,.28)" strokeWidth="1" fill="none">
          <path d="M0 196 Q 100 190 200 196 T 400 196" />
          <path d="M0 214 Q 100 208 200 214 T 400 214" opacity=".6" />
        </g>
      </svg>
    </div>
  );
}
