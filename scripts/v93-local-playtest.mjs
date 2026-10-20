// Build and serve the opt-in v93 workbench against the local protocol fixture only.
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const fixtureUrl = "http://127.0.0.1:54329";
const env = {
  ...process.env,
  PELOTONIA_NEXT_DIST_DIR: ".next-v93-local",
  PELOTONIA_V91_PLAYTEST_ENABLED: "true",
  PELOTONIA_V93_COASTED_PLAYTEST_ENABLED: "true",
  SUPABASE_URL: fixtureUrl,
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
const cwd = resolve(import.meta.dirname, "..");

function run(command, args) {
  return new Promise((fulfill, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0 ? fulfill() : reject(new Error(`${command} exited with ${signal ?? code}`)));
  });
}

try {
  await run(process.execPath, ["node_modules/next/dist/bin/next", "build"]);
  console.log("\nLocal v93 playtest: http://localhost:3100/login");
  console.log("Fixture login: settings / fixture-password (or bob / fixture-password)");
  console.log("Open Team > v91 playtest and select the v93 road-to-line preview.\n");
  await run(process.execPath, ["tests/support/server.mjs"]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
