import fs from "fs";

const transcriptPath =
  "C:/Users/pavel/.cursor/projects/c-Users-pavel-OneDrive-Apps-OFFPLAN/agent-transcripts/dedf5ff0-42d4-473b-b1da-0600d0aeb26f/dedf5ff0-42d4-473b-b1da-0600d0aeb26f.jsonl";

const raw = fs.readFileSync(transcriptPath, "utf8");
let text = "";
for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  try {
    const row = JSON.parse(line);
    const t = row?.message?.content?.[0]?.text;
    if (typeof t === "string" && t.includes("<!-- ═══ ANALYTICS ═══ -->")) {
      text = t;
      break;
    }
  } catch {
    /* skip */
  }
}
const inner = text.match(/<user_query>\s*([\s\S]*)\s*<\/user_query>/i);
const html = inner ? inner[1] : text;

function sliceBetween(start, end) {
  const a = html.indexOf(start);
  if (a < 0) return "";
  const b = end ? html.indexOf(end, a + start.length) : html.length;
  return html.slice(a, b > 0 ? b : undefined);
}

const tabs = {
  analytics: sliceBetween(
    '<!-- ═══ ANALYTICS ═══ -->',
    '<!-- ═══ RISK ═══ -->',
  ),
  risk: sliceBetween('<!-- ═══ RISK ═══ -->', '<!-- ═══ DEVELOPERS ═══ -->'),
  devs: sliceBetween(
    '<!-- ═══ DEVELOPERS ═══ -->',
    '<!-- ═══ CALCULATOR ═══ -->',
  ),
  calcExtra: sliceBetween(
    '<!-- ═══ CALCULATOR ═══ -->',
    '<!-- ═══ SHORTLIST ═══ -->',
  ),
  shortlist: sliceBetween(
    '<!-- ═══ SHORTLIST ═══ -->',
    '<!-- ═══ SERVICES ═══ -->',
  ),
  services: sliceBetween('<!-- ═══ SERVICES ═══ -->', "</main>"),
};

fs.mkdirSync("content/html-tabs", { recursive: true });
for (const [k, v] of Object.entries(tabs)) {
  fs.writeFileSync(`content/html-tabs/${k}.html`, v);
  console.log(k, v.length);
}
