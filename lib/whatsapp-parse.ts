/** Parse pasted WhatsApp export / copy-paste (Android/iOS/Web formats vary). */

export type ParsedWaLine = {
  raw: string;
  at?: string;
  author?: string;
  body: string;
};

export type ParsedWaResult = {
  lines: ParsedWaLine[];
  urls: string[];
  phones: string[];
  stats: { lineCount: number; messageCount: number };
};

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const PHONE_RE = /\+?\d[\d\s\-()]{8,}\d/g;

/** Common: [DD/MM/YYYY, HH:MM:SS] Name: text OR DD/MM/YY, H:MM AM - Name: text */
function trySplitLine(line: string): ParsedWaLine | null {
  const t = line.trim();
  if (!t) return null;

  const br1 = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\]\s*([^:]+):\s*(.*)$/i.exec(
    t,
  );
  if (br1) {
    return {
      raw: t,
      at: `${br1[1]} ${br1[2]}`,
      author: br1[3].trim(),
      body: br1[4].trim(),
    };
  }

  const br2 =
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\s*[-–—]\s*([^:]+):\s*(.*)$/i.exec(
      t,
    );
  if (br2) {
    return {
      raw: t,
      at: `${br2[1]} ${br2[2]}`,
      author: br2[3].trim(),
      body: br2[4].trim(),
    };
  }

  return { raw: t, body: t };
}

export function parseWhatsAppText(raw: string): ParsedWaResult {
  const chunks = raw.split(/\r?\n/);
  const lines: ParsedWaLine[] = [];
  const urls = new Set<string>();
  const phones = new Set<string>();

  for (const chunk of chunks) {
    const p = trySplitLine(chunk);
    if (!p) continue;
    lines.push(p);
    const scan = `${p.body} ${p.author ?? ""}`;
    let m: RegExpExecArray | null;
    const urlRe = new RegExp(URL_RE);
    while ((m = urlRe.exec(scan)) !== null) {
      urls.add(m[0].replace(/[),.;]+$/, ""));
    }
    const phRe = new RegExp(PHONE_RE);
    while ((m = phRe.exec(scan)) !== null) {
      phones.add(m[0].replace(/\s+/g, " ").trim());
    }
  }

  return {
    lines,
    urls: [...urls],
    phones: [...phones],
    stats: {
      lineCount: chunks.length,
      messageCount: lines.filter((l) => l.author || l.body.length > 0).length,
    },
  };
}
