export async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15000), ...options,
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || "The request failed.");
    error.code = data.code; error.status = response.status;
    if (data.roadPreview) error.roadPreview = data.roadPreview;
    throw error;
  }
  return data;
}
