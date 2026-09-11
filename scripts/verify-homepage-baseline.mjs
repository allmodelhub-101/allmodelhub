import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const protectedPath = new URL("../src/app/page.tsx", import.meta.url);
const expected = "9b1f0c6657febef0a27e540644a8ba8977025d5b5d581896c8e68e5739c25d4d";
const source = await readFile(protectedPath);
const actual = createHash("sha256").update(source).digest("hex");

if (actual !== expected) {
  console.error(`Protected homepage changed. Expected ${expected}, received ${actual}.`);
  process.exit(1);
}

console.log(`Protected homepage verified: ${actual}`);

