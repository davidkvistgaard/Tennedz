// Offline fixtures only: no database, network, credentials or production imports.
import { readFileSync, writeFileSync } from "node:fs";
import { comparePlans } from "../lib/race-lab/batch.mjs";
import { simulateLab } from "../lib/race-lab/simulate.mjs";
const [mode = "compare", inputPath, outputPath] = process.argv.slice(2);
if (!["compare", "replay"].includes(mode))
  throw Error(
    "Usage: node scripts/race-lab.mjs compare|replay [input.json] [output.json]",
  );
const input = inputPath
  ? JSON.parse(readFileSync(inputPath, "utf8").replace(/^\uFEFF/, ""))
  : {};
const output = mode === "compare" ? comparePlans(input) : simulateLab(input);
if (outputPath)
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
else console.log(JSON.stringify(output, null, 2));
