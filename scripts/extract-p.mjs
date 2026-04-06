import fs from "fs";

const transcriptPath =
  process.env.TRANSCRIPT ||
  "C:/Users/pavel/.cursor/projects/c-Users-pavel-OneDrive-Apps-OFFPLAN/agent-transcripts/dedf5ff0-42d4-473b-b1da-0600d0aeb26f/dedf5ff0-42d4-473b-b1da-0600d0aeb26f.jsonl";

const raw = fs.readFileSync(transcriptPath, "utf8");
let text = "";
for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  try {
    const row = JSON.parse(line);
    const t = row?.message?.content?.[0]?.text;
    if (typeof t === "string" && t.includes("const P=[")) {
      text = t;
      break;
    }
  } catch {
    /* skip */
  }
}
if (!text) {
  console.error("No message with const P=[ found");
  process.exit(1);
}
// Strip <user_query> wrapper if present
if (text.includes("<user_query>")) {
  const inner = text.match(/<user_query>\s*([\s\S]*)\s*<\/user_query>/i);
  if (inner) text = inner[1];
}
const marker = "const P=";
const start = text.indexOf(marker);
if (start < 0) {
  console.error("const P= not found");
  process.exit(1);
}
const after = text.slice(start + marker.length);
const end = after.indexOf("];\n\n// ── LANGUAGE");
if (end < 0) {
  console.error("end marker not found");
  process.exit(1);
}
const arrCode = after.slice(0, end + 1);
const data = eval(arrCode);
console.log("projects:", data.length);
fs.mkdirSync("data/seed", { recursive: true });
fs.writeFileSync("data/seed/projects.json", JSON.stringify(data));
console.log("wrote data/seed/projects.json");
