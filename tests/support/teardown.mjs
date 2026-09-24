export default async function teardown() {
  // Explicitly stop our two local servers; do not depend on taskkill availability on Windows.
  await fetch("http://127.0.0.1:54329/__test_shutdown", { method: "POST", signal: AbortSignal.timeout(3000) });
}
