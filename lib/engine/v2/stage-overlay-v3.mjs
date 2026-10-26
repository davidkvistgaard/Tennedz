const SURFACES = new Set(['road', 'cobbles', 'gravel', 'dirt']);
const FEATURE_KINDS = new Set(['climb', 'descent', 'sprint', 'landmark', 'road-change']);
const SOURCES = new Set(['observed', 'simulated', 'illustrative']);
const EPSILON = 1e-9;

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be a finite number.');
  }
  return value;
}

function conditions(raw, label) {
  if (!raw || !SURFACES.has(raw.surface) || typeof raw.exposed !== 'boolean') {
    throw new Error(label + ' needs a supported surface and explicit exposure.');
  }
  if (!SOURCES.has(raw.source)) throw new Error(label + ' needs a condition source.');
  const weather = raw.weather;
  if (!weather) throw new Error(label + ' needs explicit weather.');
  const temperatureC = finite(weather.temperatureC, label + ' temperature');
  const windKph = finite(weather.windKph, label + ' wind');
  const rainMm = finite(weather.rainMm, label + ' rain');
  if (windKph < 0 || rainMm < 0) throw new Error(label + ' wind and rain cannot be negative.');
  const windDirectionDeg = weather.windDirectionDeg == null ? null
    : finite(weather.windDirectionDeg, label + ' wind direction');
  if (windDirectionDeg != null && (windDirectionDeg < 0 || windDirectionDeg >= 360)) {
    throw new Error(label + ' wind direction must be 0–359 degrees.');
  }
  return {
    surface: raw.surface, exposed: raw.exposed, source: raw.source,
    weather: {temperatureC, windKph, rainMm, windDirectionDeg},
  };
}

export function normalizeStageOverlayV3(raw) {
  if (raw?.version !== 3) throw new Error('Stage overlay version 3 is required.');
  const distanceKm = finite(raw.distanceKm, 'Stage distance');
  if (distanceKm < 20 || distanceKm > 400) throw new Error('Stage distance must be 20–400 km.');
  if (!Array.isArray(raw.tacticalIntervals) || !Array.isArray(raw.features) ||
      (raw.conditionSpans != null && !Array.isArray(raw.conditionSpans))) {
    throw new Error('Stage overlay needs tactical intervals, features and optional condition spans.');
  }
  const expectedCount = Math.ceil(distanceKm / 5);
  if (raw.tacticalIntervals.length !== expectedCount) {
    throw new Error('Every 5 km tactical interval needs explicit conditions.');
  }
  const tacticalIntervals = raw.tacticalIntervals.map((entry, index) => {
    const fromKm = finite(entry?.fromKm, 'Interval start');
    const toKm = finite(entry?.toKm, 'Interval end');
    const expectedTo = Math.min(distanceKm, (index + 1) * 5);
    if (Math.abs(fromKm - index * 5) > EPSILON || Math.abs(toKm - expectedTo) > EPSILON) {
      throw new Error('Tactical intervals must cover the stage in exact 5 km steps.');
    }
    return {fromKm: index * 5, toKm: expectedTo, conditions: conditions(entry.conditions, 'Interval ' + (index + 1))};
  });
  const ids = new Set();
  const features = raw.features.map(entry => {
    const id = entry?.id;
    if (typeof id !== 'string' || !id.trim() || ids.has(id)) throw new Error('Stage feature ids must be unique.');
    ids.add(id);
    if (!FEATURE_KINDS.has(entry.kind)) throw new Error('Feature ' + id + ' has an unsupported kind.');
    const fromKm = finite(entry.fromKm, 'Feature ' + id + ' start');
    const toKm = finite(entry.toKm, 'Feature ' + id + ' end');
    if (fromKm < 0 || toKm > distanceKm || fromKm >= toKm) {
      throw new Error('Feature ' + id + ' must have a bounded positive span.');
    }
    const gradientPct = entry.gradientPct == null ? null : finite(entry.gradientPct, 'Feature ' + id + ' gradient');
    if (gradientPct != null && !['climb', 'descent'].includes(entry.kind)) {
      throw new Error('Feature ' + id + ' cannot carry a gradient.');
    }
    const label = entry.label == null ? null : String(entry.label).trim();
    if (label === '') throw new Error('Feature ' + id + ' label cannot be empty.');
    return {id, kind: entry.kind, fromKm, toKm, gradientPct, label};
  });
  const conditionSpans = (raw.conditionSpans ?? []).map(entry => {
    const id = entry?.id;
    if (typeof id !== 'string' || !id.trim() || ids.has(id)) {
      throw new Error('Stage condition span ids must be unique across stage data.');
    }
    ids.add(id);
    const fromKm = finite(entry.fromKm, 'Condition span ' + id + ' start');
    const toKm = finite(entry.toKm, 'Condition span ' + id + ' end');
    if (fromKm < 0 || toKm > distanceKm || fromKm >= toKm) {
      throw new Error('Condition span ' + id + ' must have a bounded positive span.');
    }
    return {id, fromKm, toKm, conditions: conditions(entry.conditions, 'Condition span ' + id)};
  }).sort((a, b) => a.fromKm - b.fromKm);
  for (let index = 1; index < conditionSpans.length; index++) {
    if (conditionSpans[index].fromKm < conditionSpans[index - 1].toKm - EPSILON) {
      throw new Error('Stage condition spans cannot overlap.');
    }
  }
  return {version: 3, distanceKm, tacticalIntervals, features, conditionSpans};
}

