// Build and verify the opt-in v93 workbench against local fixtures only.
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { v93LocalBuildDirectory } from "./v93-local-build-dir.mjs";

const cwd = resolve(import.meta.dirname, "..");
const { distDir, cleanup } = await v93LocalBuildDirectory(cwd);
const env = {
  ...process.env,
  PELOTONIA_NEXT_DIST_DIR: distDir,
  PELOTONIA_V91_PLAYTEST_ENABLED: "true",
  PELOTONIA_V93_COASTED_PLAYTEST_ENABLED: "true",
  SUPABASE_URL: "http://127.0.0.1:54329",
  SUPABASE_ANON_KEY: "fixture-anon",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  APP_ORIGIN: "http://localhost:3100",
  PELOTONIA_E2E_NO_CONTEST: "false",
  PELOTONIA_E2E_V2_SAVE: "false",
  PELOTONIA_E2E_V2_LOCK: "false",
  PELOTONIA_E2E_V2_RECORDING: "false",
  PELOTONIA_E2E_V2_SETTLEMENT: "false",
};
function run(args) {
  return new Promise((fulfill, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? fulfill() :
      reject(new Error(`${args[0]} exited with ${signal ?? code}`)));
  });
}

try {
  await run(["node_modules/next/dist/bin/next", "build"]);
  // Keep each fixture session below the workbench's six-runs-per-minute
  // limit while testing the enlarged end-to-end suite.
  for (let shard = 1; shard <= 10; shard++) {
    await run(["node_modules/@playwright/test/cli.js", "test",
      "tests/e2e/v93-coasted-playtest.spec.mjs", "--fully-parallel",
      `--shard=${shard}/10`, "--reporter=dot"]);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.warn(`Could not remove local v93 build: ${error.message}`);
  }
}
