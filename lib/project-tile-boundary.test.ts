import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("ProjectTile client boundary", () => {
  it("declares its own client boundary before using the publication-expiry hook", () => {
    // Country, location and developer pages render tiles from Server Components.
    // A client parent on the homepage alone cannot protect those entry points.
    const file = "components/ie/ProjectTile.tsx";
    const source = ts.createSourceFile(file, readFileSync(path.join(process.cwd(), file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const first = source.statements[0];
    expect(ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text).toBe("use client");
  });
});
