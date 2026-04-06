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
    if (typeof t === "string" && t.includes("<style>")) {
      text = t;
      break;
    }
  } catch {
    /* skip */
  }
}
if (!text.includes("<user_query>")) {
  console.error("no html");
  process.exit(1);
}
const inner = text.match(/<user_query>\s*([\s\S]*)\s*<\/user_query>/i);
const html = inner ? inner[1] : text;
const m = html.match(/<style>([\s\S]*?)<\/style>/);
if (!m) {
  console.error("no style");
  process.exit(1);
}
fs.writeFileSync("app/catalogue.css", m[1]);
console.log("wrote app/catalogue.css", m[1].length);