export function stageOverlayAtDistanceV3(overlay, distanceKm) {
  if (overlay?.version !== 3) throw new Error('Stage overlay version 3 is required.');
  const position = finite(distanceKm, 'Stage position');
  if (position < 0 || position > overlay.distanceKm) throw new Error('Stage position is outside the route.');
  const intervalIndex = Math.min(Math.floor(position / 5), overlay.tacticalIntervals.length - 1);
  const interval = overlay.tacticalIntervals[intervalIndex];
  if (!interval || position + EPSILON < interval.fromKm || position > interval.toKm + EPSILON) {
    throw new Error('Stage overlay interval is missing.');
  }
  const conditionSpan = (overlay.conditionSpans ?? []).find(span =>
    span.fromKm <= position && (position < span.toKm || position === overlay.distanceKm && span.toKm === position));
  return {
    distanceKm: position,
    tacticalInterval: interval,
    conditions: conditionSpan?.conditions ?? interval.conditions,
    conditionSpanId: conditionSpan?.id ?? null,
    features: overlay.features.filter(feature =>
      feature.fromKm <= position && (position < feature.toKm || position === overlay.distanceKm && feature.toKm === position)),
  };
}

export function stageOverlaySlicesForKilometreV3(overlay, kilometreIndex) {
  if (overlay?.version !== 3) throw new Error('Stage overlay version 3 is required.');
  if (!Number.isInteger(kilometreIndex) || kilometreIndex < 0 || kilometreIndex >= Math.ceil(overlay.distanceKm)) {
    throw new Error('Kilometre index is outside the route.');
  }
  const fromKm = kilometreIndex;
  const toKm = Math.min(kilometreIndex + 1, overlay.distanceKm);
  const boundaries = [fromKm, toKm];
  for (const feature of [...overlay.features, ...(overlay.conditionSpans ?? [])]) {
    if (feature.fromKm > fromKm && feature.fromKm < toKm) boundaries.push(feature.fromKm);
    if (feature.toKm > fromKm && feature.toKm < toKm) boundaries.push(feature.toKm);
  }
  const sorted = [...new Set(boundaries)].sort((a, b) => a - b);
  return sorted.slice(0, -1).map((start, index) => {
    const end = sorted[index + 1];
    const at = stageOverlayAtDistanceV3(overlay, (start + end) / 2);
    return {fromKm: start, toKm: end, distanceKm: end - start,
      tacticalInterval: at.tacticalInterval, conditions: at.conditions,
      conditionSpanId: at.conditionSpanId, features: at.features};
  });
}
