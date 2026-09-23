// Shared, deterministic route interpretation for preview, simulation and replay.
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const terrainLabels = {
  flat: "Flad vej",
  hills: "Bakker",
  mountain: "Bjerge",
  cobbles: "Brosten",
  timetrial: "Enkeltstart",
  descent: "Nedkørsel",
};
export function normalizeRoute(stage = {}) {
  const distance = Number(stage.distance_km);
  if (!Number.isFinite(distance) || distance < 20 || distance > 400)
    throw new Error("Ruten skal være mellem 20 og 400 km.");
  const points = (
    Array.isArray(stage.profile_points) ? stage.profile_points : []
  )
    .map((p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [NaN, NaN]))
    .filter((p) => p.every(Number.isFinite) && p[0] >= 0 && p[0] <= distance)
    .sort((a, b) => a[0] - b[0]);
  const unique = points.filter((p, i) => !i || p[0] !== points[i - 1][0]);
  if (!unique.length) unique.push([0, 0], [distance, 0]);
  if (unique[0][0] > 0) unique.unshift([0, unique[0][1]]);
  if (unique.at(-1)[0] < distance) unique.push([distance, unique.at(-1)[1]]);
  const tags = (stage.tags || []).map((x) => String(x).toUpperCase());
  const specialty = tags.includes("MOUNTAIN")
    ? "mountain"
    : tags.includes("HILLS")
      ? "hills"
      : tags.includes("COBBLES")
        ? "cobbles"
        : tags.includes("TT")
          ? "timetrial"
          : "flat";
  const keypoints = (Array.isArray(stage.keypoints) ? stage.keypoints : [])
    .filter(
      (k) => Number.isFinite(Number(k.km)) && k.km >= 0 && k.km <= distance,
    )
    .map((k) => ({
      km: Number(k.km),
      kind: String(k.kind || "POINT").toUpperCase(),
      label: String(k.label || "Rutepunkt").slice(0, 100),
    }));
  if (!keypoints.some((k) => k.kind === "FINISH"))
    keypoints.push({ km: distance, kind: "FINISH", label: "Mål" });
  keypoints.sort((a, b) => a.km - b.km);
  let ascent = 0;
  for (let i = 1; i < unique.length; i++)
    ascent += Math.max(0, unique[i][1] - unique[i - 1][1]);
  return {
    version: 1,
    name: stage.name || "Endagsløb",
    distance,
    points: unique,
    keypoints,
    specialty,
    ascent: Math.round(ascent),
  };
}
export function routeAt(route, km) {
  const position = clamp(Number(km) || 0, 0, route.distance);
  const index = Math.max(
    1,
    route.points.findIndex((p) => p[0] >= position),
  );
  const b = route.points[index],
    a = route.points[index - 1],
    fraction = (position - a[0]) / Math.max(0.001, b[0] - a[0]);
  const gradient =
    ((b[1] - a[1]) / Math.max(0.001, (b[0] - a[0]) * 1000)) * 100;
  const terrain =
    gradient > 4
      ? "mountain"
      : gradient > 1.4
        ? "hills"
        : gradient < -2
          ? "descent"
          : route.specialty;
  return {
    km: position,
    elevation: Math.round(a[1] + fraction * (b[1] - a[1])),
    gradient: Math.round(gradient * 10) / 10,
    terrain,
  };
}
export function routeAdvice(route) {
  const advice = {
    flat: ["sprint", "flat", "Spurt og positionering i finalen"],
    hills: ["hills", "endurance", "Gentagne accelerationer på bakkerne"],
    mountain: ["mountain", "endurance", "Klatrestyrke og udholdenhed"],
    cobbles: ["cobbles", "strength", "Brosten og evnen til at holde tempo"],
    timetrial: ["timetrial", "endurance", "Enkeltstart og jævnt tempo"],
  };
  const [primary, secondary, description] = advice[route.specialty];
  return { primary, secondary, description };
}
