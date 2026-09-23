import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { readTestConfig } from "./real-project.mjs";
const config = readTestConfig();
const fixtures = JSON.parse(readFileSync(new URL("../../.recovery-local/real-test-fixtures.json", import.meta.url), "utf8"));
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3100"], {
  stdio: "inherit",
  env: { ...process.env, SUPABASE_URL: config.url, SUPABASE_ANON_KEY: config.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: config.serviceKey, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    APP_ORIGIN: "http://localhost:3100", ADMIN_USER_IDS: fixtures.alice.id, RECOVERY_ALLOW_GAME_WRITES: "false" },
});
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
child.on("exit", code => { process.exitCode = code || 0; });
