// Explicit allowlist prevents these disposable test helpers from touching production.
import { readFileSync } from "node:fs";
export const testProjectRef = "nxhvaoonnvmvohqaxfdx";
export function readTestConfig() {
  const config = JSON.parse(readFileSync(new URL("../../.recovery-local/real-test-config.json", import.meta.url), "utf8"));
  if (config.url !== `https://${testProjectRef}.supabase.co`) throw new Error("Refusing to use a project outside the disposable test allowlist");
  if (!config.anonKey || !config.serviceKey) throw new Error("Disposable test credentials are missing");
  return config;
}
