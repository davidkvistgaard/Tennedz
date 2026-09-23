export async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15000), ...options,
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || "Anmodningen mislykkedes.");
    error.code = data.code; error.status = response.status; throw error;
  }
  return data;
}
