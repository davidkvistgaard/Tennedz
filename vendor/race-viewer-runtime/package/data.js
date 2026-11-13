// src/raceSceneData.js
var e = [
	"asphalt",
	"gravel",
	"cobbles",
	"dirt"
], t = [
	"sun",
	"overcast",
	"rain",
	"sleet"
];
function n(n, r, i) {
	let a = Number.isFinite, o = (e) => typeof e == "object" && !!e && !Array.isArray(e);
	if (n.route.surfaces !== void 0) {
		(!Array.isArray(n.route.surfaces) || n.route.surfaces.length > 256) && i("invalid route surfaces");
		let t = -1;
		for (let r of n.route.surfaces) (!o(r) || !a(r.from) || !a(r.to) || r.from < 0 || r.to <= r.from || r.from < t || !e.includes(r.type) || r.barriers !== void 0 && typeof r.barriers != "boolean") && i("invalid or overlapping route surface"), t = r.to;
	}
	if (n.weather !== void 0) {
		(!Array.isArray(n.weather) || !n.weather.length || n.weather.length > 1e3) && i("invalid weather frames");
		let e = -1;
		for (let r of n.weather) (!o(r) || !a(r.time) || r.time < 0 || r.time > n.duration || r.time <= e || !t.includes(r.condition) || r.intensity !== void 0 && (!a(r.intensity) || r.intensity < 0 || r.intensity > 1) || r.wind !== void 0 && (!Array.isArray(r.wind) || r.wind.length !== 2 || r.wind.some((e) => !a(e) || Math.abs(e) > 60))) && i("invalid weather frame"), e = r.time;
		n.weather[0].time !== 0 && i("weather must begin at zero");
	}
	if (n.crowd !== void 0) {
		let e = n.crowd;
		(!o(e) || e.enabled !== void 0 && typeof e.enabled != "boolean" || e.backgroundSpacing !== void 0 && (!a(e.backgroundSpacing) || e.backgroundSpacing < 8 || e.backgroundSpacing > 200) || e.seed !== void 0 && !Number.isSafeInteger(e.seed)) && i("invalid crowd settings"), e.zones !== void 0 && (!Array.isArray(e.zones) || e.zones.length > 128) && i("invalid crowd zones");
		let t = /* @__PURE__ */ new Set();
		for (let n of e.zones || []) (!o(n) || typeof n.id != "string" || !n.id || t.has(n.id) || !a(n.from) || !a(n.to) || n.from < 0 || n.to <= n.from || ![
			"normal",
			"town",
			"climb",
			"iconic",
			"finish"
		].includes(n.kind) || n.rows !== void 0 && (!Number.isInteger(n.rows) || n.rows < 1 || n.rows > 5) || n.spacing !== void 0 && (!a(n.spacing) || n.spacing < .65 || n.spacing > 50) || n.side !== void 0 && ![
			-1,
			1,
			"both"
		].includes(n.side) || n.barriers !== void 0 && typeof n.barriers != "boolean" || n.rowRise !== void 0 && (!a(n.rowRise) || n.rowRise < 0 || n.rowRise > .5)) && i("invalid crowd zone"), t.add(n.id);
	}
	if (n.crowd?.autoFinish !== void 0 && typeof n.crowd.autoFinish != "boolean" && i("invalid crowd settings"), n.incidents !== void 0) {
		(!Array.isArray(n.incidents) || n.incidents.length > 1e3) && i("invalid incidents");
		let e = /* @__PURE__ */ new Set(), t = /* @__PURE__ */ new Map();
		for (let s of n.incidents) {
			(!o(s) || typeof s.id != "string" || !s.id || e.has(s.id) || !["single", "mass"].includes(s.type) || !a(s.start) || !a(s.end) || s.start < 0 || s.end <= s.start || s.end > n.duration || !Array.isArray(s.riders) || !s.riders.length || s.riders.length > 160 || s.type === "single" && s.riders.length !== 1 || s.type === "mass" && s.riders.length < 2) && i("invalid crash incident"), e.add(s.id);
			let c = /* @__PURE__ */ new Map();
			for (let e of s.riders) {
				(!o(e) || !r.has(e.riderId) || c.has(e.riderId) || !a(e.fallAt) || e.fallAt < s.start || e.fallAt + (e.fallDuration ?? .65) > s.end || ![-1, 1].includes(e.side) || e.fallDuration !== void 0 && (!a(e.fallDuration) || e.fallDuration < .2 || e.fallDuration > 2) || e.downUntil !== void 0 && (!a(e.downUntil) || e.downUntil < e.fallAt + (e.fallDuration ?? .65) || e.downUntil > s.end) || e.recoveredAt !== void 0 && (!a(e.recoveredAt) || e.recoveredAt <= (e.downUntil ?? s.end) || e.recoveredAt > s.end)) && i("invalid crash participant"), c.set(e.riderId, e);
				let n = t.get(e.riderId) || [];
				n.push([e.fallAt, e.recoveredAt ?? s.end]), t.set(e.riderId, n);
			}
			for (let e of s.riders) e.causedByRiderId !== void 0 && (!c.has(e.causedByRiderId) || e.causedByRiderId === e.riderId || c.get(e.causedByRiderId).fallAt > e.fallAt) && i("invalid crash causality");
		}
		for (let e of t.values()) e.sort((e, t) => e[0] - t[0]), e.some((t, n) => n && t[0] < e[n - 1][1]) && i("overlapping rider incidents");
	}
}
function r(e, t) {
	return (e.surfaces || []).find((e) => t >= e.from && t < e.to)?.type || "asphalt";
}
function i(e, t) {
	let n = {
		time: 0,
		condition: "sun",
		intensity: 0,
		wind: [0, 0]
	};
	for (let r of e.weather || []) {
		if (r.time > t) break;
		n = r;
	}
	return {
		...n,
		intensity: n.intensity ?? (["rain", "sleet"].includes(n.condition) ? .65 : 0),
		wind: [...n.wind || [0, 0]]
	};
}
var a = (e) => (e = Math.max(0, Math.min(1, e)), e * e * (3 - 2 * e));
function o(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e.incidents || []) for (let e of n.riders) {
		let r = t.get(e.riderId) || [];
		r.push({
			incident: n,
			rider: e
		}), t.set(e.riderId, r);
	}
	for (let e of t.values()) e.sort((e, t) => e.rider.fallAt - t.rider.fallAt);
	return (n, r) => {
		for (let { incident: i, rider: o } of t.get(n) || []) {
			if (r < o.fallAt || r > (o.recoveredAt ?? i.end) || (o.recoveredAt !== void 0 || i.end < e.duration) && r === (o.recoveredAt ?? i.end)) continue;
			let t = a((r - o.fallAt) / (o.fallDuration ?? .65)), n = o.recoveredAt === void 0 ? 0 : a((r - (o.downUntil ?? i.end)) / (o.recoveredAt - (o.downUntil ?? i.end))), s = t * (1 - n);
			return {
				incidentId: i.id,
				type: i.type,
				causedByRiderId: o.causedByRiderId ?? null,
				fallAt: o.fallAt,
				side: o.side,
				amount: s,
				phase: n > 0 ? "remounting" : t < 1 ? "falling" : "down"
			};
		}
		return null;
	};
}
function s(e, t = (e) => {
	throw Error("Invalid route profile: " + e);
}) {
	let n = (e) => typeof e == "object" && !!e && !Array.isArray(e);
	n(e) && e.schemaVersion === "pelotonia.route-profile.v1" || t("unsupported schemaVersion"), (!Array.isArray(e.samples) || e.samples.length < 1 || e.samples.length > 2e4) && t("1–20000 distance/elevation samples required");
	let r = -Infinity;
	for (let n of e.samples) (!Array.isArray(n) || n.length !== 2 || !n.every(Number.isFinite) || n[0] < 0 || n[0] > 1e7 || Math.abs(n[1]) > 1e5 || n[0] <= r) && t("samples must be finite, increasing [distance,elevation] metres"), r = n[0];
	e.positionOffset !== void 0 && !Number.isFinite(e.positionOffset) && t("invalid positionOffset");
	for (let n of ["startName", "finishName"]) e[n] !== void 0 && (typeof e[n] != "string" || !e[n].trim() || e[n].length > 80) && t("invalid endpoint name");
	e.markers !== void 0 && (!Array.isArray(e.markers) || e.markers.length > 32) && t("at most 32 markers");
	let i = /* @__PURE__ */ new Set(), a = e.samples[0][0], o = e.samples.at(-1)[0];
	for (let r of e.markers || []) (!n(r) || typeof r.id != "string" || !r.id || i.has(r.id) || typeof r.name != "string" || !r.name.trim() || r.name.length > 80 || !Number.isFinite(r.distance) || r.distance < a || r.distance > o || ![
		"climb",
		"sprint",
		"place"
	].includes(r.type)) && t("invalid marker"), r.category === void 0 || r.type === "climb" && [
		"HC",
		"1",
		"2",
		"3",
		"4"
	].includes(r.category) || t("invalid climb category"), i.add(r.id);
	return e;
}
// src/results.js
function c(e, t, n) {
	if (e.results === void 0) return;
	let r = e.results;
	(!r || !Number.isFinite(r.publishedAt) || r.publishedAt < 0 || r.publishedAt > e.duration || !Array.isArray(r.entries) || !r.entries.length || r.entries.length > t.size) && n("invalid results publication");
	let i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set();
	for (let e of r.entries) {
		e && t.has(e.riderId) && !i.has(e.riderId) && [
			"finished",
			"dnf",
			"dns",
			"dsq"
		].includes(e.status) || n("invalid result rider or status"), i.add(e.riderId), e.status === "finished" ? ((!Number.isInteger(e.rank) || e.rank < 1 || e.rank > t.size || a.has(e.rank)) && n("invalid result rank"), a.add(e.rank)) : e.rank !== void 0 && n("unclassified result cannot have rank");
		for (let t of ["elapsed", "gap"]) e[t] !== void 0 && (!Number.isFinite(e[t]) || e[t] < 0) && n("invalid result time");
	}
}
function l(e, t) {
	let n = e.results;
	return !n || !Number.isFinite(t) || t < n.publishedAt ? null : {
		publishedAt: n.publishedAt,
		entries: n.entries.map((e) => ({ ...e })).sort((e, t) => (e.rank ?? Infinity) - (t.rank ?? Infinity))
	};
}
function u(e, t) {
	let n = t?.entries.find((e) => e.status === "finished" && e.rank === 1);
	if (!n) return null;
	let r = e.riders.find((e) => e.id === n.riderId);
	return r ? {
		entry: n,
		rider: r,
		team: e.teams.find((e) => e.id === r.teamId)
	} : null;
}
// src/sourceVelocity.js
function d(e, t, n, r = .25) {
	let i = (t) => {
		let n = 0, r = e.length - 1;
		for (; n + 1 < r;) {
			let i = n + r >> 1;
			e[i].time <= t ? n = i : r = i;
		}
		return {
			a: e[n],
			b: e[r],
			u: Math.max(0, Math.min(1, (t - e[n].time) / (e[r].time - e[n].time)))
		};
	}, a = Math.max(0, n - r), o = Math.min(t, n + r), s = i(a), c = i(o), l = (e, t) => {
		let n = e.a.byId.get(t), r = e.b.byId.get(t);
		if (!n && !r) return null;
		let i = n || r, a = r || n;
		return {
			distance: i.distance + (a.distance - i.distance) * e.u,
			lateral: i.lateral + (a.lateral - i.lateral) * e.u
		};
	};
	return (e) => {
		let t = l(s, e), n = l(c, e);
		return t && n && o > a ? {
			along: (n.distance - t.distance) / (o - a),
			across: (n.lateral - t.lateral) / (o - a)
		} : {
			along: 0,
			across: 0
		};
	};
}
// src/surfaceData.js
function f(e) {
	let t = e.length > 3 && e[0][0] === e.at(-1)[0] && e[0][2] === e.at(-1)[2] ? e.slice(0, -1) : e, n = t.length, r = (e, t, n) => (t[0] - e[0]) * (n[2] - e[2]) - (t[2] - e[2]) * (n[0] - e[0]), i = (e, t, n) => Math.abs(r(e, t, n)) < 1e-8 && n[0] >= Math.min(e[0], t[0]) - 1e-8 && n[0] <= Math.max(e[0], t[0]) + 1e-8 && n[2] >= Math.min(e[2], t[2]) - 1e-8 && n[2] <= Math.max(e[2], t[2]) + 1e-8;
	for (let e = 0; e < n; e++) {
		let a = t[e], o = t[(e + 1) % n];
		if (Math.hypot(a[0] - o[0], a[2] - o[2]) < 1e-7) return !1;
		for (let s = e + 1; s < n; s++) {
			if (s === e + 1 || e === 0 && s === n - 1) continue;
			let c = t[s], l = t[(s + 1) % n];
			if (Math.max(a[0], o[0]) < Math.min(c[0], l[0]) || Math.max(c[0], l[0]) < Math.min(a[0], o[0]) || Math.max(a[2], o[2]) < Math.min(c[2], l[2]) || Math.max(c[2], l[2]) < Math.min(a[2], o[2])) continue;
			let u = r(a, o, c), d = r(a, o, l), f = r(c, l, a), p = r(c, l, o);
			if (u * d < 0 && f * p < 0 || i(a, o, c) || i(a, o, l) || i(c, l, a) || i(c, l, o)) return !1;
		}
	}
	return !0;
}
// src/pedalling.js
function p(e, t) {
	let n = /* @__PURE__ */ new Map(), r = Math.PI / 30;
	for (let i of t) {
		let t = new Float64Array(e.length);
		for (let n = 0; n < e.length - 1; n++) {
			let a = e[n].byId.get(i.id), o = e[n + 1].byId.get(i.id), s = a || o, c = o || a;
			t[n + 1] = t[n] + ((s?.cadence ?? 88) + (c?.cadence ?? 88)) * .5 * (e[n + 1].time - e[n].time) * r;
		}
		n.set(i.id, t);
	}
	return (e, t, i, a, o, s) => n.get(e)[t] + (o * i + (s - o) * i * i / (2 * a)) * r;
}
// src/activity.js
var m = [
	"riding",
	"attacking",
	"pulling",
	"dropped",
	"caught",
	"protecting",
	"following",
	"bridging",
	"sprinting",
	"recovering",
	"celebrating",
	"throwing"
], h = [
	"attack",
	"pull",
	"follow",
	"protect",
	"bridge",
	"sprint",
	"recover",
	"hold"
], g = (e) => ({
	riding: "Riding",
	attacking: "Attacking",
	pulling: "Taking a pull",
	dropped: "Losing contact",
	caught: "Caught",
	protecting: "Protecting teammate",
	following: "Following a wheel",
	bridging: "Bridging",
	sprinting: "Sprinting",
	recovering: "Recovering",
	celebrating: "Winner celebration",
	throwing: "Throwing bike at the line",
	attack: "Attack",
	pull: "Take a pull",
	follow: "Follow",
	protect: "Protect",
	bridge: "Bridge",
	sprint: "Sprint",
	recover: "Recover",
	hold: "Hold position"
})[e] || e;
function _(e, t, n) {
	for (let [r, i, a] of [[
		"orders",
		h,
		"type"
	], [
		"actions",
		m,
		"state"
	]]) {
		if (e[r] === void 0) continue;
		(!Array.isArray(e[r]) || e[r].length > 5e4) && n(`invalid ${r}`);
		let o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Map();
		for (let c of e[r]) (!c || typeof c.id != "string" || !c.id || o.has(c.id) || !t.has(c.riderId) || !i.includes(c[a]) || !Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end <= c.start || c.end > e.duration) && n(`invalid ${r} interval`), (c.label !== void 0 && typeof c.label != "string" || c.targetRiderId !== void 0 && !t.has(c.targetRiderId) || c.targetGroupId !== void 0 && typeof c.targetGroupId != "string") && n(`invalid ${r} target or label`), r === "actions" && (c.effort !== void 0 && (!Number.isFinite(c.effort) || c.effort < 0 || c.effort > 1) || c.posture !== void 0 && !["seated", "standing"].includes(c.posture)) && n("invalid action appearance"), r !== "actions" || c.celebrationStyle === void 0 || c.state === "celebrating" && [
			"both-arms",
			"left-arm",
			"right-arm"
		].includes(c.celebrationStyle) || n("invalid celebration style"), r === "actions" && c.transitionOut !== void 0 && (c.state !== "celebrating" || !Number.isFinite(c.transitionOut) || c.transitionOut < 0 || c.transitionOut > Math.min(5, c.end - c.start)) && n("invalid celebration release"), o.add(c.id), s.has(c.riderId) || s.set(c.riderId, []), s.get(c.riderId).push(c);
		for (let e of s.values()) e.sort((e, t) => e.start - t.start), e.some((t, n) => n && t.start < e[n - 1].end) && n(`overlapping ${r} for rider`);
	}
}
function v(e) {
	let t = {};
	for (let n of ["orders", "actions"]) {
		let r = /* @__PURE__ */ new Map();
		for (let t of e[n] || []) r.has(t.riderId) || r.set(t.riderId, []), r.get(t.riderId).push(t);
		for (let e of r.values()) e.sort((e, t) => e.start - t.start);
		t[n] = r;
	}
	let n = (e, n, r) => {
		let i = t[e].get(n) || [], a = 0, o = i.length;
		for (; a < o;) {
			let e = a + o >> 1;
			i[e].start <= r ? a = e + 1 : o = e;
		}
		let s = i[a - 1];
		return !s || r >= s.end ? null : e === "orders" ? s : {
			action: s,
			actionTransition: {
				previous: i[a - 2]?.end === s.start ? i[a - 2] : null,
				next: i[a]?.start === s.end ? i[a] : null
			}
		};
	};
	return (e, t) => ({
		order: n("orders", e, t),
		...n("actions", e, t) || {
			action: null,
			actionTransition: null
		}
	});
}
// src/adapter.js
var y = "pelotonia.viewer.v1", b = (e, t, n) => Math.max(t, Math.min(n, e));
function x(e) {
	throw Error(`Invalid viewer feed: ${e}`);
}
function S(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function C(e) {
	return typeof e == "string" && e.length > 0 && (!e.includes(":") || /^https?:\/\//.test(e) || /^data:image\/(png|jpeg|webp);base64,/.test(e));
}
function w(e) {
	let t = (e) => typeof e == "object" && !!e && !Array.isArray(e);
	t(e) || x("feed must be an object");
	for (let n of [
		"route",
		"terrain",
		"finish",
		"results"
	]) e[n] !== void 0 && !t(e[n]) && x(`invalid ${n} object`);
	for (let n of [
		"teams",
		"riders",
		"frames",
		"jerseys",
		"helmets",
		"assets",
		"landmarks",
		"events",
		"orders",
		"actions",
		"spectators",
		"waterBodies"
	]) e[n] !== void 0 && (!Array.isArray(e[n]) || e[n].some((e) => !t(e))) && x(`invalid ${n} records`);
	for (let n of e.frames || []) (!Array.isArray(n.positions) || n.positions.some((e) => !t(e))) && x("invalid position records");
	e.route?.barriers !== void 0 && (!Array.isArray(e.route.barriers) || e.route.barriers.some((e) => !t(e))) && x("invalid route barriers"), e && e.schemaVersion === "pelotonia.viewer.v1" || x("unsupported schemaVersion"), e.riderCategory !== void 0 && !["men", "women"].includes(e.riderCategory) && x("riderCategory must be men or women"), (!S(e.duration) || e.duration <= 0) && x("duration must be positive"), (!Array.isArray(e.route?.points) || e.route.points.length < 2 || e.route.points.length > 2e4) && x("route needs 2–20000 points"), e.route.points.some((e) => !Array.isArray(e) || e.length !== 3 || !e.every((e) => S(e) && Math.abs(e) <= 1e6)) && x("route points must be finite [x,y,z] metres"), (!S(e.route.width) || e.route.width < 2 || e.route.width > 40) && x("route width must be 2–40 metres"), e.route.points.some((t) => t.some((t, n) => t !== e.route.points[0][n])) || x("route has zero length"), e.route.profile !== void 0 && s(e.route.profile, (e) => x("route profile: " + e)), (!Array.isArray(e.teams) || e.teams.length < 1) && x("teams required");
	for (let t of [
		e.route,
		e.terrain,
		...e.teams,
		...Array.isArray(e.route.surfaces) ? e.route.surfaces.filter((e) => e && typeof e == "object") : [],
		...Array.isArray(e.jerseys) ? e.jerseys : []
	].filter(Boolean)) t.textureUrl !== void 0 && !C(t.textureUrl) && x("invalid texture URL");
	e.route.barriers !== void 0 && (!Array.isArray(e.route.barriers) || e.route.barriers.some((e) => !S(e.from) || !S(e.to) || e.from < 0 || e.to <= e.from || ![1, -1].includes(e.side))) && x("invalid route barrier interval"), e.assets !== void 0 && (!Array.isArray(e.assets) || e.assets.some((e) => typeof e.id != "string" || (e.type === "foliage-card" ? !C(e.textureUrl) || !S(e.width) || !S(e.height) || e.width <= 0 || e.height <= 0 : e.type !== "gltf" || !C(e.url)))) && x("invalid scene asset");
	let r = new Set((e.assets || []).map((e) => e.id));
	r.size !== (e.assets || []).length && x("duplicate asset ID");
	for (let t of e.landmarks || []) t.assetId && !r.has(t.assetId) && x("unknown landmark asset ID");
	for (let t of [
		...e.teams,
		...Array.isArray(e.route.surfaces) ? e.route.surfaces.filter((e) => e && typeof e == "object") : [],
		...Array.isArray(e.jerseys) ? e.jerseys : []
	]) t.pattern === "paths" && (!Array.isArray(t.paths) || t.paths.length > 200 || t.paths.some((e) => typeof e != "string" || e.length > 2e4)) && x("invalid supplied kit paths");
	e.route.interpolation !== void 0 && !["polyline", "catmull-rom"].includes(e.route.interpolation) && x("unsupported route interpolation"), e.route.distanceStations !== void 0 && (!Array.isArray(e.route.distanceStations) || e.route.distanceStations.length !== e.route.points.length || e.route.distanceStations[0] !== 0 || e.route.distanceStations.some((t, n) => !S(t) || n && t <= e.route.distanceStations[n - 1])) && x("invalid route distance stations");
	let i = /* @__PURE__ */ new Set();
	for (let t of e.teams) (typeof t.id != "string" || i.has(t.id)) && x("duplicate/missing team ID"), i.add(t.id), t.pattern !== void 0 && ![
		"band",
		"chevron",
		"stripe",
		"polka",
		"paths"
	].includes(t.pattern) && x("invalid team pattern"), t.sponsor !== void 0 && typeof t.sponsor != "string" && x("invalid team sponsor"), typeof t.name == "string" && t.name.length || x("team name required"), /^#[0-9a-f]{6}$/i.test(t.color) && /^#[0-9a-f]{6}$/i.test(t.accent) || x("team colours must be six-digit hex");
	for (let t of ["jerseys", "helmets"]) {
		e[t] !== void 0 && !Array.isArray(e[t]) && x(`${t} must be an array`);
		let n = /* @__PURE__ */ new Set();
		for (let r of e[t] || []) (typeof r.id != "string" || n.has(r.id) || typeof r.name != "string" || !/^#[0-9a-f]{6}$/i.test(r.color)) && x(`invalid ${t} definition`), t !== "jerseys" || /^#[0-9a-f]{6}$/i.test(r.accent) && [
			"band",
			"chevron",
			"stripe",
			"polka",
			"paths"
		].includes(r.pattern) || x("invalid jersey design"), n.add(r.id);
	}
	(!Array.isArray(e.riders) || e.riders.length < 1 || e.riders.length > 160) && x("supported rider count is 1–160");
	let a = /* @__PURE__ */ new Set();
	for (let t of e.riders) (typeof t.id != "string" || a.has(t.id)) && x("duplicate/missing rider ID"), a.add(t.id), t.hairStyle !== void 0 && ![
		"none",
		"short",
		"tied"
	].includes(t.hairStyle) && x("invalid rider hairStyle"), t.hairColor === void 0 || typeof t.hairColor == "string" && /^#[0-9a-f]{6}$/i.test(t.hairColor) || x("invalid rider hairColor"), t.jersey !== null && t.jersey !== void 0 && t.jersey !== "leader" && !(e.jerseys || []).some((e) => e.id === t.jersey) && x("unknown jersey design"), t.helmet !== null && t.helmet !== void 0 && t.helmet !== "ranking" && !(e.helmets || []).some((e) => e.id === t.helmet) && x("unknown helmet design"), (typeof t.name != "string" || !Number.isInteger(t.number) || t.number < 1) && x("rider name and positive bib number required"), i.has(t.teamId) || x(`unknown team for ${t.id}`);
	(!Array.isArray(e.frames) || e.frames.length < 2 || e.frames.length > 2e4) && x("2–20000 frames required");
	let o = -Infinity;
	for (let n of e.frames) {
		n.groupRoles !== void 0 && (!t(n.groupRoles) || Object.values(n.groupRoles).some((e) => ![
			"leaders",
			"chase",
			"peloton",
			"dropped"
		].includes(e))) && x("invalid groupRoles"), (!S(n.time) || n.time <= o) && x("frame times must strictly increase"), o = n.time, n.gaps !== void 0 && (!n.gaps || typeof n.gaps != "object" || Array.isArray(n.gaps) || Object.values(n.gaps).some((e) => !S(e) || e < 0)) && x("gaps must contain nonnegative seconds");
		let e = /* @__PURE__ */ new Set();
		Array.isArray(n.positions) || x("frame positions required");
		for (let t of n.positions) (!a.has(t.riderId) || e.has(t.riderId)) && x("unknown/duplicate position rider ID"), e.add(t.riderId), S(t.distance) && S(t.lateral) || x("non-finite position"), typeof t.groupId != "string" && x("groupId required"), t.cadence !== void 0 && (!Number.isFinite(t.cadence) || t.cadence < 0 || t.cadence > 220) && x("cadence must be 0–220 rpm");
	}
	if (e.finish !== void 0) {
		let t = e.finish;
		(!t || typeof t != "object" || Array.isArray(t) || !S(t.routeFraction) || t.routeFraction < 0 || t.routeFraction > 1) && x("invalid finish routeFraction"), t.roadText !== void 0 && (typeof t.roadText != "string" || !t.roadText.trim() || t.roadText.length > 24) && x("invalid finish road text"), t.markers !== void 0 && (!Array.isArray(t.markers) || t.markers.length > 6 || t.markers.some((e) => !e || !S(e.distanceBefore) || e.distanceBefore <= 0 || e.distanceBefore > 5e3 || e.label !== void 0 && (typeof e.label != "string" || !e.label || e.label.length > 12))) && x("invalid finish markers"), t.portal !== void 0 && typeof t.portal != "boolean" && x("invalid finish portal visibility"), t.label !== void 0 && (typeof t.label != "string" || !t.label.length || t.label.length > 40) && x("invalid finish label");
		for (let e of ["color", "accent"]) t[e] !== void 0 && !/^#[0-9a-f]{6}$/i.test(t[e]) && x("invalid finish colour");
		for (let [e, n, r] of [
			[
				"barrierBefore",
				0,
				1e3
			],
			[
				"barrierAfter",
				0,
				100
			],
			[
				"portalHeight",
				3,
				12
			],
			[
				"portalScale",
				.1,
				10
			]
		]) t[e] !== void 0 && (!S(t[e]) || t[e] < n || t[e] > r) && x("invalid finish dimensions");
		t.portalAssetId !== void 0 && !(e.assets || []).some((e) => e.id === t.portalAssetId && e.type === "gltf") && x("unknown finish portal asset");
	}
	if (e.spectators !== void 0) {
		(!Array.isArray(e.spectators) || e.spectators.length > 300) && x("invalid spectators");
		for (let t of e.spectators) (!t || !Array.isArray(t.position) || t.position.length !== 3 || !t.position.every(S) || t.rotation !== void 0 && !S(t.rotation) || t.scale !== void 0 && (!S(t.scale) || t.scale < .5 || t.scale > 1.3) || t.pose !== void 0 && ![
			"standing",
			"clapping",
			"cheering"
		].includes(t.pose) || [t.color, t.skinColor].some((e) => e !== void 0 && !/^#[0-9a-f]{6}$/i.test(e))) && x("invalid spectator appearance or position");
	}
	if (n(e, a, x), _(e, a, x), c(e, a, x), (e.frames[0].time !== 0 || o < e.duration) && x("frames must cover the complete duration"), e.events !== void 0 && (!Array.isArray(e.events) || e.events.some((t) => !S(t.time) || t.riderId !== void 0 && !a.has(t.riderId) || typeof t.label != "string" || t.time < 0 || t.time > e.duration)) && x("invalid race event"), e.events?.some((t, n) => n && t.time < e.events[n - 1].time) && x("events must be chronological"), e.waterBodies !== void 0) {
		(!Array.isArray(e.waterBodies) || e.waterBodies.length > 32) && x("invalid water bodies");
		let t = /* @__PURE__ */ new Set();
		for (let n of e.waterBodies) {
			(!n || typeof n.id != "string" || n.label !== void 0 && typeof n.label != "string" || !n.id || t.has(n.id) || !Array.isArray(n.outline) || n.outline.length < 3 || n.outline.length > 1024 || n.color !== void 0 && !/^#[0-9a-f]{6}$/i.test(n.color)) && x("invalid water body"), n.outline.some((e) => !Array.isArray(e) || e.length !== 3 || !e.every(S) || e.some((e) => Math.abs(e) > 1e6) || Math.abs(e[1] - n.outline[0][1]) > .001) && x("water outline must have finite coplanar coordinates");
			let e = 0;
			n.outline.forEach((t, r) => {
				let i = n.outline[(r + 1) % n.outline.length];
				e += t[0] * i[2] - i[0] * t[2];
			}), Math.abs(e) < .01 && x("degenerate water outline"), f(n.outline) || x("water outline must not self-intersect"), t.add(n.id);
		}
	}
	let l = e.terrain;
	return l && (!Array.isArray(l.origin) || !Array.isArray(l.step) || l.origin.length !== 2 || l.step.length !== 2 || !l.origin.every(S) || !l.step.every((e) => S(e) && e > 0) || !Number.isInteger(l.columns) || !Number.isInteger(l.rows) || l.columns < 2 || l.rows < 2 || l.columns * l.rows > 1e6 || !Array.isArray(l.heights) || l.heights.length !== l.columns * l.rows || !l.heights.every(S)) && x("malformed terrain heightfield"), e.landmarks && (!Array.isArray(e.landmarks) || e.landmarks.some((e) => !Array.isArray(e.position) || e.position.length !== 3 || !e.position.every(S) || e.rotation !== void 0 && !S(e.rotation) || e.scale !== void 0 && (!S(e.scale) || e.scale <= 0 || e.scale > 10))) && x("invalid landmark position"), e;
}
function T(e) {
	w(e);
	let t = e.frames.map((e) => ({
		...e,
		byId: new Map(e.positions.map((e) => [e.riderId, e]))
	})), n = v(e), r = o(e), i = p(t, e.riders);
	return function(a) {
		let o = b(a, 0, e.duration), s = 0, c = t.length - 1;
		for (; s + 1 < c;) {
			let e = s + c >> 1;
			t[e].time <= o ? s = e : c = e;
		}
		let u = t[s], f = t[c], p = b((o - u.time) / (f.time - u.time), 0, 1), m = [], h = d(t, e.duration, o);
		for (let t of e.riders) {
			let e = u.byId.get(t.id), a = f.byId.get(t.id);
			if (!e && !a) continue;
			let c = e || a, l = a || e;
			m.push({
				...c,
				...n(t.id, o),
				crash: r(t.id, o),
				riderId: t.id,
				distance: c.distance + (l.distance - c.distance) * p,
				displaySpeed: (l.distance - c.distance) / (f.time - u.time),
				displayVelocity: h(t.id),
				lateral: c.lateral + (l.lateral - c.lateral) * p,
				groupId: p >= 1 ? l.groupId : c.groupId,
				cadence: (c.cadence ?? 88) + ((l.cadence ?? 88) - (c.cadence ?? 88)) * p,
				pedalAngle: i(t.id, s, o - u.time, f.time - u.time, c.cadence ?? 88, l.cadence ?? 88)
			});
		}
		return {
			time: o,
			results: l(e, o),
			positions: m,
			gaps: p >= 1 ? f.gaps : u.gaps,
			groupRoles: { ...p >= 1 ? f.groupRoles : u.groupRoles },
			events: (e.events || []).filter((e) => e.time <= o)
		};
	};
}
function E(e) {
	if (!e || ![
		e.position,
		e.serverEpochMs,
		e.rate,
		e.duration
	].every(S) || e.duration <= 0 || e.rate < 0 || typeof e.paused != "boolean") throw Error("Invalid broadcast clock");
	return e;
}
function D(e, t = Date.now()) {
	return E(e), b(e.position + (e.paused ? 0 : (t - e.serverEpochMs) / 1e3 * e.rate), 0, e.duration);
}
function O(e, t) {
	let n = e.teams.find((e) => e.id === t.teamId), r = (e.jerseys || []).find((e) => e.id === t.jersey), i = t.jersey === "leader" ? {
		name: "Leader jersey",
		color: "#edc951",
		accent: "#344c3c",
		pattern: "band"
	} : null, a = {
		...n,
		...r || i || {}
	}, o = (e.helmets || []).find((e) => e.id === t.helmet);
	return {
		team: n,
		kit: a,
		jerseyName: r?.name || i?.name || "Team jersey",
		helmetColor: o?.color || (t.helmet === "ranking" ? "#e6b648" : a.color),
		helmetName: o?.name || (t.helmet === "ranking" ? "Ranking helmet" : "Team helmet")
	};
}
// src/pelotoniaAdapter.js
function k(e, t, n) {
	if (t?.team_id !== e.id || !t.kit) throw Error("Club identity does not match team");
	let r = n.palettes?.[t.kit.palette], i = n.patterns?.[t.kit.pattern];
	if (!r || !i || !Array.isArray(i.paths)) throw Error("Missing supplied game kit catalogue entry");
	return {
		id: e.id,
		name: e.name,
		short: e.short,
		color: r.primary,
		accent: r.accent,
		pattern: "paths",
		paths: [...i.paths],
		sponsor: e.sponsor || "",
		sourceKit: { ...t.kit }
	};
}
function A({ raceId: e, riderCategory: t, replay: n, scene: r, teams: i, riders: a, distanceOriginM: o, lateralByRider: s = {}, orders: c = [], actions: l = [], events: u = [] }) {
	if (!Number.isFinite(o)) throw Error("Explicit distanceOriginM is required for atlas alignment");
	if (!Array.isArray(n?.frames) || n.frames.length < 2) throw Error("At least two recorded physical frames are required");
	let d = n.frames[0].elapsedSeconds;
	if (!Number.isFinite(d)) throw Error("Recorded elapsedSeconds missing");
	let f = /* @__PURE__ */ new Set(), p = n.frames.map((e) => {
		if (!Number.isFinite(e.elapsedSeconds)) throw Error("Recorded elapsedSeconds missing");
		let t = e.roadGroups || [], n = new Map(t.flatMap((e) => (e.riderIds || []).map((t) => [t, e]))), r = new Map((e.riders || []).map((e) => [e.riderId, e])), i = a.flatMap((e) => {
			let t = r.get(e.id), i = n.get(e.id), a = Number.isFinite(t?.positionM) ? t.positionM : i?.positionM;
			return Number.isFinite(a) ? (Number.isFinite(s[e.id]) || f.add(e.id), [{
				riderId: e.id,
				distance: a - o,
				lateral: s[e.id] ?? 0,
				groupId: i?.id || i?.kind || "unassigned"
			}]) : [];
		}), c = Object.fromEntries(t.filter((e) => e.role !== void 0).map((e) => [e.id || e.kind, e.role]));
		return {
			time: e.elapsedSeconds - d,
			positions: i,
			groupRoles: c
		};
	});
	return w({
		...r,
		schemaVersion: y,
		raceId: e,
		riderCategory: t ?? r.riderCategory,
		title: r.title,
		synthetic: !1,
		duration: p.at(-1).time,
		teams: i,
		riders: a,
		frames: p,
		orders: c,
		actions: l,
		events: u,
		sourceMetadata: {
			adapter: "pelotonia-physical-finale.v1",
			recordingVersion: n.version || null,
			status: n.status || null,
			sourceTimeOriginSeconds: d,
			distanceOriginM: o,
			missingLaneIds: [...f],
			officialResults: n.officialResults === !0
		}
	});
}
function j(e, { originKm: t, elevationsM: n, width: r, chainagesM: i }) {
	if (e?.coordinateSystem !== "pelotonia-local-km" || e.type !== "LineString" || !Array.isArray(e.coordinates)) throw Error("Expected supplied Pelotonia local-km LineString");
	if (!Array.isArray(t) || t.length !== 2 || !t.every(Number.isFinite) || !Array.isArray(n) || n.length !== e.coordinates.length || !n.every(Number.isFinite)) throw Error("Explicit local origin and per-vertex elevations required");
	if (i && (!Array.isArray(i) || i.length !== e.coordinates.length || i.some((e, t) => !Number.isFinite(e) || t && e <= i[t - 1]))) throw Error("Invalid supplied route chainages");
	return {
		points: e.coordinates.map((e, r) => {
			if (!Array.isArray(e) || e.length !== 2 || !e.every(Number.isFinite)) throw Error("Invalid atlas coordinate");
			return [
				(e[0] - t[0]) * 1e3,
				n[r],
				(e[1] - t[1]) * 1e3
			];
		}),
		width: r,
		interpolation: "polyline",
		...i ? {
			distanceStations: i.map((e) => e - i[0]),
			sourceDistanceOriginM: i[0]
		} : {},
		sourceCoordinateSystem: e.coordinateSystem,
		sourceOriginKm: [...t]
	};
}
function M(e) {
	if (e?.schemaVersion === "pelotonia.viewer.v1") return w(e);
	if (e?.exportVersion === "pelotonia.physical-export.v1") {
		if (!e.payload || typeof e.payload != "object") throw Error("Physical export payload missing");
		return A(e.payload);
	}
	throw Error("Unsupported import. Expected pelotonia.viewer.v1 or pelotonia.physical-export.v1");
}
// src/raceSession.js
function N({ load: e, onListenerError: t = () => {} }) {
	if (typeof t != "function") throw Error("Invalid listener error handler");
	if (typeof e != "function") throw Error("A race loader is required");
	let n = Object.freeze({
		status: "idle",
		active: null,
		error: null,
		pendingRaceId: null,
		requestedRaceId: null
	}), r = 0, i = null, a = !1, o = /* @__PURE__ */ new Set(), s = () => {
		for (let e of [...o]) try {
			e();
		} catch (e) {
			try {
				t(e);
			} catch {}
		}
	}, c = (e) => {
		n = Object.freeze(e), s();
	};
	function l(e, t, n = !0) {
		let { feed: r, clock: i, revision: a = 0, serverOffsetMs: o = 0 } = t || {};
		if (n && w(r), E(i), r.raceId !== e || i.duration !== r.duration || !Number.isSafeInteger(a) || a < 0 || !Number.isFinite(o)) throw Error("Race session identity, duration or revision mismatch");
		return Object.freeze({
			raceId: e,
			feed: r,
			clock: Object.freeze({ ...i }),
			revision: a,
			serverOffsetMs: o,
			connection: Object.freeze({ status: "unknown" })
		});
	}
	let u = {
		getSnapshot: () => n,
		subscribe(e) {
			if (typeof e != "function") throw Error("A subscriber is required");
			return a ? () => {} : (o.add(e), () => o.delete(e));
		},
		async open(t) {
			if (a) return !1;
			if (typeof t != "string" || !t) throw Error("A race ID is required");
			let o = ++r;
			i?.abort();
			let s = new AbortController();
			if (i = s, c({
				...n,
				status: "loading",
				pendingRaceId: t,
				requestedRaceId: t,
				error: null
			}), a || o !== r) return !1;
			let u;
			try {
				let n = await e(t, { signal: s.signal });
				if (a || o !== r) return !1;
				u = l(t, n);
			} catch (e) {
				return a || o !== r || (i = null, c({
					...n,
					status: "error",
					pendingRaceId: null,
					error: e instanceof Error ? e : Error(String(e))
				})), !1;
			}
			return i = null, c({
				status: "ready",
				active: u,
				error: null,
				pendingRaceId: null,
				requestedRaceId: t
			}), !0;
		},
		updateClock({ raceId: e, clock: t, revision: r, serverOffsetMs: i = n.active?.serverOffsetMs ?? 0 }) {
			let o = n.active;
			if (a || !o || e !== o.raceId) return !1;
			if (!Number.isSafeInteger(r) || r < 0) throw Error("Invalid clock revision");
			if (r <= o.revision) return !1;
			let s = l(e, {
				feed: o.feed,
				clock: t,
				revision: r,
				serverOffsetMs: i
			}, !1);
			return c({
				...n,
				active: Object.freeze({
					...s,
					connection: o.connection
				})
			}), !0;
		},
		setConnection({ raceId: e, status: t, message: r }) {
			if (a || !n.active || e !== n.active.raceId) return !1;
			if (![
				"unknown",
				"connected",
				"reconnecting",
				"offline"
			].includes(t) || r !== void 0 && (typeof r != "string" || r.length > 300)) throw Error("Invalid connection status");
			return c({
				...n,
				active: Object.freeze({
					...n.active,
					connection: Object.freeze({
						status: t,
						...r === void 0 ? {} : { message: r }
					})
				})
			}), !0;
		},
		retry() {
			return !a && n.requestedRaceId ? u.open(n.requestedRaceId) : Promise.resolve(!1);
		},
		close() {
			a || (r++, i?.abort(), i = null, c({
				status: "idle",
				active: null,
				error: null,
				pendingRaceId: null,
				requestedRaceId: null
			}));
		},
		dispose() {
			a || (a = !0, r++, i?.abort(), i = null, n = Object.freeze({
				status: "idle",
				active: null,
				error: null,
				pendingRaceId: null,
				requestedRaceId: null
			}), s(), o.clear());
		}
	};
	return u;
}
// src/assetReferences.js
function P(e) {
	let t = [], n = (e, n, r) => {
		e?.[n] && t.push({
			object: e,
			key: n,
			owner: r,
			url: e[n]
		});
	};
	for (let [t, r] of (e.route.surfaces || []).entries()) n(r, "textureUrl", `route.surface:${t}`);
	n(e.route, "textureUrl", "route"), n(e.terrain, "textureUrl", "terrain");
	for (let t of [
		"teams",
		"jerseys",
		"assets"
	]) for (let r of e[t] || []) n(r, "textureUrl", `${t}:${r.id}`), t === "assets" && n(r, "url", `assets:${r.id}`);
	return t;
}
function F(e) {
	return w(e), P(e).map(({ owner: e, url: t }) => ({
		owner: e,
		url: t
	}));
}
function I(e, t) {
	w(e);
	let n = new URL(t);
	if (!["https:", "http:"].includes(n.protocol)) throw Error("Asset base must be HTTP(S)");
	let r = structuredClone(e);
	for (let { object: e, key: t, url: i } of P(r)) e[t] = new URL(i, n).href;
	return w(r);
}
// src/raceLoader.js
var L = class extends Error {
	constructor(e, t) {
		super(t), this.name = "RaceLoadError", this.code = e;
	}
};
function R(e) {
	try {
		Promise.resolve(e?.cancel?.()).catch(() => {});
	} catch {}
}
async function z(e, t, n) {
	if (Number(e.headers?.get("content-length")) > t) throw R(e.body), new L("SIZE", "Race export exceeds the configured size limit");
	let r = "";
	if (e.body?.getReader) {
		let i = e.body.getReader(), a = new TextDecoder(), o = 0, s, c = new Promise((e, t) => {
			s = t;
		}), l = () => {
			R(i), s(new L("ABORTED", "Race export request was cancelled"));
		};
		n?.addEventListener("abort", l, { once: !0 });
		try {
			if (n?.aborted) throw new L("ABORTED", "Race export request was cancelled");
			for (;;) {
				let e = await Promise.race([i.read(), c]);
				if (e.done) break;
				if (o += e.value.byteLength, o > t) throw new L("SIZE", "Race export exceeds the configured size limit");
				r += a.decode(e.value, { stream: !0 });
			}
			r += a.decode();
		} catch (e) {
			throw R(i), e;
		} finally {
			n?.removeEventListener("abort", l);
			try {
				i.releaseLock();
			} catch {}
		}
	} else if (r = await e.text(), new TextEncoder().encode(r).byteLength > t) throw new L("SIZE", "Race export exceeds the configured size limit");
	try {
		return JSON.parse(r);
	} catch {
		throw new L("PARSE", "Race export is not valid JSON");
	}
}
function B({ urlForRace: e, fetchImpl: t = globalThis.fetch, requestInit: n = {}, resolveAssets: r = !0, maxBytes: i = 67108864, timeoutMs: a = 15e3 }) {
	if (!Number.isFinite(a) || a < 0) throw Error("Invalid loader timeout");
	if (typeof e != "function" || typeof t != "function" || !Number.isSafeInteger(i) || i <= 0) throw Error("Invalid race loader configuration");
	let o = async (a, { signal: o } = {}) => {
		let s = new URL(e(a));
		if (!["http:", "https:"].includes(s.protocol)) throw new L("URL", "Race export endpoint must use HTTP(S)");
		let c = await t(s.href, {
			...n,
			method: "GET",
			signal: o
		});
		if (!c.ok) throw new L("HTTP", `Race export request failed (${c.status})`);
		let l = await z(c, i, o), u;
		try {
			if (u = M(l.feed), E(l.clock), u.raceId !== a || l.clock.duration !== u.duration || !Number.isSafeInteger(l.revision) || l.revision < 0 || !Number.isFinite(l.serverOffsetMs ?? 0)) throw Error("Mismatch");
		} catch {
			throw new L("PAYLOAD", "Race export identity, data, clock or revision is invalid");
		}
		return r && (u = I(u, c.url || s.href)), {
			feed: u,
			clock: { ...l.clock },
			revision: l.revision,
			serverOffsetMs: l.serverOffsetMs ?? 0
		};
	};
	return async (e, { signal: t } = {}) => {
		if (t?.aborted) throw new L("ABORTED", "Race export request was cancelled");
		let n = new AbortController(), r, i = new Promise((e, t) => {
			r = t;
		}), s = () => {
			n.abort(), r(new L("ABORTED", "Race export request was cancelled"));
		};
		t?.addEventListener("abort", s, { once: !0 });
		let c = a ? setTimeout(() => {
			n.abort(), r(new L("TIMEOUT", "Race export request timed out"));
		}, a) : null;
		try {
			return await Promise.race([o(e, { signal: n.signal }), i]);
		} finally {
			c !== null && clearTimeout(c), t?.removeEventListener("abort", s), n.abort();
		}
	};
}
// src/preflight.js
function V(e) {
	try {
		w(e);
	} catch (e) {
		return {
			valid: !1,
			errors: [e.message],
			summary: null,
			assets: []
		};
	}
	let t = F(e), n = e.frames.reduce((e, t) => e + t.positions.length, 0);
	return {
		valid: !0,
		errors: [],
		summary: {
			raceId: e.raceId,
			riderCategory: e.riderCategory ?? "men",
			duration: e.duration,
			riderCount: e.riders.length,
			teamCount: e.teams.length,
			routePointCount: e.route.points.length,
			frameCount: e.frames.length,
			assetReferenceCount: t.length,
			uniqueAssetCount: new Set(t.map((e) => e.url)).size,
			relativeAssetCount: t.filter((e) => !/^https?:\/\/|^data:/i.test(e.url)).length,
			missingRiderSamples: e.frames.length * e.riders.length - n,
			hasTerrain: !!e.terrain,
			hasFinish: !!e.finish,
			hasOfficialResults: !!e.results
		},
		assets: t
	};
}
// src/broadcast.js
function H(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = t.get(n.groupId);
		e || (e = {
			id: n.groupId,
			count: 0,
			frontDistance: -Infinity
		}, t.set(e.id, e)), e.count++, e.frontDistance = Math.max(e.frontDistance, n.distance);
	}
	return [...t.values()].sort((e, t) => t.frontDistance - e.frontDistance || (e.id < t.id ? -1 : +(e.id > t.id)));
}
function U(e, t, n) {
	return !e.length || !Number.isFinite(t) ? null : Math.max(0, t * (n?.routeFraction ?? 1) - Math.max(...e.map((e) => e.distance)));
}
function W(e, t = {}) {
	let n = (e) => Object.hasOwn(t, e) ? t[e] : void 0, r = e.find((e) => n(e.id) === "peloton") || e.find((e) => e.id === "peloton"), i = e.filter((e) => !n(e.id) && !/^(breakaway|leaders?|chase|dropped|solo-attack)(-|$)/i.test(e.id)), a = r || i.reduce((e, t) => !e || t.count > e.count ? t : e, null), o = e.findIndex((e) => e.id === a?.id), s = 0, c = 0;
	return e.map((e, t) => {
		let r = n(e.id) || (e.id === a?.id ? "peloton" : /^dropped(?:-|$)/i.test(e.id) ? "dropped" : t === 0 ? "leaders" : o >= 0 && t > o ? "dropped" : "chase"), i = r === "chase" ? `chase group ${++s}` : r === "dropped" ? `dropped group ${++c}` : r;
		return {
			...e,
			role: r,
			label: i
		};
	});
}
function G(e) {
	if (!Number.isFinite(e)) return {
		value: "—",
		unit: "km"
	};
	let t = Math.max(0, e);
	return t >= 1e3 ? {
		value: (t / 1e3).toFixed(1),
		unit: "km"
	} : {
		value: String(Math.min(999, Math.round(t))),
		unit: "m"
	};
}
// src/commentary.js
var K = {
	"Approaching the hairpin": "Feltet nærmer sig hårnålesvinget. Vi følger rytterne gennem svinget.",
	"Through the switchback": "Rytterne er gennem hårnålesvinget og fortsætter ad ruten.",
	"Onto the upper road": "Løbet fortsætter på den øvre del af vejen."
}, q = {
	attack: ["{r} angriber! Et nyt angreb er sat ind.", "{r} sætter et angreb ind! Nu sker der noget på vejen."],
	pull: ["{r} tager en føring. Arbejdet fortsætter i front.", "{r} går frem og fører an."],
	caught: ["{r} er hentet igen. Angrebet er slut for denne gang.", "Så er {r} hentet. Kontakten er genetableret."],
	dropped: ["{r} mister kontakten. Der er nu afstand til gruppen.", "{r} bliver sat og må fortsætte bag gruppen."],
	sprint: ["{r} åbner spurten! Nu gælder det de sidste kræfter.", "Nu går {r} i spurt!"],
	protect: ["{r} arbejder for at beskytte sin holdkammerat."],
	celebration: ["{r} jubler!"],
	finish: ["{r} passerer målstregen."]
};
function J(e) {
	let t = new Map((e.riders || []).map((e) => [e.id, e]));
	return (e.events || []).map((n, r) => {
		let i = t.get(n.riderId), a = q[n.type], o = a && i ? a[r % a.length].replace("{r}", i.name) : e.synthetic && K[n.label] || n.label || "En ny hændelse er registreret.";
		if (!a) for (let [e, n] of t) o = o.replace(RegExp(`\\b${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), () => n.name);
		return {
			id: `event-${r}`,
			time: n.time,
			text: o,
			riderId: i?.id,
			event: n,
			index: r
		};
	}).sort((e, t) => e.time - t.time || e.index - t.index);
}
function Y(e, t, n = J(e)) {
	let r = n.filter((e) => e.time <= t), i = u(e, l(e, t));
	return i && r.push({
		id: "official-winner",
		time: e.results.publishedAt,
		text: `${i.rider.name} vinder løbet! Sejren er bekræftet i det officielle resultat.`,
		riderId: i.rider.id
	}), r.sort((e, t) => e.time - t.time);
}
export { m as ACTION_STATES, h as ORDER_TYPES, L as RaceLoadError, y as SCHEMA, g as activityLabel, j as adaptAtlasLineString, k as adaptClubIdentity, A as adaptPhysicalFinale, O as appearanceFor, D as broadcastTime, J as buildCommentary, F as collectAssetReferences, Y as commentaryAt, B as createRaceExportLoader, N as createRaceSession, T as createSampler, M as decodeViewerImport, U as finishRemaining, G as formatFinishDistance, V as inspectViewerFeed, W as labelRaceGroups, H as raceGroups, I as resolveFeedAssetUrls, l as resultsAt, r as surfaceAt, E as validateClock, w as validateFeed, i as weatherAt };
