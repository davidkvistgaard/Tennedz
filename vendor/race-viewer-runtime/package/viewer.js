"use client";
import e, { forwardRef as t, useEffect as n, useId as r, useImperativeHandle as i, useMemo as a, useRef as o, useState as s } from "react";
import * as c from "three";
import { BufferGeometry as l, CanvasTexture as u, Color as d, Euler as f, Float32BufferAttribute as p, Matrix4 as m, Quaternion as h, RepeatWrapping as g, ShapeUtils as _, Vector2 as v, Vector3 as y } from "three";
import { mergeGeometries as b } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader as x } from "three/addons/loaders/GLTFLoader.js";
import { Fragment as S, jsx as C, jsxs as w } from "react/jsx-runtime";
// src/viewer/selectionPolicy.js
function T(e, t, n, r) {
	e && (t || e.follow(n), r({ ...n }));
}
// src/raceSceneData.js
var E = [
	"asphalt",
	"gravel",
	"cobbles",
	"dirt"
], D = [
	"sun",
	"overcast",
	"rain",
	"sleet"
];
function O(e, t, n) {
	let r = Number.isFinite, i = (e) => typeof e == "object" && !!e && !Array.isArray(e);
	if (e.route.surfaces !== void 0) {
		(!Array.isArray(e.route.surfaces) || e.route.surfaces.length > 256) && n("invalid route surfaces");
		let t = -1;
		for (let a of e.route.surfaces) (!i(a) || !r(a.from) || !r(a.to) || a.from < 0 || a.to <= a.from || a.from < t || !E.includes(a.type) || a.barriers !== void 0 && typeof a.barriers != "boolean") && n("invalid or overlapping route surface"), t = a.to;
	}
	if (e.weather !== void 0) {
		(!Array.isArray(e.weather) || !e.weather.length || e.weather.length > 1e3) && n("invalid weather frames");
		let t = -1;
		for (let a of e.weather) (!i(a) || !r(a.time) || a.time < 0 || a.time > e.duration || a.time <= t || !D.includes(a.condition) || a.intensity !== void 0 && (!r(a.intensity) || a.intensity < 0 || a.intensity > 1) || a.wind !== void 0 && (!Array.isArray(a.wind) || a.wind.length !== 2 || a.wind.some((e) => !r(e) || Math.abs(e) > 60))) && n("invalid weather frame"), t = a.time;
		e.weather[0].time !== 0 && n("weather must begin at zero");
	}
	if (e.crowd !== void 0) {
		let t = e.crowd;
		(!i(t) || t.enabled !== void 0 && typeof t.enabled != "boolean" || t.backgroundSpacing !== void 0 && (!r(t.backgroundSpacing) || t.backgroundSpacing < 8 || t.backgroundSpacing > 200) || t.seed !== void 0 && !Number.isSafeInteger(t.seed)) && n("invalid crowd settings"), t.zones !== void 0 && (!Array.isArray(t.zones) || t.zones.length > 128) && n("invalid crowd zones");
		let a = /* @__PURE__ */ new Set();
		for (let e of t.zones || []) (!i(e) || typeof e.id != "string" || !e.id || a.has(e.id) || !r(e.from) || !r(e.to) || e.from < 0 || e.to <= e.from || ![
			"normal",
			"town",
			"climb",
			"iconic",
			"finish"
		].includes(e.kind) || e.rows !== void 0 && (!Number.isInteger(e.rows) || e.rows < 1 || e.rows > 5) || e.spacing !== void 0 && (!r(e.spacing) || e.spacing < .65 || e.spacing > 50) || e.side !== void 0 && ![
			-1,
			1,
			"both"
		].includes(e.side) || e.barriers !== void 0 && typeof e.barriers != "boolean" || e.rowRise !== void 0 && (!r(e.rowRise) || e.rowRise < 0 || e.rowRise > .5)) && n("invalid crowd zone"), a.add(e.id);
	}
	if (e.crowd?.autoFinish !== void 0 && typeof e.crowd.autoFinish != "boolean" && n("invalid crowd settings"), e.incidents !== void 0) {
		(!Array.isArray(e.incidents) || e.incidents.length > 1e3) && n("invalid incidents");
		let a = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map();
		for (let s of e.incidents) {
			(!i(s) || typeof s.id != "string" || !s.id || a.has(s.id) || !["single", "mass"].includes(s.type) || !r(s.start) || !r(s.end) || s.start < 0 || s.end <= s.start || s.end > e.duration || !Array.isArray(s.riders) || !s.riders.length || s.riders.length > 160 || s.type === "single" && s.riders.length !== 1 || s.type === "mass" && s.riders.length < 2) && n("invalid crash incident"), a.add(s.id);
			let c = /* @__PURE__ */ new Map();
			for (let e of s.riders) {
				(!i(e) || !t.has(e.riderId) || c.has(e.riderId) || !r(e.fallAt) || e.fallAt < s.start || e.fallAt + (e.fallDuration ?? .65) > s.end || ![-1, 1].includes(e.side) || e.fallDuration !== void 0 && (!r(e.fallDuration) || e.fallDuration < .2 || e.fallDuration > 2) || e.downUntil !== void 0 && (!r(e.downUntil) || e.downUntil < e.fallAt + (e.fallDuration ?? .65) || e.downUntil > s.end) || e.recoveredAt !== void 0 && (!r(e.recoveredAt) || e.recoveredAt <= (e.downUntil ?? s.end) || e.recoveredAt > s.end)) && n("invalid crash participant"), c.set(e.riderId, e);
				let a = o.get(e.riderId) || [];
				a.push([e.fallAt, e.recoveredAt ?? s.end]), o.set(e.riderId, a);
			}
			for (let e of s.riders) e.causedByRiderId !== void 0 && (!c.has(e.causedByRiderId) || e.causedByRiderId === e.riderId || c.get(e.causedByRiderId).fallAt > e.fallAt) && n("invalid crash causality");
		}
		for (let e of o.values()) e.sort((e, t) => e[0] - t[0]), e.some((t, n) => n && t[0] < e[n - 1][1]) && n("overlapping rider incidents");
	}
}
function k(e, t) {
	return (e.surfaces || []).find((e) => t >= e.from && t < e.to)?.type || "asphalt";
}
function A(e, t) {
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
var ee = (e) => (e = Math.max(0, Math.min(1, e)), e * e * (3 - 2 * e));
function te(e) {
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
		for (let { incident: i, rider: a } of t.get(n) || []) {
			if (r < a.fallAt || r > (a.recoveredAt ?? i.end) || (a.recoveredAt !== void 0 || i.end < e.duration) && r === (a.recoveredAt ?? i.end)) continue;
			let t = ee((r - a.fallAt) / (a.fallDuration ?? .65)), n = a.recoveredAt === void 0 ? 0 : ee((r - (a.downUntil ?? i.end)) / (a.recoveredAt - (a.downUntil ?? i.end))), o = t * (1 - n);
			return {
				incidentId: i.id,
				type: i.type,
				causedByRiderId: a.causedByRiderId ?? null,
				fallAt: a.fallAt,
				side: a.side,
				amount: o,
				phase: n > 0 ? "remounting" : t < 1 ? "falling" : "down"
			};
		}
		return null;
	};
}
// src/routeProfile.js
var ne = "pelotonia.route-profile.v1";
function re(e, t = (e) => {
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
function ie(e, t) {
	if (t <= e[0][0]) return e[0][1];
	if (t >= e.at(-1)[0]) return e.at(-1)[1];
	let n = 0, r = e.length - 1;
	for (; n + 1 < r;) {
		let i = n + r >> 1;
		e[i][0] <= t ? n = i : r = i;
	}
	let i = e[n], a = e[r];
	return i[1] + (a[1] - i[1]) * (t - i[0]) / (a[0] - i[0]);
}
function ae(e) {
	re(e);
	let t = e.samples.map((e) => [...e]), n = t[0][0], r = t.at(-1)[0];
	return {
		samples: t,
		start: n,
		end: r,
		length: r - n,
		positionOffset: e.positionOffset ?? 0,
		startName: e.startName || "Start",
		finishName: e.finishName || "Finish",
		minElevation: Math.min(...t.map((e) => e[1])),
		maxElevation: Math.max(...t.map((e) => e[1])),
		markers: (e.markers || []).map((e) => ({
			...e,
			elevation: ie(t, e.distance)
		})).sort((e, t) => e.distance - t.distance || e.id.localeCompare(t.id))
	};
}
function oe(e, t) {
	if (!t.length) return null;
	let n = Math.max(...t.map((e) => e.distance)) + e.positionOffset, r = Math.max(e.start, Math.min(e.end, n));
	return {
		distance: r,
		elevation: ie(e.samples, r),
		fraction: e.length ? (r - e.start) / e.length : 1
	};
}
function se(e) {
	let t = Math.max(20, e.maxElevation - e.minElevation), n = t / 3, r = 10 ** Math.floor(Math.log10(n)), i = [
		1,
		2,
		5,
		10
	].map((e) => e * r).find((e) => e >= n), a = Math.max(e.minElevation >= 0 ? 0 : -Infinity, Math.floor((e.minElevation - t * .08) / i) * i), o = Math.ceil((e.maxElevation + t * .08) / i) * i, s = [];
	for (let e = a; e <= o + i * .01; e += i) s.push(e);
	return {
		min: a,
		max: o,
		ticks: s
	};
}
// src/results.js
function ce(e, t, n) {
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
function j(e, t) {
	let n = e.results;
	return !n || !Number.isFinite(t) || t < n.publishedAt ? null : {
		publishedAt: n.publishedAt,
		entries: n.entries.map((e) => ({ ...e })).sort((e, t) => (e.rank ?? Infinity) - (t.rank ?? Infinity))
	};
}
function le(e, t) {
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
function ue(e, t, n, r = .25) {
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
function de(e) {
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
function fe(e, t) {
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
var pe = [
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
], me = [
	"attack",
	"pull",
	"follow",
	"protect",
	"bridge",
	"sprint",
	"recover",
	"hold"
], he = (e) => ({
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
function ge(e, t, n) {
	for (let [r, i, a] of [[
		"orders",
		me,
		"type"
	], [
		"actions",
		pe,
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
function _e(e) {
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
var M = (e) => {
	let t = Math.max(0, Math.min(1, e));
	return t * t * (3 - 2 * t);
}, ve = () => ({
	lift: 0,
	pitch: 0,
	roll: 0,
	effort: 0,
	standing: 0
});
function ye(e, t, n = 0, r, i) {
	if (!e) return ve();
	let a = r ?? t * 6 + n * .7, o = e.transitionOut ? M((e.end - t) / e.transitionOut) : 1;
	if (!i) return be(e, M((t - e.start) / .8) * M((e.end - t) / .8), e.state === "celebrating" ? M((t - e.start) / .7) * o : 0, a);
	let { previous: s, next: c } = i, l = Math.min(e.state === "celebrating" ? .7 : .8, e.end - e.start), u = M((t - e.start) / l), d = be(e, c ? 1 : M((e.end - t) / .8), e.state === "celebrating" ? o : 0, a), f = s ? be(s, 1, +(s.state === "celebrating" && !s.transitionOut), a) : ve();
	for (let e in d) {
		let t = f[e] ?? 0;
		d[e] = t + (d[e] - t) * u;
	}
	return d;
}
function be(e, t, n, r) {
	let i = e.posture === "standing" || !e.posture && ["attacking", "sprinting"].includes(e.state) ? t : 0, a = (e.effort ?? ([
		"attacking",
		"sprinting",
		"bridging"
	].includes(e.state) ? .9 : e.state === "pulling" ? .65 : .25)) * t;
	return {
		standing: i,
		effort: a,
		celebration: n,
		leftArm: e.celebrationStyle === "right-arm" ? 0 : n,
		rightArm: e.celebrationStyle === "left-arm" ? 0 : n,
		lift: e.state === "throwing" ? -.04 * t : i * (.05 + .008 * Math.cos(r * 2)),
		pitch: e.state === "throwing" ? .38 * t : n ? (e.celebrationStyle && e.celebrationStyle !== "both-arms" ? -.29 : -.65) * n : t * (e.state === "dropped" ? -.13 : e.state === "recovering" ? -.07 : i ? e.state === "sprinting" ? .18 : .1 : e.state === "pulling" ? .045 : 0),
		roll: Math.sin(r) * (i * (e.state === "sprinting" ? .04 : .025) + a * .006)
	};
}
// src/adapter.js
var xe = "pelotonia.viewer.v1", Se = (e, t, n) => Math.max(t, Math.min(n, e));
function N(e) {
	throw Error(`Invalid viewer feed: ${e}`);
}
function P(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function Ce(e) {
	return typeof e == "string" && e.length > 0 && (!e.includes(":") || /^https?:\/\//.test(e) || /^data:image\/(png|jpeg|webp);base64,/.test(e));
}
function F(e) {
	let t = (e) => typeof e == "object" && !!e && !Array.isArray(e);
	t(e) || N("feed must be an object");
	for (let n of [
		"route",
		"terrain",
		"finish",
		"results"
	]) e[n] !== void 0 && !t(e[n]) && N(`invalid ${n} object`);
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
	]) e[n] !== void 0 && (!Array.isArray(e[n]) || e[n].some((e) => !t(e))) && N(`invalid ${n} records`);
	for (let n of e.frames || []) (!Array.isArray(n.positions) || n.positions.some((e) => !t(e))) && N("invalid position records");
	e.route?.barriers !== void 0 && (!Array.isArray(e.route.barriers) || e.route.barriers.some((e) => !t(e))) && N("invalid route barriers"), e && e.schemaVersion === "pelotonia.viewer.v1" || N("unsupported schemaVersion"), e.riderCategory !== void 0 && !["men", "women"].includes(e.riderCategory) && N("riderCategory must be men or women"), (!P(e.duration) || e.duration <= 0) && N("duration must be positive"), (!Array.isArray(e.route?.points) || e.route.points.length < 2 || e.route.points.length > 2e4) && N("route needs 2–20000 points"), e.route.points.some((e) => !Array.isArray(e) || e.length !== 3 || !e.every((e) => P(e) && Math.abs(e) <= 1e6)) && N("route points must be finite [x,y,z] metres"), (!P(e.route.width) || e.route.width < 2 || e.route.width > 40) && N("route width must be 2–40 metres"), e.route.points.some((t) => t.some((t, n) => t !== e.route.points[0][n])) || N("route has zero length"), e.route.profile !== void 0 && re(e.route.profile, (e) => N("route profile: " + e)), (!Array.isArray(e.teams) || e.teams.length < 1) && N("teams required");
	for (let t of [
		e.route,
		e.terrain,
		...e.teams,
		...Array.isArray(e.route.surfaces) ? e.route.surfaces.filter((e) => e && typeof e == "object") : [],
		...Array.isArray(e.jerseys) ? e.jerseys : []
	].filter(Boolean)) t.textureUrl !== void 0 && !Ce(t.textureUrl) && N("invalid texture URL");
	e.route.barriers !== void 0 && (!Array.isArray(e.route.barriers) || e.route.barriers.some((e) => !P(e.from) || !P(e.to) || e.from < 0 || e.to <= e.from || ![1, -1].includes(e.side))) && N("invalid route barrier interval"), e.assets !== void 0 && (!Array.isArray(e.assets) || e.assets.some((e) => typeof e.id != "string" || (e.type === "foliage-card" ? !Ce(e.textureUrl) || !P(e.width) || !P(e.height) || e.width <= 0 || e.height <= 0 : e.type !== "gltf" || !Ce(e.url)))) && N("invalid scene asset");
	let n = new Set((e.assets || []).map((e) => e.id));
	n.size !== (e.assets || []).length && N("duplicate asset ID");
	for (let t of e.landmarks || []) t.assetId && !n.has(t.assetId) && N("unknown landmark asset ID");
	for (let t of [
		...e.teams,
		...Array.isArray(e.route.surfaces) ? e.route.surfaces.filter((e) => e && typeof e == "object") : [],
		...Array.isArray(e.jerseys) ? e.jerseys : []
	]) t.pattern === "paths" && (!Array.isArray(t.paths) || t.paths.length > 200 || t.paths.some((e) => typeof e != "string" || e.length > 2e4)) && N("invalid supplied kit paths");
	e.route.interpolation !== void 0 && !["polyline", "catmull-rom"].includes(e.route.interpolation) && N("unsupported route interpolation"), e.route.distanceStations !== void 0 && (!Array.isArray(e.route.distanceStations) || e.route.distanceStations.length !== e.route.points.length || e.route.distanceStations[0] !== 0 || e.route.distanceStations.some((t, n) => !P(t) || n && t <= e.route.distanceStations[n - 1])) && N("invalid route distance stations");
	let r = /* @__PURE__ */ new Set();
	for (let t of e.teams) (typeof t.id != "string" || r.has(t.id)) && N("duplicate/missing team ID"), r.add(t.id), t.pattern !== void 0 && ![
		"band",
		"chevron",
		"stripe",
		"polka",
		"paths"
	].includes(t.pattern) && N("invalid team pattern"), t.sponsor !== void 0 && typeof t.sponsor != "string" && N("invalid team sponsor"), typeof t.name == "string" && t.name.length || N("team name required"), /^#[0-9a-f]{6}$/i.test(t.color) && /^#[0-9a-f]{6}$/i.test(t.accent) || N("team colours must be six-digit hex");
	for (let t of ["jerseys", "helmets"]) {
		e[t] !== void 0 && !Array.isArray(e[t]) && N(`${t} must be an array`);
		let n = /* @__PURE__ */ new Set();
		for (let r of e[t] || []) (typeof r.id != "string" || n.has(r.id) || typeof r.name != "string" || !/^#[0-9a-f]{6}$/i.test(r.color)) && N(`invalid ${t} definition`), t !== "jerseys" || /^#[0-9a-f]{6}$/i.test(r.accent) && [
			"band",
			"chevron",
			"stripe",
			"polka",
			"paths"
		].includes(r.pattern) || N("invalid jersey design"), n.add(r.id);
	}
	(!Array.isArray(e.riders) || e.riders.length < 1 || e.riders.length > 160) && N("supported rider count is 1–160");
	let i = /* @__PURE__ */ new Set();
	for (let t of e.riders) (typeof t.id != "string" || i.has(t.id)) && N("duplicate/missing rider ID"), i.add(t.id), t.hairStyle !== void 0 && ![
		"none",
		"short",
		"tied"
	].includes(t.hairStyle) && N("invalid rider hairStyle"), t.hairColor === void 0 || typeof t.hairColor == "string" && /^#[0-9a-f]{6}$/i.test(t.hairColor) || N("invalid rider hairColor"), t.jersey !== null && t.jersey !== void 0 && t.jersey !== "leader" && !(e.jerseys || []).some((e) => e.id === t.jersey) && N("unknown jersey design"), t.helmet !== null && t.helmet !== void 0 && t.helmet !== "ranking" && !(e.helmets || []).some((e) => e.id === t.helmet) && N("unknown helmet design"), (typeof t.name != "string" || !Number.isInteger(t.number) || t.number < 1) && N("rider name and positive bib number required"), r.has(t.teamId) || N(`unknown team for ${t.id}`);
	(!Array.isArray(e.frames) || e.frames.length < 2 || e.frames.length > 2e4) && N("2–20000 frames required");
	let a = -Infinity;
	for (let n of e.frames) {
		n.groupRoles !== void 0 && (!t(n.groupRoles) || Object.values(n.groupRoles).some((e) => ![
			"leaders",
			"chase",
			"peloton",
			"dropped"
		].includes(e))) && N("invalid groupRoles"), (!P(n.time) || n.time <= a) && N("frame times must strictly increase"), a = n.time, n.gaps !== void 0 && (!n.gaps || typeof n.gaps != "object" || Array.isArray(n.gaps) || Object.values(n.gaps).some((e) => !P(e) || e < 0)) && N("gaps must contain nonnegative seconds");
		let e = /* @__PURE__ */ new Set();
		Array.isArray(n.positions) || N("frame positions required");
		for (let t of n.positions) (!i.has(t.riderId) || e.has(t.riderId)) && N("unknown/duplicate position rider ID"), e.add(t.riderId), P(t.distance) && P(t.lateral) || N("non-finite position"), typeof t.groupId != "string" && N("groupId required"), t.cadence !== void 0 && (!Number.isFinite(t.cadence) || t.cadence < 0 || t.cadence > 220) && N("cadence must be 0–220 rpm");
	}
	if (e.finish !== void 0) {
		let t = e.finish;
		(!t || typeof t != "object" || Array.isArray(t) || !P(t.routeFraction) || t.routeFraction < 0 || t.routeFraction > 1) && N("invalid finish routeFraction"), t.roadText !== void 0 && (typeof t.roadText != "string" || !t.roadText.trim() || t.roadText.length > 24) && N("invalid finish road text"), t.markers !== void 0 && (!Array.isArray(t.markers) || t.markers.length > 6 || t.markers.some((e) => !e || !P(e.distanceBefore) || e.distanceBefore <= 0 || e.distanceBefore > 5e3 || e.label !== void 0 && (typeof e.label != "string" || !e.label || e.label.length > 12))) && N("invalid finish markers"), t.portal !== void 0 && typeof t.portal != "boolean" && N("invalid finish portal visibility"), t.label !== void 0 && (typeof t.label != "string" || !t.label.length || t.label.length > 40) && N("invalid finish label");
		for (let e of ["color", "accent"]) t[e] !== void 0 && !/^#[0-9a-f]{6}$/i.test(t[e]) && N("invalid finish colour");
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
		]) t[e] !== void 0 && (!P(t[e]) || t[e] < n || t[e] > r) && N("invalid finish dimensions");
		t.portalAssetId !== void 0 && !(e.assets || []).some((e) => e.id === t.portalAssetId && e.type === "gltf") && N("unknown finish portal asset");
	}
	if (e.spectators !== void 0) {
		(!Array.isArray(e.spectators) || e.spectators.length > 300) && N("invalid spectators");
		for (let t of e.spectators) (!t || !Array.isArray(t.position) || t.position.length !== 3 || !t.position.every(P) || t.rotation !== void 0 && !P(t.rotation) || t.scale !== void 0 && (!P(t.scale) || t.scale < .5 || t.scale > 1.3) || t.pose !== void 0 && ![
			"standing",
			"clapping",
			"cheering"
		].includes(t.pose) || [t.color, t.skinColor].some((e) => e !== void 0 && !/^#[0-9a-f]{6}$/i.test(e))) && N("invalid spectator appearance or position");
	}
	if (O(e, i, N), ge(e, i, N), ce(e, i, N), (e.frames[0].time !== 0 || a < e.duration) && N("frames must cover the complete duration"), e.events !== void 0 && (!Array.isArray(e.events) || e.events.some((t) => !P(t.time) || t.riderId !== void 0 && !i.has(t.riderId) || typeof t.label != "string" || t.time < 0 || t.time > e.duration)) && N("invalid race event"), e.events?.some((t, n) => n && t.time < e.events[n - 1].time) && N("events must be chronological"), e.waterBodies !== void 0) {
		(!Array.isArray(e.waterBodies) || e.waterBodies.length > 32) && N("invalid water bodies");
		let t = /* @__PURE__ */ new Set();
		for (let n of e.waterBodies) {
			(!n || typeof n.id != "string" || n.label !== void 0 && typeof n.label != "string" || !n.id || t.has(n.id) || !Array.isArray(n.outline) || n.outline.length < 3 || n.outline.length > 1024 || n.color !== void 0 && !/^#[0-9a-f]{6}$/i.test(n.color)) && N("invalid water body"), n.outline.some((e) => !Array.isArray(e) || e.length !== 3 || !e.every(P) || e.some((e) => Math.abs(e) > 1e6) || Math.abs(e[1] - n.outline[0][1]) > .001) && N("water outline must have finite coplanar coordinates");
			let e = 0;
			n.outline.forEach((t, r) => {
				let i = n.outline[(r + 1) % n.outline.length];
				e += t[0] * i[2] - i[0] * t[2];
			}), Math.abs(e) < .01 && N("degenerate water outline"), de(n.outline) || N("water outline must not self-intersect"), t.add(n.id);
		}
	}
	let o = e.terrain;
	return o && (!Array.isArray(o.origin) || !Array.isArray(o.step) || o.origin.length !== 2 || o.step.length !== 2 || !o.origin.every(P) || !o.step.every((e) => P(e) && e > 0) || !Number.isInteger(o.columns) || !Number.isInteger(o.rows) || o.columns < 2 || o.rows < 2 || o.columns * o.rows > 1e6 || !Array.isArray(o.heights) || o.heights.length !== o.columns * o.rows || !o.heights.every(P)) && N("malformed terrain heightfield"), e.landmarks && (!Array.isArray(e.landmarks) || e.landmarks.some((e) => !Array.isArray(e.position) || e.position.length !== 3 || !e.position.every(P) || e.rotation !== void 0 && !P(e.rotation) || e.scale !== void 0 && (!P(e.scale) || e.scale <= 0 || e.scale > 10))) && N("invalid landmark position"), e;
}
function we(e) {
	F(e);
	let t = e.frames.map((e) => ({
		...e,
		byId: new Map(e.positions.map((e) => [e.riderId, e]))
	})), n = _e(e), r = te(e), i = fe(t, e.riders);
	return function(a) {
		let o = Se(a, 0, e.duration), s = 0, c = t.length - 1;
		for (; s + 1 < c;) {
			let e = s + c >> 1;
			t[e].time <= o ? s = e : c = e;
		}
		let l = t[s], u = t[c], d = Se((o - l.time) / (u.time - l.time), 0, 1), f = [], p = ue(t, e.duration, o);
		for (let t of e.riders) {
			let e = l.byId.get(t.id), a = u.byId.get(t.id);
			if (!e && !a) continue;
			let c = e || a, m = a || e;
			f.push({
				...c,
				...n(t.id, o),
				crash: r(t.id, o),
				riderId: t.id,
				distance: c.distance + (m.distance - c.distance) * d,
				displaySpeed: (m.distance - c.distance) / (u.time - l.time),
				displayVelocity: p(t.id),
				lateral: c.lateral + (m.lateral - c.lateral) * d,
				groupId: d >= 1 ? m.groupId : c.groupId,
				cadence: (c.cadence ?? 88) + ((m.cadence ?? 88) - (c.cadence ?? 88)) * d,
				pedalAngle: i(t.id, s, o - l.time, u.time - l.time, c.cadence ?? 88, m.cadence ?? 88)
			});
		}
		return {
			time: o,
			results: j(e, o),
			positions: f,
			gaps: d >= 1 ? u.gaps : l.gaps,
			groupRoles: { ...d >= 1 ? u.groupRoles : l.groupRoles },
			events: (e.events || []).filter((e) => e.time <= o)
		};
	};
}
function Te(e) {
	if (!e || ![
		e.position,
		e.serverEpochMs,
		e.rate,
		e.duration
	].every(P) || e.duration <= 0 || e.rate < 0 || typeof e.paused != "boolean") throw Error("Invalid broadcast clock");
	return e;
}
function Ee(e, t = Date.now()) {
	return Te(e), Se(e.position + (e.paused ? 0 : (t - e.serverEpochMs) / 1e3 * e.rate), 0, e.duration);
}
function De(e, t) {
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
// src/viewer/atmosphere.js
function Oe(e = "day", t = {
	condition: "sun",
	intensity: 0
}) {
	let n = e === "evening", r = t?.condition || "sun", i = ["rain", "sleet"].includes(r), a = i || r === "overcast";
	return {
		sky: a ? "#9aabb4" : n ? "#c2c5be" : "#a9c8d6",
		horizon: a ? "#c4cdc8" : n ? "#e2d4ba" : "#dbe2d4",
		fog: a ? "#bbc8c9" : n ? "#d9ccb9" : "#d2ded7",
		sunColor: a ? "#dae5ee" : n ? "#ffd1a4" : "#fff0d8",
		groundColor: "#65765e",
		sunIntensity: i ? 1.1 : a ? 1.65 : n ? 2.8 : 3.2,
		ambientIntensity: a ? 1.85 : 1.8,
		haze: i ? .14 : a ? .1 : n ? .08 : .045
	};
}
// src/viewer/geometry.js
var I = (e = 0, t = 0, n = 0) => new c.Vector3(e, t, n), L = class {
	constructor() {
		this.parts = [];
	}
	add(e, t, n = I(), r = I(), i = I(1, 1, 1)) {
		let a = new c.Matrix4().compose(n, new c.Quaternion().setFromEuler(new c.Euler(r.x, r.y, r.z)), i), o = e.index ? e.toNonIndexed() : e.clone();
		o.applyMatrix4(a);
		let s = new c.Color(t), l = new Float32Array(o.attributes.position.count * 3);
		for (let e = 0; e < l.length; e += 3) l[e] = s.r, l[e + 1] = s.g, l[e + 2] = s.b;
		return o.setAttribute("color", new c.BufferAttribute(l, 3)), o.deleteAttribute("uv"), this.parts.push(o), e.dispose(), this;
	}
	box(e, t, n, r, i = 0, a = 0, o = 0, s = 0) {
		return this.add(new c.BoxGeometry(e, t, n), r, I(i, a, o), I(0, s, 0));
	}
	ellipsoid(e, t, n, r, i, a, o, s = 10, l = 7) {
		return this.add(new c.SphereGeometry(1, s, l), r, I(i, a, o), I(), I(e, t, n));
	}
	rod(e, t, n, r, i = 6) {
		let a = t.clone().sub(e), o = new c.CylinderGeometry(n, n, a.length(), i);
		return o.applyQuaternion(new c.Quaternion().setFromUnitVectors(I(0, 1, 0), a.normalize())), this.add(o, r, e.clone().add(t).multiplyScalar(.5));
	}
	torus(e, t, n, r, i, a) {
		return this.add(new c.TorusGeometry(e, t, 5, 20), n, I(r, i, a), I(0, Math.PI / 2, 0));
	}
	build() {
		if (!this.parts.length) return new c.BufferGeometry();
		let e = b(this.parts, !1);
		return this.parts.forEach((e) => e.dispose()), this.parts = [], e.computeBoundingSphere(), e;
	}
}, R = () => new c.MeshStandardMaterial({
	vertexColors: !0,
	roughness: .84
});
function ke(e, { interpolation: t = "catmull-rom", distanceStations: n } = {}) {
	let r = t === "polyline" ? new c.CurvePath() : new c.CatmullRomCurve3(e.map((e) => I(...e)), !1, "centripetal");
	if (t === "polyline") for (let t = 1; t < e.length; t++) r.add(new c.LineCurve3(I(...e[t - 1]), I(...e[t])));
	r.arcLengthDivisions = Math.max(500, e.length * 12);
	let i = r.getLength(), a = n?.at(-1) ?? i;
	return {
		curve: r,
		length: a,
		geometryLength: i,
		at(i, o = 0) {
			let s = c.MathUtils.clamp(i, 0, a), l, u;
			if (n) {
				let i = 0, a = n.length - 1;
				for (; i + 1 < a;) {
					let e = i + a >> 1;
					n[e] <= s ? i = e : a = e;
				}
				let o = (s - n[i]) / (n[a] - n[i]), c = (i + o) / (e.length - 1);
				t === "polyline" ? (l = I(...e[i]).lerp(I(...e[a]), o), u = I(...e[a]).sub(I(...e[i])).normalize()) : (l = r.getPoint(c), u = r.getTangent(c).normalize());
			} else {
				let e = s / a;
				l = r.getPointAt(e), u = r.getTangentAt(e).normalize();
			}
			let d = I(u.z, 0, -u.x).normalize();
			return l.addScaledVector(d, o), {
				position: l,
				tangent: u,
				right: d,
				heading: Math.atan2(u.x, u.z)
			};
		}
	};
}
function z(e, t, n) {
	if (!e) return 0;
	let r = c.MathUtils.clamp((t - e.origin[0]) / e.step[0], 0, e.columns - 1), i = c.MathUtils.clamp((n - e.origin[1]) / e.step[1], 0, e.rows - 1), a = Math.min(e.columns - 2, Math.floor(r)), o = Math.min(e.rows - 2, Math.floor(i)), s = r - a, l = i - o, u = e.heights[o * e.columns + a], d = e.heights[o * e.columns + a + 1], f = e.heights[(o + 1) * e.columns + a], p = e.heights[(o + 1) * e.columns + a + 1];
	return u * (1 - s) * (1 - l) + d * s * (1 - l) + f * (1 - s) * l + p * s * l;
}
// src/viewer/roadFlags.js
var Ae = class {
	constructor(e, t, n) {
		this.scene = e, this.feed = t, this.route = n, this.flags = [], this.geometry = new c.BufferGeometry(), this.positions = /* @__PURE__ */ new Float32Array(432), this.geometry.setAttribute("position", new c.BufferAttribute(this.positions, 3)), this.material = new c.MeshStandardMaterial({
			color: "#c7b561",
			side: c.DoubleSide,
			roughness: 1
		}), this.mesh = new c.Mesh(this.geometry, this.material), this.mesh.frustumCulled = !1, e.add(this.mesh), this.poleGeometry = new c.BufferGeometry(), this.polePositions = /* @__PURE__ */ new Float32Array(144), this.poleGeometry.setAttribute("position", new c.BufferAttribute(this.polePositions, 3)), this.poleMaterial = new c.LineBasicMaterial({ color: "#e3dfcd" }), this.poles = new c.LineSegments(this.poleGeometry, this.poleMaterial), this.poles.frustumCulled = !1, e.add(this.poles);
	}
	update(e, t, n) {
		let r = this.route.length / (this.route.geometryLength || this.route.length), i = 34 * r, a = Math.ceil(Math.max(0, e - 170 * r) / i), o = Math.floor(Math.min(this.route.length, e + 170 * r) / i);
		this.flags = [];
		let s = [], c = 0;
		if (this.feed.crowd?.enabled) for (let e = a; e <= o; e++) for (let r of [-1, 1]) {
			if (c >= 24) break;
			let a = this.route.at(e * i, r * (this.feed.route.width / 2 + 3.8)).position;
			this.feed.terrain && (a.y = Math.max(a.y, z(this.feed.terrain, a.x, a.z)));
			let o = a.clone().add(I(0, 2.2, 0)), l = I(t.wind[0], 0, t.wind[1]), u = l.length(), d = u > .1 ? l.normalize() : this.route.at(e * i).tangent, f = Math.sin(n * (2 + u * .2) + e * 1.7) * Math.min(.25, .035 + u * .02), p = o.clone().addScaledVector(d, 1.1).add(I(0, -.1 + f, 0)), m = [
				o,
				p,
				p.clone().add(I(0, -.65, 0)),
				o.clone().add(I(0, -.65, 0))
			];
			[
				0,
				1,
				2,
				0,
				2,
				3
			].forEach((e, t) => m[e].toArray(this.positions, c * 18 + t * 3)), this.flags.push({
				points: m,
				pole: [a, o]
			}), s.push(...a.toArray(), ...o.toArray()), c++;
		}
		this.geometry.setDrawRange(0, c * 6), this.geometry.attributes.position.needsUpdate = !0, this.polePositions.fill(0), this.polePositions.set(s), this.poleGeometry.setDrawRange(0, c * 2), this.poleGeometry.attributes.position.needsUpdate = !0;
	}
	drawCPU(e) {
		for (let t of this.flags) {
			let n = e.project(t.points[0]);
			n && !e.surfaceDepth?.hidden(n) && (e.line(t.pole, "#e7dfc7", 1), e.polygon(t.points, "#cbb865"), e.line([t.points[0], t.points[1]], "#e4d494", 1));
		}
	}
	dispose() {
		for (let e of [this.mesh, this.poles]) this.scene.remove(e), e.geometry.dispose(), e.material.dispose();
	}
}, je = class {
	constructor(e) {
		this.scene = e, this.positions = /* @__PURE__ */ new Float32Array(8400), this.geometry = new c.BufferGeometry(), this.geometry.setAttribute("position", new c.BufferAttribute(this.positions, 3)), this.material = new c.LineBasicMaterial({
			color: "#dce6e5",
			transparent: !0,
			opacity: .45,
			depthWrite: !1
		}), this.mesh = new c.LineSegments(this.geometry, this.material), this.mesh.frustumCulled = !1, e.add(this.mesh), this.count = 0;
	}
	update(e, t, n) {
		this.state = e;
		let r = ["rain", "sleet"].includes(e.condition), i = Math.hypot(...e.wind), a = r ? Math.round(1400 * e.intensity) : i > 2 ? 140 : 0;
		this.count = a, this.mesh.visible = a > 0, this.material.opacity = r ? .22 + e.intensity * .3 : .1, this.material.color.set(e.condition === "sleet" ? "#eef2ed" : r ? "#c9d9df" : "#e1d4b1");
		for (let i = 0; i < a; i++) {
			let a = e.condition === "sleet" ? 6 : 13, o = (e, t) => (e % t + t) % t, s = o(i * 17.23 + e.wind[0] * t, 80) - 40, c = o(i * 29.17 + e.wind[1] * t, 80) - 40, l = r ? o(i * 7.33 - t * a, 35) : o(i * .73 + t * .5, 6), u = i * 6;
			this.positions[u] = n.x + s, this.positions[u + 1] = n.y + l, this.positions[u + 2] = n.z + c, this.positions[u + 3] = n.x + s - e.wind[0] * .04, this.positions[u + 4] = n.y + l + (r ? e.condition === "sleet" ? .14 : .7 : .03), this.positions[u + 5] = n.z + c - e.wind[1] * .04;
		}
		this.geometry.setDrawRange(0, a * 2), this.geometry.attributes.position.needsUpdate = !0;
	}
	drawCPU(e) {
		if (!this.count) return;
		let t = e.ctx;
		t.save(), t.globalAlpha = this.material.opacity;
		for (let t = 0; t < this.count; t++) {
			let n = t * 6, r = e.project(I(this.positions[n], this.positions[n + 1], this.positions[n + 2]));
			r && !e.surfaceDepth?.hidden(r) && e.line([I(this.positions[n], this.positions[n + 1], this.positions[n + 2]), I(this.positions[n + 3], this.positions[n + 4], this.positions[n + 5])], this.state.condition === "sleet" ? "#f0f2eb" : "#d1e0e5", this.state.condition === "sleet" ? 1.4 : .7);
		}
		t.restore();
	}
	dispose() {
		this.scene.remove(this.mesh), this.geometry.dispose(), this.material.dispose();
	}
}, Me = "0.98.4";
// src/viewer/cameraSafeArea.js
function Ne(e) {
	if (e !== void 0 && (!e || typeof e != "object" || Array.isArray(e))) throw Error("Invalid camera safe area");
	let t = {
		top: e?.top ?? 0,
		right: e?.right ?? 0,
		bottom: e?.bottom ?? 0,
		left: e?.left ?? 0
	};
	if (Object.values(t).some((e) => !Number.isFinite(e) || e < 0 || e > .8) || t.top + t.bottom > .8 || t.left + t.right > .8) throw Error("Invalid camera safe area");
	return t;
}
function Pe(e, t, n = e.aspect, r = 1) {
	!t.top && !t.right && !t.bottom && !t.left ? e.view?.enabled && e.clearViewOffset() : e.setViewOffset(n, r, (t.right - t.left) * n / 2, (t.bottom - t.top) * r / 2, n, r);
}
// src/routeCoverage.js
function Fe(e, t) {
	return e.distance >= 0 && e.distance <= t;
}
function Ie(e, t, n) {
	let r = [], i = [], a = 0;
	for (let n of e) n.distance < 0 ? r.push(n.riderId) : n.distance > t ? i.push(n.riderId) : a++;
	return {
		time: n,
		routeLength: t,
		availableRiderCount: a,
		beforeStartRiderIds: r,
		afterEndRiderIds: i
	};
}
function Le(e) {
	return e ? {
		...e,
		beforeStartRiderIds: [...e.beforeStartRiderIds],
		afterEndRiderIds: [...e.afterEndRiderIds]
	} : null;
}
// src/viewer/performance.js
var Re = class {
	constructor(e = 240) {
		this.limit = e, this.frames = 0, this.skipped = 0, this.samples = [], this.errors = [];
	}
	record(e) {
		this.frames++, this.samples.push({ ...e }), this.samples.length > this.limit && this.samples.shift();
	}
	skip() {
		this.skipped++;
	}
	error(e, t) {
		this.errors.push({
			kind: e,
			message: String(t).slice(0, 2e3)
		}), this.errors.length > 8 && this.errors.shift();
	}
	snapshot() {
		let e = (e) => {
			let t = this.samples.map((t) => t[e]).filter(Number.isFinite).sort((e, t) => e - t);
			return {
				samples: t.length,
				p50: t.length ? t[Math.floor((t.length - 1) * .5)] : null,
				p95: t.length ? t[Math.floor((t.length - 1) * .95)] : null,
				max: t.length ? t.at(-1) : null
			};
		};
		return {
			renderedFrames: this.frames,
			skippedFrames: this.skipped,
			cpuFrameMs: e("frameMs"),
			samplingMs: e("samplingMs"),
			rigMs: e("rigMs"),
			drawSubmissionMs: e("drawMs"),
			errors: this.errors.map((e) => ({ ...e }))
		};
	}
};
function ze(e, t) {
	return JSON.stringify([
		t,
		e.target?.type,
		e.target?.id,
		e.mode,
		e.zoom,
		e.yaw,
		e.light,
		!!e.shared,
		e.shared?.clock.paused ?? e.local?.paused,
		e.shared?.clock.rate ?? e.local?.rate,
		e.sceneRevision || 0,
		e.assetRevision || 0,
		e.assetContentRevision?.() || 0,
		e.viewportRevision || 0,
		e.safeArea?.top || 0,
		e.safeArea?.right || 0,
		e.safeArea?.bottom || 0,
		e.safeArea?.left || 0
	]);
}
// src/broadcast.js
function Be(e) {
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
function Ve(e, t, n) {
	return !e.length || !Number.isFinite(t) ? null : Math.max(0, t * (n?.routeFraction ?? 1) - Math.max(...e.map((e) => e.distance)));
}
function He(e, t = {}) {
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
function Ue(e) {
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
// src/viewer/cameraInput.js
function We(e, t, n) {
	let r = null, i = !1, a = {
		touchAction: e.style.touchAction,
		cursor: e.style.cursor
	};
	e.style.touchAction = "none", e.style.cursor = "grab";
	let o = {
		pointerdown(t) {
			t.button !== 0 || r || (i = !1, r = {
				id: t.pointerId,
				x: t.clientX,
				y: t.clientY,
				lastX: t.clientX,
				dragged: !1
			}, e.setPointerCapture?.(t.pointerId), e.focus({ preventScroll: !0 }));
		},
		pointermove(n) {
			if (!r || n.pointerId !== r.id) return;
			let i = n.clientX - r.lastX;
			r.lastX = n.clientX, Math.hypot(n.clientX - r.x, n.clientY - r.y) > 6 && (r.dragged = !0), r.dragged && (t.orbit(-i * .006), e.style.cursor = "grabbing");
		},
		pointerup(t) {
			r && t.pointerId === r.id && (i = r.dragged, r = null, e.style.cursor = "grab", e.hasPointerCapture?.(t.pointerId) && e.releasePointerCapture(t.pointerId));
		},
		pointercancel(t) {
			r && t.pointerId === r.id && (r = null, i = !0, e.style.cursor = "grab");
		},
		lostpointercapture(t) {
			r && t.pointerId !== r.id || (i ||= !!r?.dragged, r = null, e.style.cursor = "grab");
		},
		click(e) {
			i ? i = !1 : n(e);
		},
		wheel(e) {
			if (e.ctrlKey || e.metaKey) return;
			e.preventDefault();
			let n = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
			t.setZoom(t.zoom * Math.exp(Math.max(-.4, Math.min(.4, n * .001))));
		},
		keydown(e) {
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			let n = e.key.toLowerCase();
			if (n === "q") t.orbit(-Math.PI / 12);
			else if (n === "e") t.orbit(Math.PI / 12);
			else if (n === "+" || n === "=") t.setZoom(t.zoom - .15);
			else if (n === "-" || n === "_") t.setZoom(t.zoom + .15);
			else if (n === "home") t.resetCamera();
			else return;
			e.preventDefault();
		}
	};
	for (let [t, n] of Object.entries(o)) e.addEventListener(t, n, t === "wheel" ? { passive: !1 } : void 0);
	return () => {
		for (let [t, n] of Object.entries(o)) e.removeEventListener(t, n);
		let t = r?.id;
		r = null, t !== void 0 && e.hasPointerCapture?.(t) && e.releasePointerCapture(t), Object.assign(e.style, a);
	};
}
// src/viewer/cameraRig.js
var Ge = Math.atan2(46, Math.hypot(38, 57)), Ke = (e) => Math.atan2(Math.sin(e), Math.cos(e));
function qe(e, t = 1) {
	let n = Math.atan2(38, 57) + e, r = Math.hypot(38, 57) * t;
	return {
		x: Math.sin(n) * r,
		y: 46 * t,
		z: Math.cos(n) * r
	};
}
function Je(e, t, n) {
	let r = 1 - Math.exp(-Math.max(0, Math.min(n, .5)) * 3.8);
	return {
		yaw: Ke(e.yaw + Ke(t.yaw - e.yaw) * r),
		scale: e.scale + (t.scale - e.scale) * r
	};
}
function Ye(e, t, n, r, i, a = .12, o = {}) {
	if (!e.length) return .88;
	let s = qe(n), c = Math.hypot(s.x, s.y, s.z), l = {
		x: s.x / c,
		y: s.y / c,
		z: s.z / c
	}, u = Math.hypot(l.x, l.z), d = {
		x: l.z / u,
		y: 0,
		z: -l.x / u
	}, f = {
		x: l.y * d.z,
		y: l.z * d.x - l.x * d.z,
		z: -l.y * d.x
	}, p = Math.tan(r * Math.PI / 360) * (1 - a), m = p * (1 - (o.top || 0) - (o.bottom || 0)), h = p * i * (1 - (o.left || 0) - (o.right || 0)), g = 0;
	for (let n of e) {
		let e = n.position;
		for (let n of [-1.1, 1.1]) for (let r of [-.2, 2.5]) for (let i of [-1.1, 1.1]) {
			let a = e.x + n - t.x, o = e.y + r - t.y, s = e.z + i - t.z, c = a * l.x + o * l.y + s * l.z;
			g = Math.max(g, c + Math.abs(a * d.x + s * d.z) / h, c + Math.abs(a * f.x + o * f.y + s * f.z) / m);
		}
	}
	return Math.max(.88, g / c);
}
// src/viewer/cameraTargets.js
function Xe(e, t) {
	return e.filter((e) => t.type === "rider" ? e.rider.id === t.id : e.sample.groupId === t.id);
}
function Ze(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let t of e) n.set(t.groupId, (n.get(t.groupId) || 0) + 1);
	let r, i = -1;
	for (let [e, t] of n) (t > i || t === i && e < r) && (r = e, i = t);
	return i >= 0 ? {
		type: "group",
		id: r
	} : {
		type: "rider",
		id: t
	};
}
function Qe(e, t) {
	if (!t) return null;
	let n = e.at(e.length * t.routeFraction);
	return {
		position: n.position.clone(),
		yaw: Math.atan2(n.tangent.x, n.tangent.z) - Math.atan2(38, 57) + .55
	};
}
// src/viewer/cycleEquipment.js
var $e = Object.freeze([
	{
		a: [
			0,
			.6,
			-.055
		],
		b: [
			0,
			.76,
			-.13
		],
		radius: .035,
		color: "#e7e6d9"
	},
	{
		a: [
			0,
			.77,
			-.14
		],
		b: [
			0,
			.8,
			-.15
		],
		radius: .026,
		color: "#2f4245"
	},
	{
		a: [
			-.045,
			.57,
			-.035
		],
		b: [
			-.045,
			.78,
			-.15
		],
		radius: .006,
		color: "#7c8b87"
	},
	{
		a: [
			.045,
			.57,
			-.035
		],
		b: [
			.045,
			.78,
			-.15
		],
		radius: .006,
		color: "#7c8b87"
	},
	{
		a: [
			0,
			1.05,
			.51
		],
		b: [
			0,
			1.09,
			.54
		],
		radius: .026,
		color: "#293a40"
	},
	{
		a: [
			-.012,
			1.05,
			.52
		],
		b: [
			-.018,
			.88,
			.43
		],
		radius: .005,
		color: "#344348"
	}
].map(Object.freeze)), et = Object.freeze([-1, 1].flatMap((e) => [{
	a: [
		e * .105,
		1.48,
		.39
	],
	b: [
		e * .06,
		1.35,
		.4
	]
}, {
	a: [
		e * .06,
		1.35,
		.4
	],
	b: [
		e * .095,
		1.48,
		.24
	]
}]).map(Object.freeze));
function tt() {
	let e = /* @__PURE__ */ new Uint8Array(4096);
	for (let t = 0; t < 32; t++) for (let n = 0; n < 32; n++) {
		let r = (t * 32 + n) * 4, i = (n + t) % 2 ? 138 : 118;
		e[r] = e[r + 1] = e[r + 2] = i, e[r + 3] = 255;
	}
	let t = new c.DataTexture(e, 32, 32);
	return t.wrapS = t.wrapT = c.RepeatWrapping, t.repeat.set(18, 12), t.needsUpdate = !0, t;
}
// src/viewer/crashPose.js
function nt(e, t) {
	if (!t?.amount) return e;
	let n = t.amount;
	return {
		...e,
		lift: e.lift * (1 - n),
		pitch: e.pitch * (1 - n) - .08 * n,
		roll: e.roll * (1 - n) + t.side * 1.45 * n,
		leftArm: 0,
		rightArm: 0,
		celebration: 0
	};
}
function rt(e, t) {
	return t?.amount && e.premultiply(new e.constructor().makeTranslation(0, .28 * t.amount, -.05 * t.amount)), e;
}
function it(e, t, n) {
	return n?.amount ? e.lerp(new y(t * .08, .5, t < 0 ? -.15 : .22), n.amount) : e;
}
function at(e, t, n, r) {
	return r?.amount ? e.lerp(new y(t * .12, .95, .5 + t * .12).applyMatrix4(n), r.amount) : e;
}
// src/viewer/riderModel.js
var ot = Object.freeze({
	category: "men",
	shoulderHalfWidth: .13,
	hipHalfWidth: .12,
	armScale: 1,
	legScale: 1,
	headScale: 1,
	ringWidths: Object.freeze([
		1,
		1,
		1,
		1,
		1
	]),
	ringDepths: Object.freeze([
		1,
		1,
		1,
		1,
		1
	])
}), st = Object.freeze({
	category: "women",
	shoulderHalfWidth: .115,
	hipHalfWidth: .125,
	armScale: .9,
	legScale: .94,
	headScale: .97,
	ringWidths: Object.freeze([
		1.07,
		1.02,
		.94,
		.86,
		.87
	]),
	ringDepths: Object.freeze([
		1,
		.98,
		1.02,
		1,
		.98
	])
});
function B(e, t = {}) {
	let n = e?.riderCategory === "women" ? st : ot;
	return {
		...n,
		hairStyle: t.hairStyle ?? (n.category === "women" ? "tied" : "none"),
		hairColor: t.hairColor ?? "#514032"
	};
}
var V = Object.freeze([
	[
		0,
		1.445,
		.22
	],
	[
		0,
		1.385,
		.16
	],
	[
		0,
		1.31,
		.1
	]
].map(Object.freeze)), ct = [-1, 1].map((e) => Array.from({ length: 9 }, (t, n) => {
	let r = n / 8 * Math.PI;
	return [
		e * .23,
		.995 + Math.cos(r) * .055,
		.52 + Math.sin(r) * .095
	];
})), lt = [
	-.062,
	0,
	.062
].map((e) => {
	let t = Math.sqrt(1 - (e / .13) ** 2);
	return Array.from({ length: 9 }, (n, r) => {
		let i = -.95 + r / 8 * 1.9;
		return [
			e,
			1.51 + .094 * t * Math.cos(i),
			.35 + .174 * t * Math.sin(i)
		];
	});
}), ut = Array.from({ length: 9 }, (e, t) => Array.from({ length: 20 }, (e, n) => {
	let r = t / 8 * Math.PI, i = n / 20 * Math.PI * 2;
	return [
		.13 * Math.sin(r) * Math.cos(i),
		1.51 + .09 * Math.cos(r),
		.35 + .17 * Math.sin(r) * Math.sin(i)
	];
})).flat();
function dt(e) {
	let t = e.filter(Boolean).sort((e, t) => e.x - t.x || e.y - t.y), n = (e, t, n) => (t.x - e.x) * (n.y - e.y) - (t.y - e.y) * (n.x - e.x), r = (e) => {
		let t = [];
		for (let r of e) {
			for (; t.length > 1 && n(t.at(-2), t.at(-1), r) <= 0;) t.pop();
			t.push(r);
		}
		return t;
	};
	return [...r(t).slice(0, -1), ...r([...t].reverse()).slice(0, -1)];
}
var ft = Array.from({ length: 9 }, (e, t) => Array.from({ length: 16 }, (e, n) => {
	let r = t / 8 * Math.PI, i = n / 16 * Math.PI * 2;
	return [
		.105 * Math.sin(r) * Math.cos(i),
		1.43 + .12 * Math.cos(r),
		.37 + .12 * Math.sin(r) * Math.sin(i)
	];
})).flat(), H = .04, U = Object.freeze({
	radius: .335,
	tyreRadius: .028,
	axleHeight: .35,
	halfWheelbase: .56
}), pt = .001;
function mt(e) {
	return e.matrix ? new y().setFromMatrixPosition(e.matrix) : e.position.clone();
}
function ht(e, t, n, r = e.at(t.distance, t.lateral)) {
	let i = r.right.clone().cross(r.tangent).negate().normalize(), a = t.displayVelocity || {
		along: t.displaySpeed || 0,
		across: 0
	}, o = e.at(t.distance - a.along * .1, t.lateral - a.across * .1).position, s = e.at(t.distance + a.along * .1, t.lateral + a.across * .1).position.sub(o);
	s.addScaledVector(i, -s.dot(i)), s.lengthSq() < 1e-10 ? s.copy(r.tangent) : s.normalize();
	let c = i.clone().cross(s).normalize(), l = new h().setFromRotationMatrix(new m().makeBasis(c, i, s));
	t.crash?.amount && l.multiply(new h().setFromAxisAngle(new y(0, 1, 0), t.crash.side * .18 * t.crash.amount)), l.multiply(new h().setFromAxisAngle(new y(0, 0, 1), n));
	let u = U.tyreRadius - (U.axleHeight - U.radius) * Math.cos(n) + pt;
	t.crash?.amount && (u = Math.max(u, Math.abs(Math.sin(n)) * .17 - Math.cos(n) * .09 + .002));
	let d = r.position.clone().add(new y(0, H, 0)).addScaledVector(i, u), p = new f().setFromQuaternion(l, "YXZ");
	return {
		position: d,
		quaternion: l,
		heading: p.y,
		roadPitch: p.x,
		roll: p.z,
		up: i,
		forward: s
	};
}
// src/viewer/jerseySurface.js
var W = Object.freeze([
	{
		t: 0,
		width: .116,
		depth: .082
	},
	{
		t: .18,
		width: .125,
		depth: .09
	},
	{
		t: .52,
		width: .15,
		depth: .104
	},
	{
		t: .84,
		width: .169,
		depth: .098
	},
	{
		t: 1,
		width: .153,
		depth: .074
	}
]), G = 12;
function gt(e, t, n = B()) {
	let r = W.indexOf(e), i = e.width * (n.ringWidths[r] ?? 1), a = e.depth * (n.ringDepths[r] ?? 1), o = t / G * Math.PI * 2, s = -Math.cos(o) * a;
	return new y(Math.sin(o) * i, 1.035 + e.t * .265 + s * .797, -.145 + e.t * .355 - s * .595);
}
function _t(e = B()) {
	let t = [], n = [], r = [];
	W.forEach((i, a) => {
		for (let o = 0; o <= G; o++) if (t.push(...gt(i, o, e)), n.push(o / G, i.t), a < W.length - 1 && o < G) {
			let e = a * 13 + o, t = e + G + 1;
			r.push(e, e + 1, t, e + 1, t + 1, t);
		}
	});
	let i = t.length / 3, a = (W.length - 1) * 13;
	for (let e = 0; e <= G; e++) {
		let o = e / G * Math.PI * 2, s = -Math.cos(o) * .033;
		if (t.push(Math.sin(o) * .052, 1.31 + s * .797, .224 - s * .595), n.push(e / G, .98), e < G) {
			let t = a + e, n = i + e;
			r.push(t, t + 1, n, t + 1, n + 1, n);
		}
	}
	let o = new l();
	o.setAttribute("position", new p(t, 3)), o.setAttribute("uv", new p(n, 2)), o.setIndex(r), o.computeVertexNormals();
	let s = o.attributes.normal;
	for (let e = 0; e < W.length; e++) {
		let t = e * 13, n = t + G, r = new y().fromBufferAttribute(s, t).add(new y().fromBufferAttribute(s, n)).normalize();
		s.setXYZ(t, ...r), s.setXYZ(n, ...r);
	}
	return o.computeBoundingSphere(), o;
}
var vt = /* @__PURE__ */ new Map();
function yt(e = B()) {
	if (vt.has(e.category)) return vt.get(e.category);
	let t = _t(e), n = Object.freeze(Array.from({ length: t.index.count / 3 }, (e, n) => {
		let r = [
			0,
			1,
			2
		].map((e) => t.index.getX(n * 3 + e));
		return {
			points: r.map((e) => new y().fromBufferAttribute(t.attributes.position, e)),
			uv: r.map((e) => ({
				x: t.attributes.uv.getX(e),
				y: 1 - t.attributes.uv.getY(e)
			}))
		};
	}));
	return t.dispose(), vt.set(e.category, n), n;
}
yt();
function bt(e, t) {
	return e.clone().lerp(t, .34);
}
var xt = Object.freeze([
	0,
	1.257,
	-.024
]), St = Object.freeze([
	0,
	.797,
	-.595
]);
function Ct(e, t) {
	return new y(-e * .7, t * .55 * .595, t * .55 * .797).add(new y(...xt));
}
// src/viewer/kinematics.js
function K(e, t, n, r, i, a = new y()) {
	let o = t.x - e.x, s = t.y - e.y, c = t.z - e.z, l = Math.max(1e-8, Math.hypot(o, s, c)), u = o / l, d = s / l, f = c / l, p = Math.max(Math.abs(n - r) + 1e-7, Math.min(n + r - 1e-7, l)), m = i.x * u + i.y * d + i.z * f, h = i.x - u * m, g = i.y - d * m, _ = i.z - f * m, v = Math.hypot(h, g, _);
	if (v < 1e-7) {
		let e = +(Math.abs(u) < .8), t = +!e, n = e * u + t * d;
		h = e - u * n, g = t - d * n, _ = -f * n, v = Math.hypot(h, g, _) || 1;
	}
	let b = (n * n - r * r + p * p) / (2 * p), x = Math.sqrt(Math.max(0, n * n - b * b));
	return a.set(e.x + u * b + h / v * x, e.y + d * b + g / v * x, e.z + f * b + _ / v * x);
}
function wt(e, t, n = 0) {
	return (e.pedalAngle ?? t * (e.cadence ?? 88) * Math.PI / 30) + n * .7;
}
function Tt(e = 0, t = 0) {
	return new m().makeTranslation(0, 1.01 + e, -.14).multiply(new m().makeRotationX(t)).multiply(new m().makeTranslation(0, -1.01, .14));
}
function Et(e, t, n = 0) {
	if (!Number.isFinite(n) || n <= 0) return 0;
	let r = Math.max(0, t - 2), i = Math.min(e.length, t + 2);
	if (i - r < .01) return 0;
	let a = e.at(r).tangent, o = e.at(i).tangent, s = Math.atan2(a.z * o.x - a.x * o.z, a.x * o.x + a.z * o.z), c = -Math.atan(n * n * s / ((i - r) * 9.81));
	return Math.max(-.28, Math.min(.28, c));
}
function Dt(e, t, n = 0, r = { shoulderHalfWidth: .13 }) {
	let i = new y(e * r.shoulderHalfWidth, 1.3, .21).applyMatrix4(t).add(new y(e * .28, .44, .04));
	return new y(e * .22, 1.04, .54).lerp(i, n);
}
var q = Object.freeze({
	bottomBracket: .29,
	crankLength: .17,
	pedalHalfWidth: .11,
	upperLeg: .49,
	lowerLeg: .49
});
function Ot(e, t) {
	return new y(e * q.pedalHalfWidth, q.bottomBracket + Math.cos(t) * q.crankLength, Math.sin(t) * q.crankLength);
}
// src/viewer/imageDimensions.js
function kt(e) {
	let t = e?.naturalWidth ?? e?.width, n = e?.naturalHeight ?? e?.height;
	return Number.isFinite(t) && Number.isFinite(n) && t > 0 && n > 0;
}
// src/viewer/textureAssets.js
var At = class {
	constructor(e = new c.ImageLoader(), { timeoutMs: t = 3e4 } = {}) {
		if (!Number.isFinite(t) || t < 1 || t > 12e4) throw Error("Invalid texture timeout");
		this.timeoutMs = t, this.loader = e, this.entries = /* @__PURE__ */ new Map(), this.disposed = !1, this.revision = 0, this.localErrors = /* @__PURE__ */ new Map();
	}
	apply(e, t, n = "texture") {
		if (!t || this.disposed) return e;
		let r = this.entries.get(t);
		if (r) return r.textures.add(e), r.assetIds.add(n), r.image && (e.image = r.image, e.needsUpdate = !0), e;
		let i;
		r = {
			assetId: n,
			assetIds: /* @__PURE__ */ new Set([n]),
			url: t,
			textures: /* @__PURE__ */ new Set([e]),
			state: "pending",
			promise: new Promise((e) => {
				i = () => {
					clearTimeout(r.timer), this.revision++, e();
				};
			})
		}, this.entries.set(t, r), r.finish = i, r.timer = setTimeout(() => {
			this.disposed || r.state !== "pending" || (r.state = "error", r.errorMessage = "Texture request timed out; procedural preview retained", i());
		}, this.timeoutMs);
		try {
			this.loader.load(t, (e) => {
				if (!(this.disposed || r.state !== "pending")) {
					if (!kt(e)) r.state = "error", r.errorMessage = "Texture decoded without valid dimensions; procedural preview retained", i();
					else {
						for (let t of r.textures) t.image = e, t.needsUpdate = !0;
						r.image = e, r.state = "loaded", i();
					}
				}
			}, void 0, () => {
				this.disposed || r.state !== "pending" || (r.state = "error", i());
			});
		} catch {
			r.state === "pending" && (r.state = "error", i());
		}
		return e;
	}
	reportError(e, t) {
		this.disposed || (this.localErrors.set(e, {
			assetId: e,
			message: t
		}), this.revision++);
	}
	get ready() {
		return Promise.all([...this.entries.values()].map((e) => e.promise));
	}
	status() {
		let e = [...this.entries.values()];
		return {
			pending: e.filter((e) => e.state === "pending").length,
			loaded: e.filter((e) => e.state === "loaded").length,
			errors: [...this.localErrors.values()].map((e) => ({ ...e })).concat(e.filter((e) => e.state === "error").flatMap((e) => [...e.assetIds].map((t) => ({
				assetId: t,
				message: e.errorMessage || "Texture request failed; procedural preview retained"
			}))))
		};
	}
	dispose() {
		this.disposed = !0;
		for (let e of this.entries.values()) e.state === "pending" && (e.state = "cancelled"), e.textures.clear(), e.finish();
		this.entries.clear(), this.localErrors.clear();
	}
}, jt = class {
	constructor(e, t) {
		this.riders = t;
		let n = document.createElement("canvas");
		n.width = 1024, n.height = Math.ceil(t.length / 16) * 64;
		let r = n.getContext("2d");
		r.fillStyle = "#efeedd", r.fillRect(0, 0, n.width, n.height), r.textAlign = "center", r.textBaseline = "middle", r.fillStyle = "#233c34", r.font = "bold 39px sans-serif", t.forEach((e, t) => r.fillText(String(e.number), t % 16 * 64 + 32, Math.floor(t / 16) * 64 + 31));
		let i = new c.CanvasTexture(n);
		i.colorSpace = c.SRGBColorSpace;
		let a = new Float32Array(t.length * 18), o = new Float32Array(t.length * 12), s = [
			[-.12, -.12],
			[.12, -.12],
			[.12, .12],
			[-.12, -.12],
			[.12, .12],
			[-.12, .12]
		];
		this.local = s.map(([e, t]) => Ct(e, t));
		for (let e = 0; e < t.length; e++) s.forEach(([n, r], i) => {
			o[e * 12 + i * 2] = (e % 16 + (n / .24 + .5)) / 16, o[e * 12 + i * 2 + 1] = 1 - (Math.floor(e / 16) + (1 - (r / .24 + .5))) / Math.ceil(t.length / 16);
		});
		let l = new c.BufferGeometry();
		l.setAttribute("position", new c.BufferAttribute(a, 3).setUsage(c.DynamicDrawUsage)), l.setAttribute("uv", new c.BufferAttribute(o, 2)), l.computeVertexNormals(), this.mesh = new c.Mesh(l, new c.MeshBasicMaterial({
			map: i,
			side: c.FrontSide,
			polygonOffset: !0,
			polygonOffsetFactor: -1
		})), this.mesh.frustumCulled = !1, e.add(this.mesh), this.scene = e;
	}
	update(e, t = null) {
		let n = this.mesh.geometry.attributes.position;
		this.riders.forEach((r, i) => {
			let a = t && !t.has(r.id) ? null : e.get(r.id);
			for (let e = 0; e < 6; e++) {
				let t = a ? this.local[e].clone().applyMatrix4(a.upperMatrix || a.matrix) : I(0, -1e4, 0);
				n.setXYZ(i * 6 + e, t.x, t.y, t.z);
			}
		}), n.needsUpdate = !0;
	}
	dispose() {
		this.scene.remove(this.mesh), this.mesh.dispose?.(), this.mesh.geometry.dispose(), this.mesh.material.map.dispose(), this.mesh.material.dispose();
	}
}, Mt = (e) => Math.max(0, Math.min(255, Math.round(e))), Nt = (e, t) => {
	let n = Math.imul(e + 13, 374761393) ^ Math.imul(t + 79, 668265263);
	return n = Math.imul(n ^ n >>> 13, 1274126177), ((n ^ n >>> 16) >>> 0) / 4294967295;
};
function Pt(e, t = 512) {
	let n = new Uint8ClampedArray(t * t * 4);
	for (let r = 0; r < t; r++) for (let i = 0; i < t; i++) {
		let a = i / t, o = r / t, s = Nt(i, r), c = (s - .5) * 14, l;
		if (e === "cobbles") {
			let e = Math.floor(o * 16), t = (a * 8 + e % 2 * .5) % 1, n = o * 16 % 1, r = Math.min(t, 1 - t, n, 1 - n), i = Math.min(1, Math.max(0, (r - .025) / .065)), s = 110 + Nt(Math.floor(a * 8 + e % 2 * .5), e) * 32, u = n < .15 ? 8 : n > .83 ? -8 : 0, d = 53 + (s + c + u - 53) * i;
			l = [
				d + 3,
				d + 2,
				d - 4
			];
		} else if (e === "gravel") {
			let e = s > .88 ? 24 : s < .12 ? -24 : 0, t = 151 + c + e;
			l = [
				t + 17,
				t + 10,
				t - 8
			];
		} else if (e === "dirt") {
			let e = Math.exp(-(((a - .26) / .1) ** 2)) + Math.exp(-(((a - .74) / .1) ** 2)), t = 131 + c * 1.2 - e * 16;
			l = [
				t + 17,
				t + 1,
				t - 22
			];
		} else {
			let e = Math.exp(-(((a - .27) / .13) ** 2)) + Math.exp(-(((a - .73) / .13) ** 2)), t = 78 + c - e * 3;
			l = [
				t - 2,
				t + 1,
				t
			];
		}
		let u = (r * t + i) * 4;
		n[u] = Mt(l[0]), n[u + 1] = Mt(l[1]), n[u + 2] = Mt(l[2]), n[u + 3] = 255;
	}
	return n;
}
// src/viewer/surfacePalette.js
var Ft = (e, t, n) => Math.max(t, Math.min(n, e)), J = (e, t, n) => {
	let r = Ft((e - t) / (n - t), 0, 1);
	return r * r * (3 - 2 * r);
};
function It(e, t, n) {
	let r = Math.imul(e, 374761393) ^ Math.imul(t, 668265263) ^ n;
	return r = Math.imul(r ^ r >>> 13, 1274126177), ((r ^ r >>> 16) >>> 0) / 4294967295;
}
function Y(e, t, n = 17) {
	let r = Math.floor(e), i = Math.floor(t), a = J(e - r, 0, 1), o = J(t - i, 0, 1), s = It(r, i, n), c = It(r + 1, i, n), l = It(r, i + 1, n), u = It(r + 1, i + 1, n);
	return (s + (c - s) * a) * (1 - o) + (l + (u - l) * a) * o;
}
function Lt(e, t, n) {
	let r = Math.max(.25, Math.min(...e.step)), i = (z(e, t + r, n) - z(e, t - r, n)) / (2 * r), a = (z(e, t, n + r) - z(e, t, n - r)) / (2 * r), o = Math.hypot(i, 1, a);
	return [
		-i / o,
		1 / o,
		-a / o
	];
}
function Rt(e, t, n, r = [
	0,
	0,
	0
], i = null) {
	let a = z(e, t, n), o = i || Lt(e, t, n), s = Math.hypot(o[0], o[2]) / Math.max(1e-6, o[1]), c = J(s, .48, 1.1), l = Y(t * .035, n * .035, 11) * 2 - 1, u = Y(t * .17, n * .17, 29) * 2 - 1, d = Y(t * 1.7, n * 1.7, 47) * 2 - 1, f = J(Y(t * .062, n * .062, 73), .59, .84) * .42, p = Y(t * .12, n * .12, 89), m = Math.sin(a * 1.6 + p * 4.2) * 5.5, h = J(Y(t * .075 + p, n * .075, 123), .56, .87), g = J(s, .32, .85) * (1 - c) * h * .6, _ = (1 - J(Math.abs(Y(t * .42, n * .42, 97) - .5), .015, .075)) * 12, v = l * 7 + u * 5 + d * 4, y = [
		101,
		122,
		76
	], b = [
		141,
		136,
		95
	], x = [
		139,
		139,
		127
	];
	for (let e = 0; e < 3; e++) {
		let t = (y[e] * (1 - f) + b[e] * f + v) * (1 - g) + (x[e] - 12 + u * 8) * g, n = x[e] + l * 6 + u * 7 + d * 5 + m - _;
		r[e] = Ft(t * (1 - c) + n * c, 0, 255);
	}
	return r;
}
function zt(e, t = !1) {
	let n = t ? 60 : 100, r = Math.hypot(55, n, 35);
	return .66 + Math.max(0, (-55 * e[0] + n * e[1] + 35 * e[2]) / r) * .4;
}
// src/viewer/materials.js
function Bt(e) {
	let t = document.createElement("canvas");
	t.width = 512, t.height = 512;
	let n = t.getContext("2d"), r = n.createImageData(512, 512), i = [!1, !0].map((e) => {
		let t = document.createElement("canvas");
		t.width = t.height = 512;
		let n = t.getContext("2d"), r = document.createElement("canvas");
		r.width = r.height = 512;
		let i = r.getContext("2d");
		return {
			evening: e,
			bitmap: t,
			context: n,
			pixels: n.createImageData(512, 512),
			mask: r,
			maskContext: i,
			maskPixels: i.createImageData(512, 512)
		};
	}), a = (e.columns - 1) * e.step[0], o = (e.rows - 1) * e.step[1], s = /* @__PURE__ */ new Float64Array(3);
	for (let t = 0; t < 512; t++) for (let n = 0; n < 512; n++) {
		let c = e.origin[0] + n / 511 * a, l = e.origin[1] + t / 511 * o, u = (t * 512 + n) * 4, d = Lt(e, c, l);
		Rt(e, c, l, s, d), r.data[u] = s[0], r.data[u + 1] = s[1], r.data[u + 2] = s[2], r.data[u + 3] = 255;
		for (let e of i) {
			let t = zt(d, e.evening);
			for (let n = 0; n < 3; n++) e.pixels.data[u + n] = s[n] * t;
			e.pixels.data[u + 3] = 255, e.maskPixels.data[u + 3] = Math.max(0, 1 - t) * 255;
		}
	}
	n.putImageData(r, 0, 0);
	let l = new c.CanvasTexture(t);
	l.colorSpace = c.SRGBColorSpace, l.anisotropy = 8;
	for (let e of i) e.context.putImageData(e.pixels, 0, 0), e.maskContext.putImageData(e.maskPixels, 0, 0);
	return l.userData.previewImage = t, l.userData.compatibilityImages = {
		day: i[0].bitmap,
		evening: i[1].bitmap
	}, l.userData.compatibilityShadeMasks = {
		day: i[0].mask,
		evening: i[1].mask
	}, l;
}
function Vt() {
	let e = document.createElement("canvas");
	e.width = 256, e.height = 256;
	let t = e.getContext("2d"), n = t.createImageData(256, 256);
	n.data.set(Pt("asphalt", 256)), t.putImageData(n, 0, 0), t.strokeStyle = "#3f48412b", t.lineWidth = .5;
	for (let e = 0; e < 8; e++) t.beginPath(), t.moveTo(e * 33, 0), t.bezierCurveTo(e * 33 - 8, 70, e * 33 + 13, 130, e * 33 + 2, 256), t.stroke();
	let r = new c.CanvasTexture(e);
	return r.wrapS = r.wrapT = c.RepeatWrapping, r.colorSpace = c.SRGBColorSpace, r.anisotropy = 8, r;
}
function Ht(e, t, n, r) {
	return n ? n.apply(e, t, r) : (t && new c.ImageLoader().load(t, (t) => {
		e.image = t, e.needsUpdate = !0;
	}, void 0, () => console.warn("Viewer asset could not be loaded:", t)), e);
}
// src/viewer/cyclists.js
function Ut(e, t, n) {
	let r = document.createElement("canvas");
	r.width = 512, r.height = 256;
	let i = r.getContext("2d");
	if (i.fillStyle = e.color, i.fillRect(0, 0, 512, 256), i.fillStyle = e.accent, e.pattern === "paths") try {
		let t = (e.paths || []).map((e) => new Path2D(e));
		i.save();
		try {
			i.scale(512 / 100, 256 / 100);
			for (let e of t) i.fill(e);
		} finally {
			i.restore();
		}
	} catch {
		t?.reportError(n + ":artwork", "Inline jersey artwork could not be decoded; base palette retained");
	}
	else if (e.pattern === "polka") for (let e = 15; e < 256; e += 45) for (let t = e % 2 * 12; t < 512; t += 48) i.beginPath(), i.arc(t, e, 9, 0, Math.PI * 2), i.fill();
	else e.pattern === "chevron" ? (i.beginPath(), i.moveTo(0, 74), i.lineTo(256, 142), i.lineTo(512, 74), i.lineTo(512, 106), i.lineTo(256, 174), i.lineTo(0, 106), i.fill()) : e.pattern === "stripe" ? (i.fillRect(0, 120, 512, 13), i.fillRect(0, 145, 512, 6)) : i.fillRect(0, 95, 512, 56);
	i.fillStyle = e.accent, i.font = "bold 36px sans-serif", i.textAlign = "center", i.fillText(e.sponsor || e.name, 256, 84), i.font = "16px sans-serif", i.fillText("P E L O T O N I A", 256, 202), i.fillStyle = "#ffffffbb", i.fillRect(340, 155, 76, 48), i.fillStyle = "#243c36", i.font = "bold 29px sans-serif", i.fillText("P", 378, 190);
	let a = new c.CanvasTexture(r);
	return a.colorSpace = c.SRGBColorSpace, a.anisotropy = 4, Ht(a, e.textureUrl, t, n);
}
function Wt(e, t, n, r, i, a) {
	let o = new L(), s = new L(), c = "#d2a17d", l = "#243339", u = "#b0bab3", d = e.color, f = [
		I(0, .35, -.56),
		I(0, q.bottomBracket, 0),
		I(0, .94, -.2),
		I(0, .87, .38),
		I(0, .35, .56)
	];
	for (let [e, t] of [
		[0, 1],
		[0, 2],
		[1, 2],
		[2, 3],
		[1, 3],
		[3, 4],
		[1, 4]
	]) o.rod(f[e], f[t], .025, d);
	o.torus(.1, .009, u, .09, q.bottomBracket, 0), o.rod(I(.09, .4, -.56), I(.09, .39, 0), .008, l, 4), o.rod(I(.09, .3, -.56), I(.09, .19, 0), .008, l, 4), o.torus(.055, .008, u, .08, .35, -.56), o.rod(I(.09, .35, -.56), I(.1, .22, -.62), .012, u, 5), o.torus(.025, .006, l, .1, .22, -.62), o.rod(I(0, .55, .13), I(0, .73, .23), .042, "#e9e8dc", 8), o.rod(I(0, .73, .23), I(0, .76, .247), .026, l, 6), o.box(.22, .045, .25, l, 0, .99, -.23), o.rod(I(0, .86, .38), I(0, 1.05, .52), .023, u), o.rod(I(-.23, 1.05, .52), I(.23, 1.05, .52), .021, l);
	for (let e of ct) for (let t = 1; t < e.length; t++) o.rod(I(...e[t - 1]), I(...e[t]), .018, l, 5);
	s.ellipsoid(a.hipHalfWidth + .02, .11, .15, l, 0, 1.03, -.13), s.rod(I(0, 1.32, .25), I(0, 1.4, .34), .065, c), s.ellipsoid(.105 * a.headScale, .12 * a.headScale, .12 * a.headScale, c, 0, 1.43, .37), s.ellipsoid(.13, .09, .17, n, 0, 1.51, .35);
	for (let e of lt) for (let t = 1; t < e.length; t++) s.rod(I(...e[t - 1]), I(...e[t]), .008, "#344347", 4);
	if (s.box(.19, .034, .06, "#273f43", 0, 1.445, .475), a.hairStyle !== "none" && s.ellipsoid(.087, .055, .055, a.hairColor, 0, 1.44, .245), a.hairStyle === "tied") for (let e = 1; e < V.length; e++) s.rod(I(...V[e - 1]), I(...V[e]), .035, a.hairColor, 7), s.ellipsoid(.035, .035, .035, a.hairColor, ...V[e]);
	for (let e of $e) o.rod(I(...e.a), I(...e.b), e.radius, e.color, 6);
	for (let e of et) s.rod(I(...e.a), I(...e.b), .006, "#344348", 4);
	let p = _t(a);
	return {
		body: o.build(),
		upperBody: s.build(),
		torso: p,
		texture: Ut(t, r, i)
	};
}
function Gt() {
	let e = new L();
	e.torus(U.radius, U.tyreRadius, "#243339", 0, 0, 0), e.torus(.303, .009, "#b0bab3", 0, 0, 0), e.rod(I(-.13, 0, 0), I(.13, 0, 0), .025, "#b0bab3");
	for (let t = 0; t < 6; t++) {
		let n = t * Math.PI / 6;
		e.rod(I(0, Math.cos(n) * .29, Math.sin(n) * .29), I(0, -Math.cos(n) * .29, -Math.sin(n) * .29), .004, "#b0bab3", 3);
	}
	return e.build();
}
var Kt = class {
	constructor(e, t) {
		this.scene = e, this.feed = t, this.fabricTexture = tt(), this.compactUnplaced = t.synthetic === !0 && t.route.points?.length === 2 && t.route.distanceStations?.at(-1) > 4e4 && t.frames.every((e) => e.positions.every((e) => e.lateral === 0)), this.textures = new At(), this.groups = [], this.pickables = [], this.riderTransforms = /* @__PURE__ */ new Map(), this.bibs = new jt(e, t.riders), this.scratch = new c.Object3D(), this.matrix = new c.Matrix4(), this.wheels = new c.InstancedMesh(Gt(), R(), t.riders.length * 2), this.wheels.frustumCulled = !1, this.wheels.castShadow = !0, this.wheels.instanceMatrix.setUsage(c.DynamicDrawUsage), this.wheels.userData.riders = t.riders.flatMap((e) => [e, e]), this.pickables.push(this.wheels);
		let n = /* @__PURE__ */ new Map();
		for (let e of t.riders) {
			let r = B(t, e), i = `${e.teamId}/${e.jersey || ""}/${e.helmet || ""}/${r.hairStyle}/${r.hairColor}`;
			n.has(i) || n.set(i, []), n.get(i).push(e);
		}
		for (let r of n.values()) {
			let n = r[0], i = De(t, n), a = B(t, n), { team: o, kit: s, helmetColor: l } = i, u = Wt(o, s, l, this.textures, `kit:${n.teamId}/${n.jersey || "team"}`, a), d = new c.InstancedMesh(u.body, R(), r.length), f = new c.InstancedMesh(u.torso, new c.MeshStandardMaterial({
				map: u.texture,
				roughness: .89,
				bumpMap: this.fabricTexture,
				bumpScale: .007
			}), r.length), p = new c.InstancedMesh(u.upperBody, R(), r.length);
			for (let t of [
				d,
				f,
				p
			]) t.castShadow = !0, t.receiveShadow = !0, t.frustumCulled = !1, t.instanceMatrix.setUsage(c.DynamicDrawUsage), t.userData.riders = r, e.add(t), this.pickables.push(t);
			this.groups.push({
				riders: r,
				riderModel: a,
				body: d,
				torso: f,
				upperBody: p,
				team: o,
				kit: s,
				helmetColor: l
			});
		}
		let r = new c.MeshStandardMaterial({
			color: "#d1a17c",
			roughness: .9
		}), i = new c.MeshStandardMaterial({
			color: "#27343c",
			roughness: .9
		}), a = new c.MeshStandardMaterial({ color: "#e8e9db" });
		this.armUpper = new c.InstancedMesh(new c.CylinderGeometry(.047, .047, 1, 6), new c.MeshStandardMaterial({ color: "#ffffff" }), t.riders.length * 2), this.armLower = new c.InstancedMesh(new c.CylinderGeometry(.031, .034, 1, 6), r.clone(), t.riders.length * 2), this.upper = new c.InstancedMesh(new c.CylinderGeometry(.063, .067, 1, 6), i, t.riders.length * 2), this.lower = new c.InstancedMesh(new c.CylinderGeometry(.037, .041, 1, 6), r, t.riders.length * 2);
		let o = new L();
		o.rod(I(), I(0, q.crankLength, 0), .012, "#b0bab3", 5), this.cranks = new c.InstancedMesh(o.build(), R(), t.riders.length * 2), this.shoes = new c.InstancedMesh(new c.BoxGeometry(.105, .06, .2), a, t.riders.length * 2), this.socks = new c.InstancedMesh(new c.CylinderGeometry(.039, .036, 1, 7), new c.MeshStandardMaterial({
			color: "#f0efe4",
			roughness: .95
		}), t.riders.length * 2), this.gloves = new c.InstancedMesh(new c.SphereGeometry(.042, 7, 5), new c.MeshStandardMaterial({
			color: "#283b3d",
			roughness: .9
		}), t.riders.length * 2);
		for (let t of [
			this.upper,
			this.lower,
			this.shoes,
			this.socks,
			this.gloves,
			this.cranks,
			this.armUpper,
			this.armLower,
			this.wheels
		]) t.frustumCulled = !1, t.castShadow = !0, t.instanceMatrix.setUsage(c.DynamicDrawUsage), e.add(t);
	}
	update(e, t, n, r = null) {
		let i = new Map(e.positions.filter((e) => Fe(e, t.length)).map((e) => [e.riderId, e])), a = null;
		if (this.compactUnplaced) {
			let e = /* @__PURE__ */ new Map();
			for (let t of i.values()) {
				let n = `${t.groupId}/${t.distance}`;
				e.has(n) && t.riderId !== r || e.set(n, t.riderId);
			}
			a = new Set(e.values());
		}
		this.riderTransforms.clear();
		for (let e of this.groups) {
			let r = 0;
			for (let o = 0; o < e.riders.length; o++) {
				let s = e.riders[o], l = i.get(s.id), u = new c.Object3D();
				if (!l) {
					this.compactUnplaced || (u.scale.setScalar(0), u.updateMatrix(), e.body.setMatrixAt(o, u.matrix), e.torso.setMatrixAt(o, u.matrix), e.upperBody.setMatrixAt(o, u.matrix));
					continue;
				}
				let d = t.at(l.distance, l.lateral), f = nt(ye(l.action, n, s.number, wt(l, n, s.number), l.actionTransition), l.crash), p = ht(t, l, Et(t, l.distance, l.displaySpeed) * (1 - (l.crash?.amount || 0)) + f.roll, d);
				u.position.copy(p.position), u.quaternion.copy(p.quaternion), u.updateMatrix();
				let m = rt(Tt(f.lift, f.pitch), l.crash), h = u.matrix.clone().multiply(m);
				if (!a || a.has(s.id)) {
					let t = this.compactUnplaced ? r++ : o;
					if (e.body.setMatrixAt(t, u.matrix), e.torso.setMatrixAt(t, h), e.upperBody.setMatrixAt(t, h), this.compactUnplaced) for (let n of [
						e.body,
						e.torso,
						e.upperBody
					]) n.userData.riders[t] = s;
				}
				this.riderTransforms.set(s.id, {
					...d,
					rider: s,
					riderModel: e.riderModel,
					sample: l,
					matrix: u.matrix.clone(),
					upperMatrix: h,
					upperLocal: m,
					motion: f,
					crash: l.crash,
					roll: p.roll,
					heading: p.heading,
					roadPitch: p.roadPitch,
					team: e.team,
					kit: e.kit,
					jerseyImage: e.torso.material.map.image,
					helmetColor: e.helmetColor
				});
			}
			if (this.compactUnplaced) for (let t of [
				e.body,
				e.torso,
				e.upperBody
			]) t.count = r;
			e.body.instanceMatrix.needsUpdate = !0, e.torso.instanceMatrix.needsUpdate = !0, e.upperBody.instanceMatrix.needsUpdate = !0;
		}
		let o = 0;
		for (let e of this.feed.riders) {
			if (a && !a.has(e.id)) continue;
			let t = this.riderTransforms.get(e.id);
			for (let r of [-1, 1]) {
				if (this.compactUnplaced && (this.wheels.userData.riders[o] = e), !t) {
					this.scratch.scale.setScalar(0), this.scratch.updateMatrix();
					for (let e of [
						this.upper,
						this.lower,
						this.shoes,
						this.socks,
						this.gloves,
						this.cranks,
						this.armUpper,
						this.armLower,
						this.wheels
					]) e.setMatrixAt(o, this.scratch.matrix);
					o++;
					continue;
				}
				let i = wt(t.sample, n, e.number) + (r === 1 ? Math.PI : 0), a = it(Ot(r, i), r, t.crash), s = I(r * t.riderModel.hipHalfWidth, 1.01, -.14).applyMatrix4(t.upperLocal), l = K(s, a, q.upperLeg, q.lowerLeg, I(r * .08, 0, 1));
				this.scratch.position.set(0, .35, r * .56), this.scratch.rotation.set(t.sample.distance / .335, 0, 0), this.scratch.scale.set(1, 1, 1), this.scratch.updateMatrix(), this.matrix.multiplyMatrices(t.matrix, this.scratch.matrix), this.wheels.setMatrixAt(o, this.matrix), this.scratch.position.set(r * q.pedalHalfWidth, q.bottomBracket, 0), this.scratch.rotation.set(i, 0, 0), this.scratch.updateMatrix(), this.matrix.multiplyMatrices(t.matrix, this.scratch.matrix), this.cranks.setMatrixAt(o, this.matrix);
				let u = I(r * t.riderModel.shoulderHalfWidth, 1.3, .21).applyMatrix4(t.upperLocal), d = at(Dt(r, t.upperLocal || new c.Matrix4(), (r < 0 ? t.motion?.leftArm : t.motion?.rightArm) ?? t.motion?.celebration ?? 0, t.riderModel), r, t.upperLocal, t.crash), f = K(u, d, .28, .29, I(r * .35, -.6, -.25));
				this.limb(this.armUpper, o, u, f, t.matrix, t.riderModel.armScale), this.armUpper.setColorAt(o, new c.Color(t.kit.color)), this.limb(this.armLower, o, f, d, t.matrix, t.riderModel.armScale), this.limb(this.upper, o, s, l, t.matrix, t.riderModel.legScale), this.limb(this.lower, o, l, a, t.matrix, t.riderModel.legScale), this.limb(this.socks, o, bt(a, l), a, t.matrix, t.riderModel.legScale), this.scratch.position.copy(d), this.scratch.rotation.set(0, 0, 0), this.scratch.scale.set(1, 1, 1), this.scratch.updateMatrix(), this.gloves.setMatrixAt(o, this.matrix.multiplyMatrices(t.matrix, this.scratch.matrix)), this.scratch.position.copy(a), this.scratch.rotation.set(.1 * Math.sin(i), 0, 0), this.scratch.scale.set(1, 1, 1), this.scratch.updateMatrix(), this.matrix.multiplyMatrices(t.matrix, this.scratch.matrix), this.shoes.setMatrixAt(o, this.matrix), o++;
			}
		}
		for (let e of [
			this.upper,
			this.lower,
			this.shoes,
			this.socks,
			this.gloves,
			this.cranks,
			this.armUpper,
			this.armLower,
			this.wheels
		]) this.compactUnplaced && (e.count = o), e.instanceMatrix.needsUpdate = !0;
		this.armUpper.instanceColor && (this.armUpper.instanceColor.needsUpdate = !0), this.bibs.update(this.riderTransforms, a);
	}
	limb(e, t, n, r, i, a = 1) {
		let o = r.clone().sub(n);
		this.scratch.position.copy(n).add(r).multiplyScalar(.5), this.scratch.quaternion.setFromUnitVectors(I(0, 1, 0), o.clone().normalize()), this.scratch.scale.set(a, o.length(), a), this.scratch.updateMatrix(), this.matrix.multiplyMatrices(i, this.scratch.matrix), e.setMatrixAt(t, this.matrix);
	}
	pick(e) {
		for (let e of this.pickables) e.boundingSphere = null;
		let t = e.intersectObjects(this.pickables, !1)[0];
		return t ? t.object.userData.riders[t.instanceId]?.id : null;
	}
	dispose() {
		this.textures.dispose(), this.fabricTexture.dispose(), this.bibs.dispose();
		for (let e of this.groups) for (let t of [
			e.body,
			e.torso,
			e.upperBody
		]) this.scene.remove(t), t.dispose?.(), t.geometry.dispose(), t.material.map?.dispose(), t.material.dispose();
		for (let e of [
			this.upper,
			this.lower,
			this.shoes,
			this.socks,
			this.gloves,
			this.cranks,
			this.armUpper,
			this.armLower,
			this.wheels
		]) this.scene.remove(e), e.dispose?.(), e.geometry.dispose(), e.material.dispose();
	}
}, qt = (e) => e - Math.floor(e), Jt = class {
	constructor(e, t, n) {
		this.scene = e, this.route = n, this.feed = t, this.patches = [], this.spray = [];
		let r = [], i = n.length / (n.geometryLength || n.length), a = Math.max(6 * i, n.length / 250);
		for (let e = a; e < n.length; e += a) {
			if (!["asphalt", "cobbles"].includes(k(t.route, e))) continue;
			let a = qt(Math.sin(e * .712) * 43758.5), o = (a - .5) * (t.route.width - 1.4), s = (.5 + a * .9) * i, c = .18 + a * .38, l = [
				[e - s, o - c],
				[e + s, o - c * .6],
				[e + s * .7, o + c],
				[e - s * .6, o + c * .7]
			].map(([e, t]) => n.at(e, t).position.add(I(0, H + .021, 0)));
			this.patches.push(l);
			for (let e of [
				0,
				1,
				2,
				0,
				2,
				3
			]) r.push(...l[e].toArray());
		}
		this.geometry = new c.BufferGeometry(), this.geometry.setAttribute("position", new c.Float32BufferAttribute(r, 3)), this.material = new c.MeshBasicMaterial({
			color: "#c6d5d9",
			transparent: !0,
			opacity: 0,
			depthWrite: !1,
			side: c.DoubleSide
		}), this.mesh = new c.Mesh(this.geometry, this.material), e.add(this.mesh), this.sprayGeometry = new c.BufferGeometry(), this.sprayPositions = /* @__PURE__ */ new Float32Array(2700), this.sprayGeometry.setAttribute("position", new c.BufferAttribute(this.sprayPositions, 3)), this.sprayMaterial = new c.LineBasicMaterial({
			color: "#cedcdb",
			transparent: !0,
			opacity: .22,
			depthWrite: !1
		}), this.sprayMesh = new c.LineSegments(this.sprayGeometry, this.sprayMaterial), this.sprayMesh.frustumCulled = !1, e.add(this.sprayMesh), this.wet = 0;
	}
	update(e, t, n) {
		this.wet = ["rain", "sleet"].includes(n.condition) ? n.intensity : 0, this.mesh.visible = this.wet > 0, this.material.opacity = this.wet * .16, this.spray = [];
		let r = 0, i = this.route.length / (this.route.geometryLength || this.route.length);
		if (this.wet) {
			for (let a of e) if (!(a.crash || Math.abs(a.displaySpeed || 0) / i < 1 || a.distance < 0 || a.distance > this.route.length)) for (let e = 0; e < 3 && r < 450; e++) {
				let o = qt(t * 4 + e * .31 + a.distance * .03), s = this.route.at(a.distance - (.55 + o * .9) * i, a.lateral + (e - 1) * .08).position.add(I(0, .075 + Math.sin(o * Math.PI) * .23, 0)), c = s.clone().add(I(n.wind[0] * .003, .05, n.wind[1] * .003));
				this.spray.push([s, c]), s.toArray(this.sprayPositions, r * 6), c.toArray(this.sprayPositions, r * 6 + 3), r++;
			}
		}
		this.sprayMaterial.opacity = this.wet * .3, this.sprayMesh.visible = r > 0, this.sprayGeometry.setDrawRange(0, r * 2), this.sprayGeometry.attributes.position.needsUpdate = !0;
	}
	dispose() {
		for (let e of [this.mesh, this.sprayMesh]) this.scene.remove(e), e.geometry.dispose(), e.material.dispose();
	}
};
// src/viewer/roadSurfaces.js
function Yt(e) {
	if (e === "asphalt") return Vt();
	let t = document.createElement("canvas");
	t.width = t.height = 512;
	let n = t.getContext("2d");
	if (n.createImageData) {
		let t = n.createImageData(512, 512);
		t.data.set(Pt(e)), n.putImageData(t, 0, 0);
	} else n.fillStyle = e === "cobbles" ? "#807e75" : e === "gravel" ? "#b5ab91" : "#947c60", n.fillRect(0, 0, 512, 512);
	let r = new c.CanvasTexture(t);
	return r.wrapS = r.wrapT = c.RepeatWrapping, r.colorSpace = c.SRGBColorSpace, r.anisotropy = 8, r;
}
var Xt = class {
	constructor(e, t) {
		this.width = e.route.width;
		let n = [
			"asphalt",
			"gravel",
			"cobbles",
			"dirt"
		];
		this.entries = n.map((n) => this.entry(n, n === "asphalt" ? e.route.textureUrl : null, t, "surface:" + n)), this.segments = (e.route.surfaces || []).map((e, r) => ({
			...e,
			index: e.textureUrl ? this.entries.push(this.entry(e.type, e.textureUrl, t, "surface:" + r)) - 1 : n.indexOf(e.type)
		})), this.materials = this.entries.map((e) => e.material);
	}
	entry(e, t, n, r) {
		let i = Ht(Yt(e), t, n, r), a = new c.MeshStandardMaterial({
			map: i,
			bumpMap: i,
			bumpScale: e === "cobbles" ? .055 : e === "gravel" ? .035 : .025,
			roughness: .98,
			polygonOffset: !0,
			polygonOffsetFactor: -1
		});
		return i.repeat.set(e === "asphalt" ? 1 : this.width / 2, e === "asphalt" ? 1 : 8 / 3), {
			type: e,
			texture: i,
			material: a,
			tileLength: e === "asphalt" ? 8 : 3,
			repeatAcross: e === "asphalt" ? 1 : this.width / 2
		};
	}
	indexAt(e) {
		return this.segments.find((t) => e >= t.from && e < t.to)?.index ?? 0;
	}
	at(e) {
		return this.entries[this.indexAt(e)];
	}
	update(e) {
		let t = ["rain", "sleet"].includes(e.condition) ? e.intensity : 0;
		for (let e of this.entries) e.material.roughness = .98 - t * .58, e.material.color.setRGB(1 - t * .23, 1 - t * .21, 1 - t * .17);
	}
	dispose() {
		for (let e of this.entries) e.texture.dispose(), e.material.dispose();
	}
};
// src/viewer/spectators.js
function Zt(e) {
	let t = new c.Color(e.color || "#d3b75e").getHex(), n = (t ^ t >>> 8) % 6;
	return {
		variant: n,
		trousers: [
			"#34464b",
			"#5c6659",
			"#8a7e66",
			"#34464b",
			"#716357",
			"#445570"
		][n],
		hair: [
			"#544438",
			"#b49a6b",
			"#383b36"
		][n % 3],
		hat: n % 3 == 0,
		shorts: n % 2 == 1,
		backpack: n === 4
	};
}
function Qt(e) {
	let t = new L(), n = e.color || "#d3b75e", r = e.skinColor || "#c89e7c", i = "#26383f", a = e.pose || "standing", o = Zt(e);
	for (let e of [-1, 1]) {
		let n = I(e * .085, .86, 0), a = I(e * .09, .46, .015), s = I(e * .12, .08, e * .025);
		t.rod(n, a, .068, o.trousers, 6), t.rod(a, s, .05, o.shorts ? r : o.trousers, 6), t.box(.12, .075, .22, "#e5e0d2", e * .12, .038, .055), t.box(.12, .018, .225, i, e * .12, .014, .055);
	}
	if (t.ellipsoid(.18, .27, .12, n, 0, 1.09, 0, 10, 6), t.ellipsoid(.065, .02, .06, "#e9e0c9", 0, 1.32, .008, 7, 4), t.rod(I(0, 1.28, 0), I(0, 1.39, 0), .05, r, 6), t.ellipsoid(.105, .135, .1, r, 0, 1.49, 0, 10, 6), o.hat ? (t.ellipsoid(.112, .06, .11, "#d3c29c", 0, 1.58, -.01, 8, 4), t.box(.18, .018, .14, "#d3c29c", 0, 1.56, .085)) : (t.ellipsoid(.109, .07, .105, o.hair, 0, 1.56, -.015, 9, 5), o.variant === 2 && t.ellipsoid(.105, .11, .045, o.hair, 0, 1.47, -.075, 8, 4)), o.variant % 2 == 0 && (t.box(.14, .027, .018, i, 0, 1.51, .09), t.rod(I(-.09, 1.51, .08), I(.09, 1.51, .08), .008, i, 4)), o.backpack) {
		t.ellipsoid(.135, .19, .075, "#726345", 0, 1.11, -.14, 8, 5);
		for (let e of [-1, 1]) t.rod(I(e * .105, 1.3, .08), I(e * .12, 1.02, .1), .016, "#726345", 4);
	}
	for (let e of [-1, 1]) {
		let i = I(e * .155, 1.24, 0), o = a === "cheering" ? I(e * .3, 1.5, .04) : a === "clapping" ? I(e * .2, 1.15, .18) : I(e * .22, .98, .02), s = a === "cheering" ? I(e * .36, 1.76, .08) : a === "clapping" ? I(e * .025, 1.25, .31) : I(e * .2, .77, .06);
		t.rod(i, o, .055, n, 6), t.rod(o, s, .036, r, 6), t.ellipsoid(.04, .05, .035, r, s.x, s.y, s.z, 6, 4), e === 1 && a === "cheering" && t.box(.065, .105, .022, "#26383f", s.x, s.y + .035, s.z);
	}
	return t.build();
}
var $t = class {
	constructor(e, t) {
		this.scene = e, this.instances = [], this.groups = /* @__PURE__ */ new Map(), this.material = R(), this.setPeople(t.spectators || []);
	}
	setPeople(e) {
		let t = /* @__PURE__ */ new Map();
		for (let n of e) {
			let e = [
				n.color || "#d3b75e",
				n.skinColor || "#c89e7c",
				n.pose || "standing"
			].join("/");
			t.has(e) || t.set(e, []), t.get(e).push(n);
		}
		this.instances = [];
		for (let e of this.groups.values()) e.mesh.count = 0;
		for (let [e, n] of t) {
			let t = this.groups.get(e);
			t || (t = {
				geometry: Qt(n[0]),
				mesh: null,
				capacity: 0
			}, this.groups.set(e, t)), n.length > t.capacity && (t.mesh && (this.scene.remove(t.mesh), t.mesh.dispose()), t.capacity = 2 ** Math.ceil(Math.log2(Math.max(1, n.length))), t.mesh = new c.InstancedMesh(t.geometry, this.material, t.capacity), t.mesh.castShadow = !0, t.mesh.receiveShadow = !0, t.mesh.frustumCulled = !0, this.scene.add(t.mesh)), t.mesh.count = n.length, n.forEach((n, r) => {
				let i = new c.Matrix4().makeRotationY(n.rotation || 0).setPosition(I(...n.position)).scale(I(n.scale || 1, n.scale || 1, n.scale || 1));
				t.mesh.setMatrixAt(r, i), this.instances.push({
					kind: "spectator",
					styleKey: e,
					rotation: n.rotation || 0,
					location: {
						position: [...n.position],
						scale: n.scale || 1
					},
					matrix: i,
					parts: [{
						geometry: t.geometry,
						material: this.material
					}]
				});
			}), t.mesh.instanceMatrix.needsUpdate = !0, t.mesh.boundingSphere = null, t.mesh.computeBoundingSphere();
		}
	}
	dispose() {
		for (let e of this.groups.values()) this.scene.remove(e.mesh), e.mesh.dispose(), e.geometry.dispose();
		this.groups.clear(), this.material.dispose(), this.instances = [];
	}
}, en = [
	"#bd774e",
	"#d7b659",
	"#5b898d",
	"#e5d9bb",
	"#596b83",
	"#8c5c77",
	"#425e4c",
	"#b84c43"
], tn = [
	"#cda27f",
	"#97684b",
	"#e1bfa0",
	"#74503b"
], nn = (e, t = 1) => {
	let n = Math.sin(e * 127.1 + t * 311.7) * 43758.5453;
	return n - Math.floor(n);
};
function rn(e, t) {
	let n = [];
	if (e.finish) {
		let r = e.finish.routeFraction * t;
		for (let i of [-1, 1]) n.push({
			from: Math.max(0, r - (e.finish.barrierBefore ?? 1e3)),
			to: Math.min(t, r + (e.finish.barrierAfter ?? 18)),
			side: i
		});
	}
	for (let r of e.route.surfaces || []) if (r.type === "cobbles" && r.barriers !== !1) for (let e of [-1, 1]) n.push({
		from: r.from,
		to: Math.min(r.to, t),
		side: e
	});
	for (let r of e.crowd?.zones || []) if (r.barriers) for (let e of r.side && r.side !== "both" ? [r.side] : [-1, 1]) n.push({
		from: r.from,
		to: Math.min(r.to, t),
		side: e
	});
	let r = [];
	for (let e of [-1, 1]) for (let t of n.filter((t) => t.side === e && t.to > t.from).sort((e, t) => e.from - t.from)) {
		let n = r.at(-1);
		n?.side === e && t.from <= n.to ? n.to = Math.max(n.to, t.to) : r.push({ ...t });
	}
	return r;
}
function an(e, t, n, r = 180) {
	if (!e.crowd?.enabled) return [];
	let i = e.crowd, a = e.finish ? t.length * e.finish.routeFraction : null, o = [...i.zones || []];
	a !== null && i.autoFinish !== !1 && o.push({
		id: "finish-auto",
		from: Math.max(0, a - 1e3),
		to: Math.min(t.length, a + 18),
		kind: "finish",
		rows: 3,
		spacing: 1.1
	});
	for (let t of e.route.surfaces || []) t.type === "cobbles" && o.push({
		id: "cobbles-auto",
		from: t.from,
		to: t.to,
		kind: "iconic",
		rows: 3,
		spacing: 1
	});
	let s = t.length / (t.geometryLength || t.length), c = Math.max(3, ...o.map((e) => e.rows ?? 4)), l = Math.max(0, n - r * s), u = Math.min(t.length, n + r * s), d = [], f = Math.max(.8, 4 * r * c / 2200) * s;
	for (let n = Math.ceil(l / f); n * f <= u; n++) {
		let r = n * f;
		for (let a of [-1, 1]) {
			let c = o.filter((e) => r >= e.from && r <= e.to && (!e.side || e.side === "both" || e.side === a)).sort((e, t) => (t.rows ?? (t.kind === "iconic" ? 4 : 2)) - (e.rows ?? (e.kind === "iconic" ? 4 : 2)))[0], l = c ? c.rows ?? (c.kind === "normal" ? 1 : c.kind === "iconic" ? 4 : 2) : 1, u = c ? c.spacing ?? (c.kind === "normal" ? 8 : 1.2) : i.backgroundSpacing ?? 28;
			if (!(n % Math.max(1, Math.round(u * s / f))) && !(!c && nn(n + a, i.seed ?? 5) > .55)) for (let o = 0; o < l; o++) {
				if (d.length >= 2400) return d;
				let s = n * 13 + o * 41 + a * 7, l = Math.floor(nn(s, i.seed ?? 5) * 16), u = a * (e.route.width / 2 + 1.2 + o * .76 + nn(s + 2) * .12), f = t.at(r + o % 2 * .35, u);
				e.terrain && (f.position.y = Math.max(f.position.y, z(e.terrain, f.position.x, f.position.z))), f.position.y += o * (c?.rowRise ?? 0), d.push({
					position: f.position.toArray(),
					rotation: f.heading - a * Math.PI / 2,
					scale: .88 + l % 5 * .045,
					color: en[l % 8],
					skinColor: tn[l % 4],
					pose: l % 4 == 0 ? "cheering" : l % 3 == 0 ? "clapping" : "standing"
				});
			}
		}
	}
	return d;
}
var on = class {
	constructor(e, t, n) {
		this.feed = t, this.route = n, this.people = new $t(e, {}), this.bucket = null, this.count = 0;
	}
	update(e) {
		let t = Math.round(e / (24 * this.route.length / (this.route.geometryLength || this.route.length))) * (24 * this.route.length / (this.route.geometryLength || this.route.length));
		if (t === this.bucket) return;
		this.bucket = t;
		let n = an(this.feed, this.route, t);
		this.count = n.length, this.people.setPeople(n);
	}
	get instances() {
		return this.people.instances;
	}
	dispose() {
		this.people.dispose();
	}
}, sn = class {
	constructor(e, t, n) {
		this.scene = e, this.ranges = rn(t, n.length), this.segments = [];
		let r = new L(), i = "#bac6bb", a = t.finish?.color || "#315845";
		for (let e of [0, 1]) r.rod(I(0, 0, e), I(0, .9, e), .025, i, 5), r.ellipsoid(.035, .03, .035, "#e1dfb7", 0, .91, e, 5, 3), r.rod(I(-.2, .02, e), I(.2, .02, e), .025, i, 5);
		for (let e of [.18, .88]) r.rod(I(0, e, 0), I(0, e, 1), .024, i, 5);
		r.rod(I(0, .18, 0), I(0, .88, 1), .014, i, 4), r.rod(I(0, .88, 0), I(0, .18, 1), .014, i, 4), r.rod(I(0, .34, 0), I(0, .34, 1), .065, a, 5), this.geometry = r.build(), this.material = R();
		let o = 2.5 * (n.length / (n.geometryLength || n.length));
		for (let e of this.ranges) for (let r = e.from; r < e.to && this.segments.length < 4e3; r += o) {
			let i = n.at(r, e.side * (t.route.width / 2 + .55)).position, s = n.at(Math.min(e.to, r + o), e.side * (t.route.width / 2 + .55)).position;
			this.segments.push({
				a: i.toArray(),
				b: s.toArray(),
				event: !0,
				color: a
			});
		}
		this.mesh = new c.InstancedMesh(this.geometry, this.material, this.segments.length), this.mesh.castShadow = !0, this.mesh.receiveShadow = !0;
		let s = new c.Object3D();
		this.segments.forEach((e, t) => {
			let n = I(...e.a), r = I(...e.b).sub(n);
			s.position.copy(n), s.quaternion.setFromUnitVectors(I(0, 0, 1), r.clone().normalize()), s.scale.set(1, 1, r.length()), s.updateMatrix(), this.mesh.setMatrixAt(t, s.matrix);
		}), this.segments.length && e.add(this.mesh);
	}
	dispose() {
		this.scene.remove(this.mesh), this.mesh.dispose(), this.geometry.dispose(), this.material.dispose();
	}
}, cn = class extends Map {
	constructor(e = 67108864) {
		super(), this.budget = e, this.bytes = 0;
	}
	get(e) {
		let t = super.get(e);
		return t && (super.delete(e), super.set(e, t)), t;
	}
	set(e, t) {
		this.delete(e);
		let n = t.width * t.height * 4;
		if (n > this.budget) return this;
		for (super.set(e, t), this.bytes += n; this.bytes > this.budget || this.size > 1200;) this.delete(this.keys().next().value);
		return this;
	}
	delete(e) {
		let t = super.get(e);
		return t ? (this.bytes -= t.width * t.height * 4, super.delete(e)) : !1;
	}
	clear() {
		super.clear(), this.bytes = 0;
	}
};
function ln(e = 128) {
	let t = new Uint8ClampedArray(e * e * 4), n = (e, t) => {
		let n = Math.imul(e, 374761393) ^ Math.imul(t, 668265263) ^ 173;
		return n = Math.imul(n ^ n >>> 13, 1274126177), ((n ^ n >>> 16) >>> 0) / 4294967295;
	};
	for (let r = 0; r < e; r++) for (let i = 0; i < e; i++) {
		let a = i / e * 8, o = r / e * 8, s = Math.floor(a), c = Math.floor(o), l = (e) => e * e * (3 - 2 * e), u = l(a - s), d = l(o - c), f = n(s % 8, c % 8), p = n((s + 1) % 8, c % 8), m = n(s % 8, (c + 1) % 8), h = n((s + 1) % 8, (c + 1) % 8), g = (f + (p - f) * u) * (1 - d) + (m + (h - m) * u) * d, _ = n(Math.floor(i / 4) + 37, Math.floor(r / 4) + 91), v = +(_ > .7 && r % 4 < 3 && i % 4 == Math.floor(_ * 13) % 4), y = Math.round(116 + n(i, r) * 18 + g * 8 - v * 12), b = (r * e + i) * 4;
		t[b] = t[b + 1] = t[b + 2] = y, t[b + 3] = 255;
	}
	return t;
}
function un() {
	let e = document.createElement("canvas");
	e.width = e.height = 128;
	let t = e.getContext("2d"), n = t.createImageData(128, 128);
	n.data.set(ln()), t.putImageData(n, 0, 0);
	let r = new u(e);
	return r.wrapS = r.wrapT = g, r.flipY = !1, r.anisotropy = 8, r;
}
function dn(e, t, n) {
	let r, i = () => +(t.image === t.userData.previewImage);
	return e.onBeforeCompile = (e) => {
		r = {
			pelotoniaDetail: { value: n },
			pelotoniaDetailEnabled: { value: i() }
		}, Object.assign(e.uniforms, r), e.vertexShader = "varying vec2 pelotoniaDetailWorld;\n" + e.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\npelotoniaDetailWorld=(modelMatrix*vec4(transformed,1.0)).xz;"), e.fragmentShader = "varying vec2 pelotoniaDetailWorld;\nuniform sampler2D pelotoniaDetail;\nuniform float pelotoniaDetailEnabled;\n" + e.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
   vec3 detailAlbedo=texture2D(pelotoniaDetail,pelotoniaDetailWorld/${16 .toFixed(1)}).rgb*2.0;
   diffuseColor.rgb*=mix(vec3(1.0),detailAlbedo,pelotoniaDetailEnabled*0.55);`);
	}, e.onBeforeRender = () => {
		r && (r.pelotoniaDetailEnabled.value = i());
	}, e.customProgramCacheKey = () => "pelotonia-terrain-detail-v1", e;
}
function fn(e, t) {
	return {
		x: Math.floor(e / 32) * 32,
		z: Math.floor(t / 32) * 32
	};
}
var pn = class {
	constructor(e = () => document.createElement("canvas")) {
		this.createCanvas = e, this.tiles = new cn(33554432);
	}
	get(e, t, n, r, i, a, o = "day") {
		if ((this.texture !== e || this.source !== e?.image) && (this.clear(), this.texture = e, this.source = e?.image), !n?.width || !r?.width || e?.image !== e?.userData?.previewImage) return null;
		let s = fn(i, a), c = `${s.x}/${s.z}/${o}`, l = this.tiles.get(c);
		if (!l) {
			let e = {
				x: s.x - 4,
				z: s.z - 4
			}, i = this.createCanvas();
			i.width = i.height = 320;
			let a = i.getContext("2d"), o = (t.columns - 1) * t.step[0], u = (t.rows - 1) * t.step[1];
			a.drawImage(n, (t.origin[0] - e.x) / 40 * 320, (t.origin[1] - e.z) / 40 * 320, o / 40 * 320, u / 40 * 320), a.globalCompositeOperation = "overlay", a.globalAlpha = .55;
			for (let t = Math.floor(e.z / 16) * 16; t < e.z + 40; t += 16) for (let n = Math.floor(e.x / 16) * 16; n < e.x + 40; n += 16) a.drawImage(r, (n - e.x) / 40 * 320, (t - e.z) / 40 * 320, 128, 128);
			a.globalCompositeOperation = "source-over", a.globalAlpha = 1, l = i, this.tiles.set(c, l);
		}
		return {
			image: l,
			origin: {
				x: s.x - 4,
				z: s.z - 4
			},
			meters: 40
		};
	}
	clear() {
		this.tiles.clear(), this.texture = null, this.source = null;
	}
};
// src/viewer/modelAssets.js
function mn(e) {
	let t = e?.attributes?.position;
	if (!t || t.itemSize !== 3 || !Number.isInteger(t.count) || t.count < 3) throw Error("Model mesh has no valid triangle positions");
	for (let e = 0; e < t.count; e++) if (!Number.isFinite(t.getX(e)) || !Number.isFinite(t.getY(e)) || !Number.isFinite(t.getZ(e))) throw Error("Model mesh contains non-finite positions");
	for (let [n, r] of Object.entries({
		normal: [3],
		uv: [2],
		uv1: [2],
		uv2: [2],
		uv3: [2],
		color: [3, 4],
		tangent: [4]
	})) {
		let i = e.attributes[n];
		if (i) {
			if (!r.includes(i.itemSize) || i.count !== t.count) throw Error(`Model mesh ${n} attribute does not match its positions`);
			for (let e = 0; e < i.count; e++) for (let t = 0; t < i.itemSize; t++) if (!Number.isFinite(i.getComponent(e, t))) throw Error(`Model mesh ${n} attribute is non-finite`);
		}
	}
	let n = e.index, r = n ? n.count : t.count;
	if (r % 3 != 0) throw Error("Model mesh has incomplete triangles");
	if (n) for (let e = 0; e < r; e++) {
		let r = n.getX(e);
		if (!Number.isInteger(r) || r < 0 || r >= t.count) throw Error("Model mesh index is outside its vertex buffer");
	}
}
function hn(e) {
	e.updateMatrixWorld(!0);
	let t = [];
	try {
		e.traverseVisible((e) => {
			if (!e.isMesh) return;
			if (e.isInstancedMesh) throw Error("Nested glTF instancing needs an explicit asset adapter");
			if (e.isSkinnedMesh || e.morphTargetInfluences?.length) throw Error("Animated/skinned atlas props need an explicit animation adapter");
			if (mn(e.geometry), !e.matrixWorld.elements.every(Number.isFinite)) throw Error("Model mesh transform is non-finite");
			let n = e.geometry.clone();
			if (t.push({
				geometry: n,
				material: e.material
			}), n.applyMatrix4(e.matrixWorld), mn(n), e.matrixWorld.determinant() < 0) {
				let e = n.index ? n.index.count : n.attributes.position.count, t = [];
				for (let r = 0; r < e; r += 3) t.push(n.index?.getX(r) ?? r, n.index?.getX(r + 2) ?? r + 2, n.index?.getX(r + 1) ?? r + 1);
				n.setIndex(t);
			}
			n.computeBoundingSphere();
		});
	} catch (e) {
		for (let e of t) e.geometry.dispose();
		throw e;
	}
	if (!t.length) throw Error("Asset contains no supported static meshes");
	return t;
}
function gn(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	for (let t of e) {
		t.geometry.dispose();
		for (let e of Array.isArray(t.material) ? t.material : [t.material]) n.add(e);
	}
	for (let e of n) {
		for (let n of Object.values(e)) n?.isTexture && t.add(n);
		e.dispose();
	}
	for (let e of t) e.dispose();
}
function _n(e, t = !0, n = []) {
	let r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set();
	e?.traverse?.((e) => {
		e.skeleton && o.add(e.skeleton), e.isInstancedMesh && s.add(e), e.geometry && r.add(e.geometry);
		for (let t of Array.isArray(e.material) ? e.material : [e.material]) t && i.add(t);
	});
	for (let e of o) e.dispose();
	for (let e of s) e.dispose();
	for (let e of r) e.dispose();
	if (t) {
		let e = new Set(n.flatMap((e) => Array.isArray(e.material) ? e.material : [e.material])), t = /* @__PURE__ */ new Set();
		for (let n of e) for (let e of Object.values(n)) e?.isTexture && t.add(e);
		for (let t of i) if (!e.has(t)) {
			for (let e of Object.values(t)) e?.isTexture && a.add(e);
			t.dispose();
		}
		for (let e of a) t.has(e) || e.dispose();
	}
}
var vn = class {
	constructor(e, t, { loader: n = new x(), timeoutMs: r = 3e4 } = {}) {
		if (!Number.isFinite(r) || r < 1 || r > 12e4) throw Error("Invalid model timeout");
		this.scene = e, this.batches = [], this.instances = [], this.errors = [], this.pending = 0, this.loaded = 0, this.disposed = !1, this.revision = 0, this.cancelJobs = /* @__PURE__ */ new Set(), this.scratch = new c.Object3D(), this.ready = Promise.all((t.assets || []).filter((e) => e.type === "gltf").map((i) => {
			let a = (t.landmarks || []).filter((e) => e.assetId === i.id);
			if (a.length) return this.pending++, new Promise((t) => {
				let o = !1, s, l = /* @__PURE__ */ new WeakSet(), u = (e, n) => {
					o || (o = !0, this.revision++, clearTimeout(s), this.cancelJobs.delete(d), this.pending--, e === "loaded" ? this.loaded++ : e === "error" && !this.disposed && this.errors.push({
						assetId: i.id,
						message: n
					}), t());
				}, d = () => u("cancelled");
				this.cancelJobs.add(d), s = setTimeout(() => u("error", "Model request timed out"), r);
				let f = (t) => {
					if (t?.scene && typeof t.scene == "object") {
						if (l.has(t.scene)) return;
						l.add(t.scene);
					}
					if (o || this.disposed) {
						_n(t?.scene);
						return;
					}
					let n = [], r = [];
					try {
						n = hn(t.scene);
						for (let e of n) {
							let t = new c.InstancedMesh(e.geometry, e.material, a.length);
							r.push(t), t.castShadow = !0, t.receiveShadow = !0, a.forEach((e, n) => {
								this.scratch.position.set(...e.position), this.scratch.rotation.set(0, e.rotation || 0, 0), this.scratch.scale.setScalar(e.scale || 1), this.scratch.updateMatrix(), t.setMatrixAt(n, this.scratch.matrix);
							});
						}
						let o = a.map((e) => (this.scratch.position.set(...e.position), this.scratch.rotation.set(0, e.rotation || 0, 0), this.scratch.scale.setScalar(e.scale || 1), this.scratch.updateMatrix(), {
							asset: i,
							location: e,
							parts: n,
							matrix: this.scratch.matrix.clone()
						}));
						e.add(...r), this.batches.push({
							asset: i,
							parts: n,
							meshes: r
						}), this.instances.push(...o), _n(t.scene, !0, n), u("loaded");
					} catch (i) {
						for (let t of r) e.remove(t), t.dispose();
						n.length ? (gn(n), _n(t?.scene, !0, n)) : _n(t?.scene), u("error", i?.message || "Model decoding failed");
					}
				};
				try {
					n.load(i.url, f, void 0, (e) => u("error", e?.message || "Model request failed"));
				} catch (e) {
					u("error", e?.message || "Model request failed");
				}
			});
		}));
	}
	status() {
		return {
			pending: this.pending,
			loaded: this.loaded,
			errors: this.errors.map((e) => ({ ...e }))
		};
	}
	dispose() {
		this.disposed = !0;
		for (let e of [...this.cancelJobs]) e();
		for (let e of this.batches) {
			for (let t of e.meshes) this.scene.remove(t), t.dispose();
			gn(e.parts);
		}
		this.batches = [], this.instances = [];
	}
}, yn = class {
	constructor(e, t, n) {
		this.scene = e, this.instances = [], this.labels = [], this.objects = [], this.paint = [], this.models = null, this.roadLabels = [], this.extraTextures = [], this.extraMaterials = [];
		let r = t.finish;
		if (!r) {
			this.ready = Promise.resolve();
			return;
		}
		this.distance = r.routeFraction * n.length;
		let i = t.route.width, a = n.at(this.distance), o = a.heading;
		this.position = a.position.clone();
		let s = r.color || "#25463e", l = r.accent || "#dec475", u = "#bec7bf", d = R(), f = [];
		this.material = d;
		let p = (e, t = a.position, n = new c.Matrix4()) => {
			f.push(e), this.instances.push({
				location: { position: t.toArray() },
				matrix: n,
				parts: [{
					geometry: e,
					material: d
				}]
			});
		}, m = new L(), h = Math.max(8, Math.ceil(i / .36));
		for (let e = 0; e < 2; e++) for (let t = 0; t < h; t++) {
			let r = this.distance - .36 + e * .36, a = r + .36, o = -i / 2 + t * i / h, s = o + i / h, l = [
				[r, o],
				[a, o],
				[a, s],
				[r, s]
			].map(([e, t]) => n.at(e, t).position.add(I(0, .047, 0)));
			this.paint.push({
				points: l,
				color: (e + t) % 2 ? "#263b36" : "#f6f2df"
			});
			let u = new c.BufferGeometry().setFromPoints([
				l[0],
				l[1],
				l[2],
				l[0],
				l[2],
				l[3]
			]);
			u.computeVertexNormals(), m.add(u, (e + t) % 2 ? "#263b36" : "#f6f2df");
		}
		let g = new c.Mesh(m.build(), d);
		if (g.receiveShadow = !0, e.add(g), this.objects.push(g), r.roadText && this.distance >= 13) {
			let t = document.createElement("canvas");
			t.width = 1024, t.height = 256;
			let a = t.getContext("2d");
			a.fillStyle = "#f4f0dc", a.textAlign = "center", a.textBaseline = "middle", a.font = `800 ${Math.min(170, 1600 / r.roadText.length)}px sans-serif`, a.fillText(r.roadText, 512, 135);
			let o = new c.CanvasTexture(t);
			o.colorSpace = c.SRGBColorSpace, this.extraTextures.push(o);
			let s = new c.MeshBasicMaterial({
				map: o,
				transparent: !0,
				depthWrite: !1,
				side: c.DoubleSide
			});
			this.extraMaterials.push(s);
			let l = [
				[-13, -i / 2 + .65],
				[-11, -i / 2 + .65],
				[-11, i / 2 - .65],
				[-13, i / 2 - .65]
			].map(([e, t]) => n.at(this.distance + e, t).position.add(I(0, .052, 0))), u = new c.BufferGeometry().setFromPoints([
				l[0],
				l[1],
				l[2],
				l[0],
				l[2],
				l[3]
			]);
			u.setAttribute("uv", new c.Float32BufferAttribute([
				0,
				0,
				0,
				1,
				1,
				1,
				0,
				0,
				1,
				1,
				1,
				0
			], 2)), u.computeVertexNormals();
			let d = new c.Mesh(u, s);
			e.add(d), this.objects.push(d), this.roadLabels.push({
				points: l,
				image: t,
				uv: [
					{
						x: 0,
						y: 1
					},
					{
						x: 0,
						y: 0
					},
					{
						x: 1,
						y: 0
					},
					{
						x: 1,
						y: 1
					}
				]
			});
		}
		for (let t of r.markers || []) {
			let r = this.distance - t.distanceBefore;
			if (!(r < 0)) for (let a of [-1, 1]) {
				let o = n.at(r, a * (i / 2 + 1.35)), d = new c.Matrix4().makeRotationY(o.heading).setPosition(o.position), f = new L();
				f.rod(I(0, 0, 0), I(0, 1.85, 0), .035, u, 6), f.box(.86, .9, .12, s, 0, 1.4, 0), f.box(.9, .045, .14, l, 0, 1.87, 0), p(f.build().applyMatrix4(d), o.position.clone().add(I(0, 1, 0)));
				let m = document.createElement("canvas");
				m.width = 512, m.height = 512;
				let h = m.getContext("2d");
				h.fillStyle = s, h.fillRect(0, 0, 512, 512), h.fillStyle = l, h.textAlign = "center", h.textBaseline = "middle";
				let g = t.label || String(t.distanceBefore) + " m";
				h.font = `800 ${Math.min(155, 720 / g.length)}px sans-serif`, h.fillText(g, 256, 256);
				let _ = new c.CanvasTexture(m);
				_.colorSpace = c.SRGBColorSpace, this.extraTextures.push(_);
				let v = new c.MeshBasicMaterial({ map: _ });
				this.extraMaterials.push(v);
				for (let t of [-1, 1]) {
					let n = d.clone().multiply(new c.Matrix4().makeTranslation(0, 1.4, t * .065)).multiply(new c.Matrix4().makeRotationY(t === 1 ? 0 : Math.PI)), r = new c.Mesh(new c.PlaneGeometry(.8, .84), v);
					r.applyMatrix4(n), e.add(r), this.objects.push(r), this.labels.push({
						points: [
							[
								-.4,
								-.42,
								0
							],
							[
								.4,
								-.42,
								0
							],
							[
								.4,
								.42,
								0
							],
							[
								-.4,
								.42,
								0
							]
						].map((e) => I(...e).applyMatrix4(n)),
						image: m,
						normal: I(0, 0, 1).transformDirection(n),
						center: I().applyMatrix4(n)
					});
				}
			}
		}
		let _ = Math.max(0, this.distance - (r.barrierBefore ?? 1e3)), v = Math.min(n.length, this.distance + (r.barrierAfter ?? 18));
		for (let e of [-1, 1]) for (let t = _; t < v; t += 2.5) {
			let r = Math.min(v, t + 2.5), a = e * (i / 2 + .55), o = n.at(t, a).position, c = n.at(r, a).position, l = new L();
			for (let e of [o, c]) {
				l.rod(e, e.clone().add(I(0, .9, 0)), .027, u, 6);
				let r = n.at(t).right;
				l.rod(e.clone().addScaledVector(r, -.22), e.clone().addScaledVector(r, .22), .025, u, 5);
			}
			for (let e of [.18, .88]) l.rod(o.clone().add(I(0, e, 0)), c.clone().add(I(0, e, 0)), .026, u, 6);
			l.rod(o.clone().add(I(0, .18, 0)), c.clone().add(I(0, .88, 0)), .015, u, 5), l.rod(o.clone().add(I(0, .88, 0)), c.clone().add(I(0, .18, 0)), .015, u, 5), Math.floor((t - _) / 2.5) % 2 == 0 && l.rod(o.clone().add(I(0, .32, 0)), c.clone().add(I(0, .32, 0)), .065, s, 6), p(l.build(), o.clone().add(c).multiplyScalar(.5));
		}
		let y = new c.Matrix4().makeRotationY(o).setPosition(a.position);
		if (this.frame = y, r.portal !== !1) {
			if (r.portalAssetId) {
				let n = t.assets.find((e) => e.id === r.portalAssetId);
				this.models = new vn(e, {
					assets: [n],
					landmarks: [{
						type: "finish-portal",
						assetId: n.id,
						position: a.position.toArray(),
						rotation: o,
						scale: r.portalScale ?? 1
					}]
				});
			} else {
				let t = new L(), n = i / 2 + .65, o = r.portalHeight ?? 4.5;
				for (let e of [-1, 1]) {
					for (let r of [-.18, .18]) t.rod(I(e * n, 0, r), I(e * n, o, r), .075, s, 8);
					for (let r = .3; r < o; r += .55) t.rod(I(e * n, r, -.18), I(e * n, r + .35, .18), .025, l, 5);
					t.box(.48, .18, .68, u, e * n, .09, 0), t.box(.22, .8, .48, l, e * n, 1.2, 0);
				}
				for (let e of [-.28, .28]) {
					t.rod(I(-n, o + .25, e), I(n, o + .25, e), .035, u, 6);
					for (let r = -n; r < n; r += .8) t.rod(I(r, o + .25, e), I(Math.min(n, r + .8), o + .65, e), .018, u, 5);
					t.rod(I(-n, o + .65, e), I(n, o + .65, e), .025, u, 5);
				}
				for (let e of [-1, 1]) {
					t.box(.18, .13, .22, "#293e43", e * (n - .1), o - .72, 0), t.ellipsoid(.045, .045, .035, "#90aba9", e * (n - .1), o - .72, .12, 6, 4);
					for (let r = 0; r < 3; r++) t.ellipsoid(.035, .035, .024, "#d8ce8b", e * (n - .42), o - .92 - r * .11, .22, 6, 4);
				}
				t.box(i + 1.65, .75, .46, s, 0, o - .15, 0), t.box(i + 1.8, .055, .5, l, 0, o + .25, 0), t.box(i + 1.8, .055, .5, l, 0, o - .55, 0), p(t.build().applyMatrix4(y), a.position.clone().add(I(0, o / 2, 0)));
				let d = document.createElement("canvas");
				d.width = 1024, d.height = 128;
				let f = d.getContext("2d");
				f.fillStyle = s, f.fillRect(0, 0, 1024, 128), f.fillStyle = "#f7f3e5", f.textAlign = "center", f.textBaseline = "middle", f.font = `700 ${Math.min(92, 920 / Math.max(4, (r.label || "FINISH").length) * 1.5)}px sans-serif`, f.fillText(r.label || "FINISH", 512, 68);
				let m = new c.CanvasTexture(d);
				m.colorSpace = c.SRGBColorSpace, this.labelTexture = m;
				let h = new c.MeshBasicMaterial({
					map: m,
					side: c.FrontSide
				});
				this.labelMaterial = h;
				for (let t of [-1, 1]) {
					let n = y.clone().multiply(new c.Matrix4().makeTranslation(0, o - .15, t * .242)).multiply(new c.Matrix4().makeRotationY(t === 1 ? 0 : Math.PI)), r = new c.Mesh(new c.PlaneGeometry(i + .9, .61), h);
					r.applyMatrix4(n), e.add(r), this.objects.push(r);
					let a = [
						[
							-(i + .9) / 2,
							-.305,
							0
						],
						[
							(i + .9) / 2,
							-.305,
							0
						],
						[
							(i + .9) / 2,
							.305,
							0
						],
						[
							-(i + .9) / 2,
							.305,
							0
						]
					].map((e) => I(...e).applyMatrix4(n));
					this.labels.push({
						points: a,
						image: d,
						normal: I(0, 0, 1).transformDirection(n),
						center: I().applyMatrix4(n)
					});
				}
			}
		}
		if (f.length) {
			let t = new c.Mesh(b(f, !1), d);
			t.castShadow = !0, t.receiveShadow = !0, e.add(t), this.objects.push(t);
		}
		this.ready = this.models?.ready || Promise.resolve();
	}
	status() {
		return this.models?.status() || {
			pending: 0,
			loaded: 0,
			errors: []
		};
	}
	dispose() {
		this.models?.dispose();
		for (let e of this.objects) this.scene.remove(e), e.geometry.dispose();
		for (let e of this.instances) e.parts[0].geometry.dispose();
		this.material?.dispose(), this.labelMaterial?.dispose(), this.labelTexture?.dispose();
		for (let e of this.extraTextures) e.dispose();
		for (let e of this.extraMaterials) e.dispose();
		this.instances = [], this.labels = [], this.paint = [];
	}
};
// src/viewer/roadEdges.js
function bn(e, t, n) {
	let { x: r, z: i } = e.position, a = Y(r * .21, i * .21, 137), o = Y(r * .7, i * .7, 149), s = Math.round(153 + a * 20 + o * 9);
	return {
		inner: n * t / 2,
		outer: n * (t / 2 + .46 + a * .22),
		color: `rgb(${s + 3},${s},${s - 18})`
	};
}
function xn(e, t) {
	let n = [], r = [], i = [], a = (t, a, o, s) => {
		let c = n.length / 3;
		for (let i of e) for (let e of [t, a]) {
			let t = typeof e == "function" ? e(i) : e, a = new d(typeof s == "function" ? s(i) : s), c = i.position.clone().addScaledVector(i.right, t);
			n.push(c.x, c.y + o, c.z), r.push(a.r, a.g, a.b);
		}
		for (let t = 0; t < e.length - 1; t++) {
			let e = c + t * 2;
			i.push(e, e + 2, e + 1, e + 1, e + 2, e + 3);
		}
	};
	for (let e of [-1, 1]) {
		let n = e * t / 2, r = (n) => bn(n, t, e).outer;
		a(...e < 0 ? [r, n] : [n, r], .025, (n) => bn(n, t, e).color);
		let i = n - e * .25;
		a(i - .05, i + .05, .055, (e) => {
			let t = Y(e.position.x * .19, e.position.z * .19, 211);
			return new d("#e5e1ce").multiplyScalar(.82 + t * .18);
		});
	}
	let o = new l();
	return o.setAttribute("position", new p(n, 3)), o.setAttribute("color", new p(r, 3)), o.setIndex(i), o.computeVertexNormals(), o;
}
// src/viewer/shoreline.js
var Sn = (e) => Math.abs(e.reduce((t, n, r) => {
	let i = e[(r + 1) % e.length];
	return t + n.x * i.z - i.x * n.z;
}, 0)) / 2;
function Cn(e, t, n = !0) {
	let r = [];
	for (let i = 0; i < e.length; i++) {
		let a = e[i], o = e[(i + 1) % e.length], s = t(a), c = t(o), l = n ? s >= 0 : s <= 0, u = n ? c >= 0 : c <= 0;
		l && r.push(a), l !== u && r.push(a.clone().lerp(o, s / (s - c)));
	}
	return r;
}
function wn(e, t) {
	let n = Math.sign((t[1].x - t[0].x) * (t[2].z - t[0].z) - (t[1].z - t[0].z) * (t[2].x - t[0].x)), r = e, i = [];
	for (let e = 0; e < 3 && r.length >= 3; e++) {
		let a = t[e], o = t[(e + 1) % 3], s = (e) => n * ((o.x - a.x) * (e.z - a.z) - (o.z - a.z) * (e.x - a.x)), c = Cn(r, s, !1);
		Sn(c) > 1e-8 && i.push(c), r = Cn(r, s);
	}
	return i;
}
function Tn(e) {
	let t = e.map((e) => {
		let t = e.outline.map((e) => ({
			x: e[0],
			z: e[2]
		}));
		t.length > 1 && t[0].x === t.at(-1).x && t[0].z === t.at(-1).z && t.pop();
		let n = _.triangulateShape(t.map((e) => new v(e.x, e.z)), []).map((e) => e.map((e) => t[e]));
		return {
			level: e.outline[0][1],
			triangles: n,
			minX: Math.min(...t.map((e) => e.x)),
			maxX: Math.max(...t.map((e) => e.x)),
			minZ: Math.min(...t.map((e) => e.z)),
			maxZ: Math.max(...t.map((e) => e.z))
		};
	});
	return (e) => {
		let n = [e];
		for (let e of t) n = n.flatMap((t) => {
			if (t.every((t) => t.y >= e.level) || t.every((t) => t.x < e.minX) || t.every((t) => t.x > e.maxX) || t.every((t) => t.z < e.minZ) || t.every((t) => t.z > e.maxZ)) return [t];
			let n = Cn(t, (t) => t.y - e.level), r = Cn(t, (t) => e.level - t.y), i = Sn(r) > 1e-8 ? [r] : [];
			for (let t of e.triangles) i = i.flatMap((e) => wn(e, t));
			return [...Sn(n) > 1e-8 ? [n] : [], ...i];
		});
		return n;
	};
}
// src/viewer/water.js
function En(e, t, n) {
	let r = !1;
	for (let i = 0, a = e.length - 1; i < e.length; a = i++) {
		let o = e[a], s = e[i];
		o[2] > n != s[2] > n && t < (s[0] - o[0]) * (n - o[2]) / (s[2] - o[2]) + o[0] && (r = !r);
	}
	return r;
}
function Dn(e) {
	let t = e.outline, n = new c.Shape(t.map((e) => new c.Vector2(e[0], -e[2]))), r = new c.ShapeGeometry(n), i = r.attributes.position, a = r.index, o = [], s = t.map((e) => e[0]), l = t.map((e) => e[2]), u = Math.max(8, Math.hypot(Math.max(...s) - Math.min(...s), Math.max(...l) - Math.min(...l)) / 28), d = (e, t, n, r = 0) => {
		let i = [
			e.distanceToSquared(t),
			t.distanceToSquared(n),
			n.distanceToSquared(e)
		], a = Math.max(...i);
		if (a <= u * u || r >= 10) o.push([
			e,
			t,
			n
		]);
		else if (i[0] === a) {
			let i = e.clone().lerp(t, .5);
			d(e, i, n, r + 1), d(i, t, n, r + 1);
		} else if (i[1] === a) {
			let i = t.clone().lerp(n, .5);
			d(e, t, i, r + 1), d(e, i, n, r + 1);
		} else {
			let i = n.clone().lerp(e, .5);
			d(e, t, i, r + 1), d(i, t, n, r + 1);
		}
	};
	for (let e = 0; e < a.count; e += 3) d(...[
		0,
		1,
		2
	].map((n) => {
		let r = a.getX(e + n);
		return new c.Vector3(i.getX(r), t[0][1], -i.getY(r));
	}));
	return r.dispose(), o;
}
function On() {
	let e = document.createElement("canvas");
	e.width = e.height = 128;
	let t = e.getContext("2d"), n = t.createImageData(128, 128);
	for (let e = 0; e < 128; e++) for (let t = 0; t < 128; t++) {
		let r = 226 + Math.sin(e * .9 + Math.sin(t * .07) * 2) * 8 + Math.sin(e * .37 + t * .03) * 5, i = (e * 128 + t) * 4;
		n.data[i] = n.data[i + 1] = n.data[i + 2] = r, n.data[i + 3] = 255;
	}
	t.putImageData(n, 0, 0);
	let r = new c.CanvasTexture(e);
	return r.wrapS = r.wrapT = c.RepeatWrapping, r.colorSpace = c.SRGBColorSpace, r;
}
var kn = class {
	constructor(e, t) {
		this.scene = e, this.specs = t.waterBodies || [], this.clipTerrainSurfaces = Tn(this.specs), this.meshes = [], this.patches = [], this.ripples = [];
		for (let n of t.waterBodies || []) {
			let t = n.outline.map((e) => e[0]), r = n.outline.map((e) => e[2]), i = Math.max(7, Math.hypot(Math.max(...t) - Math.min(...t), Math.max(...r) - Math.min(...r)) / 35), a = [];
			for (let e = Math.min(...r) + i / 2; e < Math.max(...r); e += i) for (let r = Math.min(...t) + i / 2; r < Math.max(...t); r += i) {
				let t = r + Math.sin(e * .31) * i * .25, o = 1.8 + Math.sin(r * .22 + e * .12) * .7, s = Array.from({ length: 5 }, (i, a) => new c.Vector3(t + (a / 4 - .5) * o, n.outline[0][1] + .015, e + Math.sin(a / 4 * Math.PI + r * .02) * .13));
				s.every((e) => En(n.outline, e.x, e.z)) && a.push(s);
			}
			this.ripples.push({
				outline: n.outline,
				waves: a
			});
			let o = Dn(n), s = [], l = [];
			for (let e of o) {
				let t = new c.Vector3();
				for (let n of e) s.push(...n.toArray()), l.push(n.x / 10, n.z / 10), t.add(n);
				t.divideScalar(3), this.patches.push({
					points: e,
					center: t,
					color: n.color || "#487e86"
				});
			}
			let u = new c.BufferGeometry();
			u.setAttribute("position", new c.Float32BufferAttribute(s, 3)), u.setAttribute("uv", new c.Float32BufferAttribute(l, 2)), u.computeVertexNormals(), u.computeBoundingSphere();
			let d = new c.Mesh(u, new c.MeshStandardMaterial({
				color: n.color || "#487e86",
				map: On(),
				roughness: .24,
				metalness: .08,
				side: c.DoubleSide
			}));
			d.name = `water:${n.id}`, d.receiveShadow = !0, e.add(d), this.meshes.push(d);
		}
	}
	clipTerrain(e) {
		let t = e;
		for (let e of this.specs) {
			if (!t.length) break;
			let n = t.reduce((e, t) => e.add(t), new c.Vector3()).multiplyScalar(1 / t.length);
			if (!En(e.outline, n.x, n.z) && !t.some((t) => En(e.outline, t.x, t.z))) continue;
			let r = e.outline[0][1], i = [];
			for (let e = 0; e < t.length; e++) {
				let n = t[e], a = t[(e + 1) % t.length], o = n.y >= r, s = a.y >= r;
				o && i.push(n), o !== s && i.push(n.clone().lerp(a, (r - n.y) / (a.y - n.y)));
			}
			t = i;
		}
		return t;
	}
	covers(e, t, n) {
		return this.specs.some((r) => n < r.outline[0][1] && En(r.outline, e, t));
	}
	update(e) {
		for (let t of this.meshes) t.material.map.offset.y = e * .004 % 1;
	}
	dispose() {
		for (let e of this.meshes) this.scene.remove(e), e.dispose(), e.geometry.dispose(), e.material.map.dispose(), e.material.dispose();
		this.meshes = [], this.patches = [], this.ripples = [];
	}
};
// src/viewer/groundDetails.js
function An() {
	let e = new c.IcosahedronGeometry(1, 2), t = e.attributes.position, n = new Float32Array(t.count * 3), r = new c.Color();
	for (let e = 0; e < t.count; e++) {
		let i = t.getX(e), a = t.getY(e), o = t.getZ(e), s = Y(i * 2.6 + 4, o * 2.6 - 3, 19) * 2 - 1, l = Y(i * 11 + a * 3, o * 11 - a * 4, 61) * 2 - 1, u = .88 + s * .15 + l * .04, d = Math.sin(a * 14 + i * 2.2 + o * 1.5);
		t.setXYZ(e, i * u * 1.32 + a * .12, Math.max(-.09, a * u * .69 + .39 + d * .025), o * u * .97 - a * .07);
		let f = Math.abs(Math.sin(a * 17 + i * 2.8 + o * 1.6)) < .12 ? .035 : 0, p = c.MathUtils.smoothstep(a, .15, .85) * Y(i * 4 + 7, o * 4 - 2, 101), m = s * .045 + l * .025 - d * .015 - f;
		r.setRGB(.235 + m - p * .05, .25 + m - p * .015, .225 + m - p * .06), r.toArray(n, e * 3);
	}
	return e.setAttribute("color", new c.BufferAttribute(n, 3)), e.computeVertexNormals(), e.computeBoundingSphere(), e;
}
function jn() {
	let e = [], t = [], n = new c.Color();
	for (let r = 0; r < 13; r++) {
		let i = r * 2.39996, a = .07 + r % 3 * .075, o = .2 + r % 4 * .065, s = Math.cos(i) * a, c = Math.sin(i) * a, l = .024, u = [
			[
				s - l,
				0,
				c
			],
			[
				s + l,
				0,
				c
			],
			[
				s + Math.cos(i) * .09 + l * .6,
				o * .62,
				c + Math.sin(i) * .09
			],
			[
				s + Math.cos(i) * .09 - l * .6,
				o * .62,
				c + Math.sin(i) * .09
			],
			[
				s + Math.cos(i) * .18,
				o,
				c + Math.sin(i) * .18
			]
		];
		for (let r of [
			0,
			1,
			2,
			0,
			2,
			3,
			3,
			2,
			4
		]) e.push(...u[r]), n.set(r === 4 ? "#c7bb79" : r > 1 ? "#8b9852" : "#53643b"), n.toArray(t, t.length);
	}
	let r = new c.BufferGeometry();
	r.setAttribute("position", new c.Float32BufferAttribute(e, 3)), r.setAttribute("color", new c.Float32BufferAttribute(t, 3)), r.computeVertexNormals(), r.computeBoundingSphere();
	let i = new L();
	i.parts.push(r);
	for (let e = 0; e < 3; e++) {
		let t = e * 2.39996, n = Math.cos(t) * .15, r = Math.sin(t) * .15, a = .39 + e * .035;
		i.rod(I(n, 0, r), I(n + .04, a, r + .025), .008, "#68784c", 4);
		for (let e = 0; e < 4; e++) i.ellipsoid(.018, .032, .012, "#c7b886", n + .04 + (e % 2 ? -.018 : .018), a - e * .025, r + .025, 4, 3);
	}
	for (let [e, t] of [[-.12, .07], [.13, -.08]]) i.rod(I(e, 0, t), I(e, .22, t), .007, "#6c8054", 4), i.ellipsoid(.032, .024, .03, "#e6ddbf", e, .225, t, 5, 3);
	return i.build();
}
var Mn = class {
	constructor(e, t) {
		this.scene = e, this.batches = [], this.rocks = [], this.grass = [];
		for (let [n, r] of [["rock", An], ["grass", jn]]) {
			let i = (t.landmarks || []).filter((e) => e.type === n && !e.assetId);
			if (!i.length) continue;
			let a = r(), o = new c.MeshStandardMaterial({
				vertexColors: !0,
				roughness: 1,
				side: c.DoubleSide
			}), l = new c.Object3D(), chunks = /* @__PURE__ */ new Map();
			// Local batches let WebGL cull details outside the camera's road section.
			for (let item of i) {
				let key = Math.floor(item.position[2] / 512);
				chunks.has(key) || chunks.set(key, []), chunks.get(key).push(item);
			}
			for (let items of chunks.values()) {
				let s = new c.InstancedMesh(a, o, items.length);
				for (let [index, item] of items.entries()) l.position.set(...item.position), l.rotation.set(0, item.rotation || 0, 0), l.scale.setScalar(item.scale || 1), l.updateMatrix(), s.setMatrixAt(index, l.matrix), n === "rock" ? this.rocks.push({
					location: item,
					parts: [{ geometry: a, material: o }],
					matrix: l.matrix.clone()
				}) : this.grass.push({
					...item,
					kind: "grass",
					rotation: item.rotation || 0,
					styleKey: "grass/meadow-v2",
					location: {
						position: [...item.position],
						scale: item.scale || 1
					},
					matrix: l.matrix.clone(),
					parts: [{ geometry: a, material: o }]
				});
				s.castShadow = n === "rock", s.receiveShadow = !0, e.add(s), this.batches.push(s);
			}
		}
	}
	dispose() {
		let geometries = new Set(), materials = new Set();
		for (let e of this.batches) this.scene.remove(e), e.dispose(), geometries.add(e.geometry), materials.add(e.material);
		for (let e of geometries) e.dispose();
		for (let e of materials) e.dispose();
		this.batches = [], this.rocks = [], this.grass = [];
	}
}, Nn = class {
	constructor(e, t, n = new c.TextureLoader(), { timeoutMs: r = 3e4 } = {}) {
		if (!Number.isFinite(r) || r < 1 || r > 12e4) throw Error("Invalid foliage timeout");
		this.disposed = !1, this.revision = 0, this.finishJobs = /* @__PURE__ */ new Set(), this.scene = e, this.batches = [], this.object = new c.Object3D(), this.wind = [0, 0], this.time = 0, this.pending = 0, this.loaded = 0, this.errors = [];
		let i = [], a = /* @__PURE__ */ new Map();
		for (let e of t) e.asset && (a.has(e.asset.id) || a.set(e.asset.id, {
			asset: e.asset,
			trees: []
		}), a.get(e.asset.id).trees.push(e));
		for (let { asset: t, trees: o } of a.values()) {
			let a = new c.MeshStandardMaterial({
				alphaTest: .17,
				side: c.DoubleSide,
				roughness: 1,
				transparent: !1
			}), s = new c.PlaneGeometry(t.width, t.height, 1, 8);
			s.translate(0, t.height / 2, 0);
			let l = {
				time: { value: 0 },
				amplitude: { value: 0 },
				speed: { value: 0 }
			};
			a.onBeforeCompile = (e) => {
				Object.assign(e.uniforms, {
					pelCanopyTime: l.time,
					pelCanopyAmplitude: l.amplitude,
					pelCanopySpeed: l.speed
				}), e.vertexShader = "uniform float pelCanopyTime;uniform float pelCanopyAmplitude;uniform float pelCanopySpeed;\n" + e.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      float pelWeight=pow(max(0.0,(position.y/${Math.max(1e-6, t.height).toFixed(6)}-0.4)/0.6),2.0);
      transformed.x+=sin(pelCanopyTime*(1.1+min(pelCanopySpeed,20.0)*0.06)+instanceMatrix[3].x*0.11+instanceMatrix[3].z*0.07)*pelCanopyAmplitude*pelWeight;`);
			}, a.customProgramCacheKey = () => `pelotonia-canopy-${t.height}`;
			let u = new c.InstancedMesh(s, a, o.length);
			u.visible = !1, u.castShadow = !0, u.receiveShadow = !0, u.frustumCulled = !1, e.add(u), this.batches.push({
				mesh: u,
				placements: o,
				uniforms: l
			}), this.pending++, i.push(new Promise((e) => {
				let i = !1, o, s, l = (n, r) => {
					i || (i = !0, this.revision++, clearTimeout(o), this.finishJobs.delete(d), this.pending--, n === "loaded" ? this.loaded++ : n === "error" && !this.disposed && this.errors.push({
						assetId: t.id,
						message: r
					}), e());
				}, d = () => l("cancelled");
				this.finishJobs.add(d), o = setTimeout(() => l("error", "Vegetation texture request timed out"), r);
				let f = (e) => {
					e?.isTexture && (s && s !== e && s.dispose(), s = e, s.colorSpace = c.SRGBColorSpace, s.anisotropy = 8, a.map = s, a.needsUpdate = !0);
				};
				try {
					let e = n.load(t.textureUrl, (e) => {
						i || this.disposed ? e?.isTexture && e !== s && e.dispose() : (f(e), kt(s?.image) ? (u.visible = !0, l("loaded")) : l("error", "Vegetation texture decoded without valid dimensions"));
					}, void 0, () => l("error", "Vegetation texture request failed"));
					s ? e?.isTexture && e !== s && e.dispose() : f(e);
				} catch (e) {
					l("error", e?.message || "Vegetation texture request failed");
				}
			}));
		}
		this.ready = Promise.all(i);
	}
	status() {
		return {
			pending: this.pending,
			loaded: this.loaded,
			errors: this.errors.map((e) => ({ ...e }))
		};
	}
	getImage(e) {
		let t = this.batches.find(({ placements: t }) => t[0]?.asset.id === e);
		return !this.disposed && t?.mesh.visible && t.mesh.material.map?.image || null;
	}
	update(e, t = 0, n = { wind: [0, 0] }) {
		this.time = t, this.wind = n?.wind || [0, 0];
		let r = Math.atan2(e.matrixWorld?.elements[8] ?? 0, e.matrixWorld?.elements[10] ?? 1);
		for (let { mesh: n, placements: i, uniforms: a } of this.batches) a.time.value = t, a.speed.value = Math.hypot(...this.wind), a.amplitude.value = c.MathUtils.clamp((this.wind[0] * Math.cos(r) - this.wind[1] * Math.sin(r)) * .012, -.22, .22), i.forEach((t, r) => {
			this.object.position.set(t.x, t.y, t.z), this.object.rotation.set(0, Math.atan2(e.position.x - t.x, e.position.z - t.z), 0), this.object.scale.setScalar(t.scale), this.object.updateMatrix(), n.setMatrixAt(r, this.object.matrix);
		}), n.instanceMatrix.needsUpdate = !0;
	}
	dispose() {
		this.disposed = !0;
		for (let e of [...this.finishJobs]) e();
		this.finishJobs.clear();
		for (let { mesh: e } of this.batches) e.visible = !1, this.scene.remove(e), e.dispose(), e.geometry.dispose(), e.material.map?.dispose(), e.material.dispose();
		this.batches = [];
	}
};
// src/viewer/environment.js
function Pn(e, t, n) {
	let r = new c.Mesh(t, n);
	return r.castShadow = !0, r.receiveShadow = !0, e.add(r), r;
}
function Fn(e, t, n, r, i) {
	let a = [
		[
			-t / 2,
			0,
			-n / 2
		],
		[
			t / 2,
			0,
			-n / 2
		],
		[
			0,
			r,
			-n / 2
		],
		[
			-t / 2,
			0,
			n / 2
		],
		[
			t / 2,
			0,
			n / 2
		],
		[
			0,
			r,
			n / 2
		]
	], o = [
		0,
		1,
		2,
		3,
		5,
		4,
		0,
		2,
		5,
		0,
		5,
		3,
		2,
		1,
		4,
		2,
		4,
		5
	], s = new c.BufferGeometry();
	s.setAttribute("position", new c.Float32BufferAttribute(o.flatMap((e) => a[e]), 3)), s.computeVertexNormals(), e.add(s, i, I(0, 4.3, 0));
}
function In(e = "house") {
	let t = new L(), n = e === "farm", r = n ? 9 : 6.4, i = n ? 11 : 8.4, a = n ? "#ddc99f" : "#e2d6bc";
	t.box(r, 4.4, i, a, 0, 2.2, 0), t.box(r + .3, .25, i + .3, "#b3aa8f", 0, .15, 0), Fn(t, r + 1, i + 1, 2.7, "#8e5e4a"), t.box(r + .4, .17, .14, "#6c5948", 0, 4.25, -i / 2 - .1), t.box(r + .4, .17, .14, "#6c5948", 0, 4.25, i / 2 + .1);
	for (let e of [-1, 1]) {
		for (let n of [-r * .3, r * .3]) {
			t.box(1.04, 1.35, .08, "#f2e7ce", n, 2.6, e * (i / 2 + .05)), t.box(.79, 1.1, .09, "#587a7c", n, 2.6, e * (i / 2 + .1)), t.box(.045, 1.12, .1, "#dacbb0", n, 2.6, e * (i / 2 + .15)), t.box(.82, .045, .1, "#dacbb0", n, 2.6, e * (i / 2 + .15));
			for (let r of [-1, 1]) t.box(.27, 1.28, .1, "#6a7a5e", n + r * .7, 2.6, e * (i / 2 + .06));
			t.box(1.25, .15, .28, "#aa8c6a", n, 1.89, e * (i / 2 + .17));
			for (let r = 0; r < 5; r++) t.ellipsoid(.1, .13, .1, r % 2 ? "#c6b261" : "#b76f60", n - .45 + r * .22, 2.02, e * (i / 2 + .2), 6, 4);
		}
		t.box(1.1, 2.15, .11, "#675649", 0, 1.12, e * (i / 2 + .08)), t.box(1.5, .17, .8, "#aaa38b", 0, .12, e * (i / 2 + .3)), t.ellipsoid(.035, .035, .035, "#d3b268", .38, 1.1, e * (i / 2 + .15), 6, 4);
	}
	t.box(.8, 2.2, .95, "#c9bca2", -r * .25, 6.2, -i * .22), t.box(1.02, .17, 1.15, "#a89b83", -r * .25, 7.3, -i * .22);
	for (let e = -i / 2; e < i / 2; e += .58) t.rod(I(-r / 2 - .45, 4.36, e), I(0, 6.98, e), .025, "#a6755b", 4), t.rod(I(r / 2 + .45, 4.36, e), I(0, 6.98, e), .025, "#a6755b", 4);
	return n && (t.box(3.8, 2.8, 5, "#b9b18d", r * .7, 1.4, 0), t.box(4.2, .3, 5.5, "#6f7d67", r * .7, 3, 0), t.box(2.1, 2.4, .1, "#7e674a", r * .7, 1.3, 2.55)), t.build();
}
function Ln(e = 0) {
	let t = new L(), n = [
		"#5b7858",
		"#72834e",
		"#476955"
	];
	t.rod(I(), I(.04, 4.1, 0), .22, "#6b5841", 7);
	for (let e = 0; e < 5; e++) {
		let n = e * 2.4;
		t.rod(I(0, 2.6 + e * .15, 0), I(Math.cos(n) * 1.1, 4.2 + e * .2, Math.sin(n) * 1.1), .1, "#796447", 5);
	}
	let r = [
		[
			0,
			4.6,
			0,
			1.8,
			2.3,
			1.9
		],
		[
			-1.1,
			4.4,
			.3,
			1.5,
			1.8,
			1.5
		],
		[
			1,
			4.8,
			.2,
			1.45,
			1.85,
			1.5
		],
		[
			.1,
			5.6,
			-.7,
			1.6,
			1.9,
			1.55
		]
	];
	for (let i = 0; i < r.length; i++) {
		let [a, o, s, c, l, u] = r[i];
		t.ellipsoid(c, l, u, n[(e + i) % 3], a, o, s, 9, 6);
	}
	return t.build();
}
function Rn() {
	let e = new L();
	e.rod(I(), I(0, 12.8, 0), .15, "#6d5740", 7);
	for (let t = 0; t < 13; t++) {
		let n = 2.1 + t * .77, r = (13.5 - n) * .24;
		for (let i = 0; i < 8; i++) {
			let a = i / 8 * Math.PI * 2 + t * 2.39, o = I(Math.cos(a) * r, n - .48, Math.sin(a) * r);
			e.rod(I(0, n, 0), o, .03, "#79613e", 4);
			for (let r = 0; r < 5; r++) {
				let s = .25 + r * .15, l = I(o.x * s, n - .32 * s, o.z * s), u = (1 - s) * 1.2 + .14, d = [];
				for (let e = 0; e < 3; e++) {
					let e = I(o.x * (s + .2), l.y + .15, o.z * (s + .2)), t = l.clone().add(I(Math.cos(a + Math.PI / 2) * u, .07, Math.sin(a + Math.PI / 2) * u)), n = l.clone().add(I(-Math.cos(a + Math.PI / 2) * u, -.06, -Math.sin(a + Math.PI / 2) * u));
					d.push(...l.toArray(), ...t.toArray(), ...e.toArray(), ...l.toArray(), ...e.toArray(), ...n.toArray()), l.y += .08;
				}
				let f = new c.BufferGeometry();
				f.setAttribute("position", new c.Float32BufferAttribute(d, 3)), f.computeVertexNormals(), e.add(f, [
					"#3f5c36",
					"#56703c",
					"#71824b"
				][(t + i) % 3]);
			}
		}
	}
	return e.build();
}
function zn(e, t, n) {
	let r = [], i = [], a = [], o = [], s = [], l = [], u = new kn(e, t), d = new At(), f = R();
	f.side = c.DoubleSide;
	let p = (t, n = f) => {
		let i = Pn(e, t, n);
		return r.push(i), i;
	}, m = t.terrain, h, g;
	if (m) {
		let e = [], t = [], n = [], r = m.columns, i = m.rows;
		for (let n = 0; n < i; n++) for (let i = 0; i < r; i++) {
			let a = m.origin[0] + i * m.step[0], o = m.origin[1] + n * m.step[1], s = m.heights[n * r + i];
			e.push(a, s - .06, o);
			let l = new c.Color().setHSL(.223 + Math.sin(a * .03) * .01, .22, .47 + .025 * Math.sin(a * .026 + o * .023));
			t.push(l.r, l.g, l.b);
		}
		for (let e = 0; e < i - 1; e++) for (let t = 0; t < r - 1; t++) {
			let i = e * r + t;
			n.push(i, i + r, i + 1, i + 1, i + r, i + r + 1);
		}
		let a = new c.BufferGeometry();
		a.setAttribute("position", new c.Float32BufferAttribute(e, 3)), a.setAttribute("color", new c.Float32BufferAttribute(t, 3)), a.setIndex(n), a.computeVertexNormals();
		let o = [];
		for (let e = 0; e < i; e++) for (let t = 0; t < r; t++) o.push(t / (r - 1), 1 - e / (i - 1));
		a.setAttribute("uv", new c.Float32BufferAttribute(o, 2));
		let s = h = Ht(Bt(m), m.textureUrl, d, "terrain-texture");
		g = un(), p(a, dn(new c.MeshStandardMaterial({
			map: s,
			roughness: .98,
			bumpMap: s,
			bumpScale: .11
		}), s, g));
		let l = new L(), u = m.origin[0], f = m.origin[1], _ = (r - 1) * m.step[0], v = (i - 1) * m.step[1], y = m.heights.reduce((e, t) => Math.min(e, t), Infinity) - 1;
		l.box(_ + 2, 3, v + 2, "#a09577", u + _ / 2, y - 1.5, f + v / 2), l.box(_ + 3, 1.2, v + 3, "#d4c8a9", u + _ / 2, y - 3.6, f + v / 2), p(l.build());
	}
	let _ = t.synthetic === !0 && t.route.points?.length === 2 && n.length > 4e4, v = Math.ceil(n.length / (_ ? 9 : 1.8)), y = [.../* @__PURE__ */ new Set([...Array.from({ length: v + 1 }, (e, t) => t / v * n.length), ...(t.route.surfaces || []).flatMap((e) => [e.from, e.to]).filter((e) => e >= 0 && e <= n.length)])].sort((e, t) => e - t), b = y.length - 1, x = [], S = [];
	for (let e = 0; e <= b; e++) {
		let r = y[e], { position: i, right: a } = n.at(r);
		l.push({
			position: i.clone(),
			right: a.clone(),
			distance: r
		});
		for (let e of [-1, 1]) x.push(...i.clone().addScaledVector(a, e * t.route.width / 2).add(I(0, H, 0)).toArray());
		if (e < b) {
			let t = e * 2;
			S.push(t, t + 2, t + 1, t + 1, t + 2, t + 3);
		}
	}
	let C = new c.BufferGeometry();
	C.setAttribute("position", new c.Float32BufferAttribute(x, 3)), C.setIndex(S), C.computeVertexNormals();
	let w = [];
	for (let e = 0; e <= b; e++) w.push(0, y[e] / 8, 1, y[e] / 8);
	C.setAttribute("uv", new c.Float32BufferAttribute(w, 2));
	let T = new Xt(t, d), E = T.entries[0].texture, D = 0, O = T.indexAt((y[0] + y[1]) / 2);
	for (let e = 1; e <= b; e++) {
		let t = e < b ? T.indexAt((y[e] + y[e + 1]) / 2) : -1;
		t !== O && (C.addGroup(D * 6, (e - D) * 6, O), D = e, O = t);
	}
	p(C, T.materials), p(xn(l, t.route.width));
	// Long schematic roads need local marking meshes so the GPU can cull
	// kilometres that are outside the current camera view.
	let markingChunk = t.synthetic === !0 && t.route.points?.length === 2 && n.length >= 4e4 ? 512 : n.length;
	for (let from = 0; from < n.length; from += markingChunk) {
		let to = Math.min(n.length, from + markingChunk), k = new L();
		for (let index = Math.ceil(from / 6.8); index * 6.8 < to; index++) {
			let e = index * 6.8;
			if (T.at(e).type !== "asphalt") continue;
			let t = n.at(e).position.add(I(0, .075, 0)), r = n.at(e + 2.3).position.add(I(0, .075, 0));
			k.rod(t, r, .037, "#dedaca", 4);
		}
		for (let index = Math.ceil(from / 9); index * 9 < to; index++) {
			let e = index * 9;
			if (index % 3 !== 0) continue;
			for (let side of [-1, 1]) {
				let i = n.at(e, side * (t.route.width / 2 + 1.25));
				k.rod(i.position, i.position.clone().add(I(0, .75, 0)), .065, "#e4dfcd", 5), k.box(.1, .14, .09, "#59675e", i.position.x, i.position.y + .58, i.position.z);
			}
		}
		p(k.build());
	}
	for (let e of t.landmarks || []) ["tree", "pine"].includes(e.type) && !(t.assets || []).some((t) => t.id === e.assetId && t.type === "gltf") && i.push({
		x: e.position[0],
		y: e.position[1],
		z: e.position[2],
		scale: e.scale || 1,
		kind: e.type === "pine" ? 3 : 0,
		asset: (t.assets || []).find((t) => t.id === e.assetId),
		rotation: e.rotation || 0
	});
	let A = new sn(e, t, n), ee = new Jt(e, t, n), te = new L(), ne = [];
	for (let e of t.route.barriers || []) for (let r = e.from; r < Math.min(e.to, n.length); r += 3) {
		if (A.ranges.some((t) => t.side === e.side && r >= t.from && r < t.to)) continue;
		let i = n.at(r, e.side * (t.route.width / 2 + .7)).position, a = n.at(Math.min(r + 3, e.to), e.side * (t.route.width / 2 + .7)).position;
		te.rod(i, i.clone().add(I(0, .85, 0)), .06, "#9a9f91", 5);
		for (let e of [.58, .82]) te.rod(i.clone().add(I(0, e, 0)), a.clone().add(I(0, e, 0)), .07, "#d5d7c4", 5);
		ne.push({
			a: i.toArray(),
			b: a.toArray()
		});
	}
	ne.length && p(te.build());
	for (let e of t.landmarks || []) {
		if (!["house", "farm"].includes(e.type) || (t.assets || []).some((t) => t.id === e.assetId && t.type === "gltf")) continue;
		let n = p(In(e.type));
		n.position.set(...e.position), n.rotation.y = e.rotation || 0, n.scale.setScalar(e.scale || 1), a.push({ ...e });
		let r = e.position[2], i = e.position[0];
		for (let e = 0; e < 10; e++) {
			let t = [
				i - 7 + e * 1.5,
				z(m, i - 7 + e * 1.5, r + 8),
				r + 8
			];
			o.push(t);
		}
	}
	let re = new L();
	for (let e of o) {
		re.rod(I(...e), I(e[0], e[1] + 1.1, e[2]), .055, "#b6a47b", 5);
		for (let t of [.45, .85]) re.rod(I(e[0], e[1] + t, e[2]), I(e[0] + 1.5, z(m, e[0] + 1.5, e[2]) + t, e[2]), .045, "#c5b58b", 4);
	}
	p(re.build());
	for (let t = 0; t < 4; t++) {
		let n = i.filter((e) => e.kind === t && !e.asset), a = new c.InstancedMesh(t === 3 ? Rn() : Ln(t), f, n.length), o = new c.Object3D();
		n.forEach((e, t) => {
			o.position.set(e.x, e.y, e.z), o.rotation.y = e.rotation, o.scale.setScalar(e.scale), o.updateMatrix(), a.setMatrixAt(t, o.matrix);
		}), a.castShadow = !0, a.receiveShadow = !0, e.add(a), r.push(a);
	}
	let ie = new Mn(e, t), ae = new Nn(e, i), oe = new vn(e, t), se = new $t(e, t), ce = new yn(e, {
		...t,
		finish: t.finish ? {
			...t.finish,
			barrierBefore: 0,
			barrierAfter: 0
		} : void 0
	}, n), j = new on(e, t, n);
	return {
		water: u,
		terrainTexture: h,
		terrainDetail: g,
		roadTexture: E,
		roadSurfaces: T,
		eventBarriers: A,
		crowd: j,
		roadWeather: ee,
		textures: d,
		details: ie,
		foliage: ae,
		models: oe,
		finish: ce,
		spectators: se,
		roadWidth: t.route.width,
		routeSamples: l,
		barriers: [...ne, ...A.segments],
		trees: i,
		houses: a,
		fields: s,
		fences: o,
		terrain: m,
		width: t.route.width,
		dispose() {
			u.dispose(), g?.dispose(), d.dispose(), ie.dispose(), ae.dispose(), oe.dispose(), ce.dispose(), se.dispose(), ee.dispose(), j.dispose(), A.dispose(), T.dispose();
			for (let t of r) e.remove(t), t.dispose?.(), t.geometry.dispose(), !Array.isArray(t.material) && t.material !== f && (t.material.map?.dispose(), t.material.dispose());
			f.dispose();
		}
	};
}
// src/viewer/textureMips.js
var Bn = class {
	constructor(e = () => document.createElement("canvas"), t = 25165824) {
		this.createCanvas = e, this.levels = new cn(t), this.ids = /* @__PURE__ */ new WeakMap(), this.next = 1;
	}
	get(e, t, n = t) {
		if (!e?.width || !e?.height || !Number.isFinite(t) || t <= 0 || !Number.isFinite(n) || n <= 0) return e;
		let r = Math.max(e.width / t, e.height / n), i = Math.max(0, Math.min(12, Math.floor(Math.log2(Math.max(1, r)))));
		if (!i) return e;
		let a = this.ids.get(e);
		a || (a = this.next++, this.ids.set(e, a));
		let o = a + "/" + i, s = this.levels.get(o);
		if (!s) {
			if (s = this.createCanvas(), s.width = Math.max(1, Math.floor(e.width / 2 ** i)), s.height = Math.max(1, Math.floor(e.height / 2 ** i)), s.width * s.height * 4 > this.levels.budget) return e;
			let t = s.getContext("2d");
			t.imageSmoothingEnabled = !0, t.imageSmoothingQuality = "high", t.drawImage(e, 0, 0, s.width, s.height), this.levels.set(o, s);
		}
		return s;
	}
	clear() {
		this.levels.clear(), this.ids = /* @__PURE__ */ new WeakMap(), this.next = 1;
	}
};
// src/viewer/canopyWind.js
function Vn(e, t, n = [0, 0], r = 0) {
	let i = n[0] * Math.cos(r) - n[1] * Math.sin(r), a = Math.max(-.22, Math.min(.22, i * .012)), o = t * (1.1 + Math.min(Math.hypot(...n), 20) * .06) + e.x * .11 + e.z * .07;
	return Math.sin(o) * a || 0;
}
function Hn(e) {
	return Math.max(0, (e - .4) / .6) ** 2;
}
function Un(e) {
	return Math.abs(e) < .5 ? 1 : Math.abs(e) < 2 ? 4 : 8;
}
// src/viewer/riderShadows.js
function Wn(e, t, n, r = "day") {
	let i = e.riderModel || B(), a = e.position.clone().add(I(0, H + .001, 0)), o = e.right.clone().cross(e.tangent).negate().normalize(), s = I(-55, r === "evening" ? 60 : 100, 35), c = s.dot(o);
	if (c <= .1) return [];
	let l = (t) => t.clone().applyMatrix4(e.matrix), u = (t) => t.clone().applyMatrix4(e.upperLocal).applyMatrix4(e.matrix), d = [];
	function f(t, r, i) {
		t = t.clone().addScaledVector(s, -t.clone().sub(a).dot(o) / c), r = r.clone().addScaledVector(s, -r.clone().sub(a).dot(o) / c);
		let l = t.clone().sub(a).dot(e.right) + e.sample.lateral, u = r.clone().sub(a).dot(e.right) + e.sample.lateral, f = n / 2, p = 0, m = 1, h = u - l;
		if (Math.abs(h) < 1e-9) {
			if (Math.abs(l) > f) return;
		} else {
			let e = (-f - l) / h, t = (f - l) / h;
			if (p = Math.max(0, Math.min(e, t)), m = Math.min(1, Math.max(e, t)), p > m) return;
		}
		let g = t.clone();
		d.push({
			a: g.clone().lerp(r, p),
			b: g.lerp(r, m),
			radius: i
		});
	}
	let p = [
		[I(0, .35, -.56), I(0, .94, -.2)],
		[I(0, .94, -.2), I(0, .35, .56)],
		[I(0, .35, -.56), I(0, q.bottomBracket, 0)],
		[I(0, q.bottomBracket, 0), I(0, .87, .38)],
		[I(0, q.bottomBracket, 0), I(0, .94, -.2)]
	];
	for (let [e, t] of p) f(l(e), l(t), .025);
	f(u(I(0, 1.03, -.14)), u(I(0, 1.3, .21)), .135), f(u(I(0, 1.43, .35)), u(I(0, 1.55, .35)), .1);
	for (let n of [-1, 1]) {
		let r = it(Ot(n, wt(e.sample, t, e.rider.number) + (n === 1 ? Math.PI : 0)), n, e.crash), a = I(n * i.hipHalfWidth, 1.01, -.14).applyMatrix4(e.upperLocal), o = K(a, r, q.upperLeg, q.lowerLeg, I(n * .08, 0, 1));
		f(l(a), l(o), .065 * i.legScale), f(l(o), l(r), .04 * i.legScale);
		let s = at(Dt(n, e.upperLocal, (n < 0 ? e.motion?.leftArm : e.motion?.rightArm) || 0, i), n, e.upperLocal, e.crash), c = I(n * i.shoulderHalfWidth, 1.3, .21).applyMatrix4(e.upperLocal), u = K(c, s, .28, .29, I(n * .35, -.6, -.25));
		f(l(c), l(u), .05 * i.armScale), f(l(u), l(s), .035 * i.armScale);
	}
	for (let e of [-.56, .56]) for (let t = 0; t < 12; t++) {
		let n = (t) => l(I(0, .35 + Math.cos(t / 12 * Math.PI * 2) * .335, e + Math.sin(t / 12 * Math.PI * 2) * .335));
		f(n(t), n(t + 1), .026);
	}
	return d;
}
// src/viewer/spriteState.js
var Gn = (e, t) => (e % t + t) % t, X = (e) => Math.round(e * 20) / 20 || 0;
function Kn(e, t, n, r = {}, i = 0, a = 0) {
	return {
		bin: Gn(Math.round(e / (Math.PI * 2) * 24), 24),
		frame: Gn(Math.floor(t / (Math.PI * 2) * 8), 8),
		wheelBin: Gn(Math.floor(n / .335 / (Math.PI / 6)), 2),
		lift: X(r.lift || 0),
		pitch: X(r.pitch || 0),
		celebration: X(r.celebration || 0),
		leftArm: X(r.leftArm ?? r.celebration ?? 0),
		rightArm: X(r.rightArm ?? r.celebration ?? 0),
		roadPitch: X(i),
		roll: X(a)
	};
}
// src/viewer/riderPicking.js
function qn(e, t, n, r = !1) {
	let i = null, a = Infinity, o = null;
	for (let { a: r, b: s, radius: c, depthRadius: l = 0 } of e) {
		let e = s.x - r.x, u = s.y - r.y, d = e * e + u * u, f = d ? Math.max(0, Math.min(1, ((t - r.x) * e + (n - r.y) * u) / d)) : 0, p = Math.hypot(r.x + f * e - t, r.y + f * u - n), m = 1 / ((1 - f) / r.w + f / s.w) - l;
		if (!Number.isFinite(m) || m <= 0) continue;
		p <= c && (i === null || m < i) && (i = m);
		let h = p - c;
		h < a && (a = h, o = m);
	}
	return i ?? (r ? null : o);
}
function Jn(e, t, n) {
	if (!n?.depth || !e.length) return null;
	let r = Math.max(0, Math.floor(t.x)), i = Math.min(n.cols * n.step, Math.ceil(t.x + t.width)), a = Math.max(0, Math.floor(t.y)), o = Math.min(n.rows * n.step, Math.ceil(t.y + t.height)), s = [], c = !1;
	for (let t = a; t < o; t++) {
		let o = null;
		for (let l = r; l <= i; l++) {
			let u = l < i ? qn(e, l + .5, t + .5) : null, d = u !== null && !n.hidden({
				x: l + .5,
				y: t + .5,
				w: u
			});
			l < i && !d && !c && (t > a && s.push({
				x: r,
				y: a,
				width: i - r,
				height: t - a
			}), c = !0), d && o === null && (o = l), !d && o !== null && (c && s.push({
				x: o,
				y: t,
				width: l - o,
				height: 1
			}), o = null);
		}
	}
	return c ? s : null;
}
function Yn(e, t, n, r) {
	for (let i = e.length - 1; i >= 0; i--) {
		let a = e[i];
		if (a.clip && !a.clip.some((e) => t >= e.x && t < e.x + e.width && n >= e.y && n < e.y + e.height)) continue;
		let o = qn(a.parts, t, n, !0);
		if (!(o === null || r?.hidden({
			x: t,
			y: n,
			w: o
		})) && (!a.alphaAt || a.alphaAt(t, n))) return a.id;
	}
	return null;
}
// src/viewer/surfaceDepth.js
var Xn = class {
	constructor(e = 3) {
		this.step = e;
	}
	reset(e, t) {
		let n = Math.ceil(e / this.step), r = Math.ceil(t / this.step);
		(n !== this.cols || r !== this.rows) && (this.cols = n, this.rows = r, this.depth = new Float32Array(n * r)), this.depth.fill(Infinity);
	}
	polygon(e) {
		if (!(e.length < 3 || e.some((e) => !e))) for (let t = 1; t < e.length - 1; t++) this.triangle(e[0], e[t], e[t + 1]);
	}
	triangle(e, t, n) {
		let r = (t.y - n.y) * (e.x - n.x) + (n.x - t.x) * (e.y - n.y);
		if (Math.abs(r) < 1e-8 || ![
			e,
			t,
			n
		].every((e) => e.w > 0)) return;
		let i = Math.max(0, Math.floor(Math.min(e.x, t.x, n.x) / this.step)), a = Math.min(this.cols - 1, Math.floor(Math.max(e.x, t.x, n.x) / this.step)), o = Math.max(0, Math.floor(Math.min(e.y, t.y, n.y) / this.step)), s = Math.min(this.rows - 1, Math.floor(Math.max(e.y, t.y, n.y) / this.step));
		for (let c = o; c <= s; c++) for (let o = i; o <= a; o++) {
			let i = (o + .5) * this.step, a = (c + .5) * this.step, s = ((t.y - n.y) * (i - n.x) + (n.x - t.x) * (a - n.y)) / r, l = ((n.y - e.y) * (i - n.x) + (e.x - n.x) * (a - n.y)) / r, u = 1 - s - l;
			if (s < 0 || l < 0 || u < 0) continue;
			let d = 1 / (s / e.w + l / t.w + u / n.w), f = c * this.cols + o;
			d < this.depth[f] && (this.depth[f] = d);
		}
	}
	hidden(e, t = .15) {
		let n = Math.floor(e.x / this.step), r = Math.floor(e.y / this.step);
		return n < 0 || r < 0 || n >= this.cols || r >= this.rows ? !1 : e.w > this.depth[r * this.cols + n] + t;
	}
}, Zn = class {
	constructor(e = () => document.createElement("canvas")) {
		this.createCanvas = e, this.clear();
	}
	get(e, t = "day") {
		let n = e?.image, r = e?.userData;
		if (!n) return null;
		if (n === r?.previewImage) return r.compatibilityImages?.[t] || n;
		let i = r?.compatibilityShadeMasks?.[t];
		if (!i || !n.width || !n.height) return n;
		let a = this.entries.get(e);
		if (a && a.source === n && a.maskOwner === r.compatibilityShadeMasks || (a = {
			source: n,
			maskOwner: r.compatibilityShadeMasks,
			images: /* @__PURE__ */ new Map()
		}, this.entries.set(e, a)), !a.images.has(t)) {
			let e = Math.min(1024, Math.max(512, n.width, n.height)), r = this.createCanvas();
			r.width = r.height = e;
			let o = r.getContext("2d");
			o.drawImage(n, 0, 0, e, e), o.globalCompositeOperation = "source-atop", o.drawImage(i, 0, 0, e, e), o.globalCompositeOperation = "source-over", a.images.set(t, r);
		}
		return a.images.get(t);
	}
	clear() {
		this.entries = /* @__PURE__ */ new WeakMap();
	}
};
// src/viewer/groundShadows.js
function Qn(e, t, n) {
	return !e || t >= e.origin[0] && n >= e.origin[1] && t <= e.origin[0] + (e.columns - 1) * e.step[0] && n <= e.origin[1] + (e.rows - 1) * e.step[1];
}
function $n(e, t, n = 100) {
	if (!Qn(t, e.x, e.z)) return null;
	let r = (t) => I(e.x + 55 * t, e.y - n * t, e.z - 35 * t), i = (e) => e.y - z(t, e.x, e.z), a = i(e);
	if (a < -.01) return null;
	if (a <= .01) return I(e.x, z(t, e.x, e.z) + .06, e.z);
	let o = Math.min(...t?.step || [1, 1]) / (2 * Math.hypot(55, 35)), s = 0;
	for (let e = 1; e <= 4096; e++) {
		let n = e * o, a = r(n);
		if (!Qn(t, a.x, a.z)) return null;
		if (i(a) <= 0) {
			let e = n;
			for (let t = 0; t < 14; t++) {
				let t = (s + e) / 2;
				i(r(t)) > 0 ? s = t : e = t;
			}
			let a = r((s + e) / 2);
			return a.y = z(t, a.x, a.z) + .06, a;
		}
		s = n;
	}
	return null;
}
function er(e, t, n = 100) {
	if (!e.asset) return [];
	let r = e.asset.width * e.scale, i = e.asset.height * e.scale, a = I(35, 0, 55).normalize(), o = [];
	for (let s = 0; s <= 12; s++) {
		let c = i * s / 12;
		o.push([-1, 1].map((i) => $n(I(e.x + a.x * r * i / 2, e.y + c, e.z + a.z * r * i / 2), t, n)));
	}
	let s = [], c = (e, t) => {
		let n = /* @__PURE__ */ new Set([e, t]), r = (e, t) => {
			if (t - e < 2) return;
			let i = 0, a = -1;
			for (let n = e + 1; n < t; n++) for (let r = 0; r < 2; r++) {
				let s = o[e][r].clone().lerp(o[t][r], (n - e) / (t - e)).distanceTo(o[n][r]);
				s > i && (i = s, a = n);
			}
			i > .08 && (n.add(a), r(e, a), r(a, t));
		};
		r(e, t);
		let i = [...n].sort((e, t) => e - t);
		for (let e = 0; e < i.length - 1; e++) {
			let t = i[e], n = i[e + 1];
			s.push({
				points: [
					o[t][0],
					o[n][0],
					o[n][1],
					o[t][1]
				],
				uv: [
					{
						x: 0,
						y: 1 - t / 12
					},
					{
						x: 0,
						y: 1 - n / 12
					},
					{
						x: 1,
						y: 1 - n / 12
					},
					{
						x: 1,
						y: 1 - t / 12
					}
				]
			});
		}
	}, l = -1;
	for (let e = 0; e <= 13; e++) {
		let t = e < 13 && o[e].every(Boolean);
		t && l < 0 && (l = e), !t && l >= 0 && (e - l > 1 && c(l, e - 1), l = -1);
	}
	return s;
}
var tr = class {
	constructor() {
		this.clear();
	}
	get(e, t, n) {
		this.terrain !== t && (this.clear(), this.terrain = t);
		let r = this.trees.get(e);
		return r || (r = /* @__PURE__ */ new Map(), this.trees.set(e, r)), r.has(n) || r.set(n, er(e, t, n)), r.get(n);
	}
	clear() {
		this.trees = /* @__PURE__ */ new WeakMap(), this.terrain = null;
	}
}, nr = /* @__PURE__ */ new WeakMap();
function rr(e, t) {
	let [n, r, i] = e, [a, o, s] = t, c = (r.x - n.x) * (i.y - n.y) - (i.x - n.x) * (r.y - n.y);
	if (!Number.isFinite(c) || Math.abs(c) < 1e-8) return null;
	let l = ((o.x - a.x) * (i.y - n.y) - (s.x - a.x) * (r.y - n.y)) / c, u = ((s.x - a.x) * (r.x - n.x) - (o.x - a.x) * (i.x - n.x)) / c, d = ((o.y - a.y) * (i.y - n.y) - (s.y - a.y) * (r.y - n.y)) / c, f = ((s.y - a.y) * (r.x - n.x) - (o.y - a.y) * (i.x - n.x)) / c, p = [
		l,
		d,
		u,
		f,
		a.x - l * n.x - u * n.y,
		a.y - d * n.x - f * n.y
	];
	return p.every(Number.isFinite) ? p : null;
}
function ir(e, t = .8) {
	let n = e.reduce((e, t) => e + t.x, 0) / 3, r = e.reduce((e, t) => e + t.y, 0) / 3, i = Math.min(...e.map((t, i) => {
		let a = e[(i + 1) % 3], o = Math.hypot(a.x - t.x, a.y - t.y) || 1;
		return Math.abs((a.x - t.x) * (r - t.y) - (a.y - t.y) * (n - t.x)) / o;
	})), a = Math.max(...e.map((e) => Math.hypot(e.x - n, e.y - r)), .1), o = Math.max(0, t), s = 1 + Math.min(o / Math.max(i, .1), o / a);
	return e.map((e) => ({
		x: n + (e.x - n) * s,
		y: r + (e.y - r) * s
	}));
}
function ar(e, t, n, r, i = !1, a = .8) {
	let o = rr(n, r);
	if (!o || !t?.width || !t?.height) return !1;
	e.save();
	let s = ir(r, a);
	if (e.beginPath(), e.moveTo(s[0].x, s[0].y), e.lineTo(s[1].x, s[1].y), e.lineTo(s[2].x, s[2].y), e.closePath(), e.clip(), e.transform(...o), i) {
		let r = nr.get(e);
		r || (r = /* @__PURE__ */ new WeakMap(), nr.set(e, r));
		let i = r.get(t);
		if (i || (i = e.createPattern(t, "repeat"), i && r.set(t, i)), i) {
			e.fillStyle = i;
			let t = n.map((e) => e.x), r = n.map((e) => e.y);
			e.fillRect(Math.min(...t) - 1, Math.min(...r) - 1, Math.max(...t) - Math.min(...t) + 2, Math.max(...r) - Math.min(...r) + 2);
		}
	} else e.drawImage(t, 0, 0);
	return e.restore(), !0;
}
// src/viewer/terrainCells.js
var or = class {
	constructor(e = 16384, t = 16384) {
		this.cells = /* @__PURE__ */ new Map(), this.centers = /* @__PURE__ */ new Map(), this.maxCells = e, this.maxCenters = t;
	}
	center(e, t, n, r, i) {
		(this.terrain !== e || this.water !== t) && (this.clear(), this.terrain = e, this.water = t);
		let a = `${n}/${r}/${i}`, o = this.cells.get(a)?.center || this.centers.get(a);
		for (o ||= I(n + i / 2, z(e, n + i / 2, r + i / 2), r + i / 2), this.centers.delete(a), this.centers.set(a, o); this.centers.size > this.maxCenters;) this.centers.delete(this.centers.keys().next().value);
		return o;
	}
	get(e, t, n, r, i) {
		(this.terrain !== e || this.water !== t) && (this.clear(), this.terrain = e, this.water = t);
		let a = `${n}/${r}/${i}`, o = this.cells.get(a);
		if (o) return this.cells.delete(a), this.cells.set(a, o), o;
		let s = [
			z(e, n, r),
			z(e, n + i, r),
			z(e, n, r + i),
			z(e, n + i, r + i)
		], l = (s[1] - s[0]) / i, u = (s[2] - s[0]) / i, d = c.MathUtils.smoothstep(Math.hypot(l, u), .48, 1.1), f = 39 + (1 + .5 * l - .3 * u) / Math.sqrt(1 + l * l + u * u) * 12 + Math.sin(n * .024 + r * .013) * 1.2, p = t.clipTerrain([
			[n, r],
			[n, r + i + .1],
			[n + i + .1, r + i + .1],
			[n + i + .1, r]
		].map(([t, n]) => I(t, z(e, t, n) - .08, n))), m = [
			[n, r],
			[n, r + i + .1],
			[n + i + .1, r + i + .1],
			[n + i + .1, r]
		].map(([t, n]) => I(t, z(e, t, n) - .08, n));
		for (o = {
			surface: p,
			surfaces: [[
				0,
				1,
				2
			], [
				0,
				2,
				3
			]].flatMap((e) => {
				let n = e.map((e) => m[e]);
				return t.clipTerrainSurfaces ? t.clipTerrainSurfaces(n) : [t.clipTerrain(n)];
			}).filter((e) => e.length >= 3),
			center: this.center(e, t, n, r, i),
			roughness: Math.max(...s) - Math.min(...s),
			slope: Math.hypot(l, u),
			shade: c.MathUtils.clamp((1 + .5 * l - .3 * u) / Math.sqrt(1 + l * l + u * u), .2, 1.2),
			color: `hsl(${78 - d * 23} ${25 - d * 16}% ${f + d * 10}%)`
		}, this.cells.set(a, o); this.cells.size > this.maxCells;) this.cells.delete(this.cells.keys().next().value);
		return o;
	}
	clear() {
		this.cells.clear(), this.centers.clear(), this.terrain = null, this.water = null;
	}
};
// src/viewer/staticFaces.js
function sr(e) {
	let t = [];
	for (let n of e.parts) {
		let r = n.geometry, i = r.attributes.position, a = r.attributes.color, o = r.index, s = Array.isArray(n.material) ? n.material : [n.material], c = o ? o.count : i.count, l = r.drawRange.start || 0, u = Math.min(c, l + r.drawRange.count);
		for (let n = l; n < u; n += 3) {
			let c = s[0];
			if (r.groups.length && (c = s[r.groups.find((e) => n >= e.start && n < e.start + e.count)?.materialIndex || 0]), c?.visible === !1 || c?.opacity === 0) continue;
			let l = [
				0,
				1,
				2
			].map((e) => o ? o.getX(n + e) : n + e), u = l.map((t) => new y().fromBufferAttribute(i, t).applyMatrix4(e.matrix)), f = u[1].clone().sub(u[0]).cross(u[2].clone().sub(u[0])).normalize(), p = a ? new d().fromBufferAttribute(a, l[0]) : new d(1, 1, 1);
			c?.color && p.multiply(c.color), t.push({
				world: u,
				normal: f,
				color: p,
				opacity: c?.opacity ?? 1
			});
		}
	}
	return t;
}
var cr = class {
	constructor() {
		this.cache = /* @__PURE__ */ new WeakMap();
	}
	get(e, t = "day", n = 0) {
		let r = this.cache.get(e);
		if (r || (r = { faces: sr(e) }, this.cache.set(e, r)), r.light !== t || r.sunYaw !== n) {
			let e = new y(-55, t === "evening" ? 60 : 100, 35).normalize().applyAxisAngle(new y(0, 1, 0), n);
			r.rendered = r.faces.map((t) => ({
				world: t.world,
				color: "#" + t.color.clone().multiplyScalar(.74 + .26 * Math.max(0, t.normal.dot(e))).getHexString(),
				opacity: t.opacity
			})), r.light = t, r.sunYaw = n;
		}
		return r.rendered;
	}
}, lr = class {
	constructor(e) {
		this.domElement = document.createElement("canvas"), this.ctx = this.domElement.getContext("2d", { alpha: !1 }), e.appendChild(this.domElement), this.mode = "Compatibility", this.surfaceDepth = new Xn(), this.width = 1, this.height = 1, this.projection = new c.Matrix4(), this.temp = I(), this.drawCount = 0, this.riderHits = [], this.lastMs = 0, this.spriteCache = new cn(), this.spectatorSprites = new cn(25165824), this.roadMips = new Bn(), this.jerseyImages = /* @__PURE__ */ new WeakMap(), this.nextJerseyImageId = 1, this.staticFaces = new cr(), this.terrainCells = new or(), this.terrainImages = new Zn(), this.terrainDetail = new pn(), this.groundShadows = new tr(), this.spriteMode = !1, this.spriteCamera = new c.PerspectiveCamera(16, 192 / 224, .1, 100), this.spriteMatrix = new c.Matrix4();
	}
	resize(e, t) {
		this.width = e, this.height = t, this.domElement.width = e, this.domElement.height = t;
	}
	project(e) {
		let t = this.projection.elements, n = e.x, r = e.y, i = e.z, a = t[3] * n + t[7] * r + t[11] * i + t[15];
		if (a <= .1) return null;
		let o = (t[0] * n + t[4] * r + t[8] * i + t[12]) / a, s = (t[1] * n + t[5] * r + t[9] * i + t[13]) / a;
		return {
			x: (o + 1) * this.width / 2,
			y: (1 - s) * this.height / 2,
			w: a,
			scale: this.height / (2 * Math.tan(this.fov / 2) * a)
		};
	}
	polygon(e, t, n) {
		let r = e.map((e) => this.project(e));
		if (r.some((e) => !e) || r.every((e) => e.x < -60) || r.every((e) => e.x > this.width + 60) || r.every((e) => e.y < -60) || r.every((e) => e.y > this.height + 60)) return;
		let i = this.ctx;
		i.beginPath(), i.moveTo(r[0].x, r[0].y);
		for (let e = 1; e < r.length; e++) i.lineTo(r[e].x, r[e].y);
		i.closePath(), i.fillStyle = t, i.fill(), n && (i.strokeStyle = n, i.lineWidth = .6, i.stroke()), this.drawCount++;
	}
	texturedPolygon(e, t, n, r = !1, i = .8) {
		if (!t?.width || !t?.height || e.length < 3) return;
		let a = e.map((e) => this.project(e));
		if (!a.some((e) => !e)) for (let o = 1; o < e.length - 1; o++) {
			let s = [
				0,
				o,
				o + 1
			];
			ar(this.ctx, t, s.map((t) => n(e[t], t)), s.map((e) => a[e]), r, i);
		}
	}
	surfaceUnderlay(e, t) {
		if (!e.length) return;
		let n = this.ctx;
		n.beginPath();
		for (let t of e) {
			let e = t.map((e) => this.project(e));
			if (e.length < 3 || e.some((e) => !e)) continue;
			let r = 0;
			for (let t = 0; t < e.length; t++) {
				let n = e[t], i = e[(t + 1) % e.length];
				r += n.x * i.y - i.x * n.y;
			}
			r < 0 && e.reverse(), n.moveTo(e[0].x, e[0].y);
			for (let t = 1; t < e.length; t++) n.lineTo(e[t].x, e[t].y);
			n.closePath();
		}
		n.fillStyle = t, n.fill(), this.drawCount++;
	}
	line(e, t, n = 1) {
		let r = e.map((e) => this.project(e));
		if (r.some((e) => !e)) return;
		let i = this.ctx;
		i.beginPath(), i.moveTo(r[0].x, r[0].y);
		for (let e = 1; e < r.length; e++) i.lineTo(r[e].x, r[e].y);
		i.strokeStyle = t, i.lineWidth = n, i.lineCap = "round", i.lineJoin = "round", i.stroke(), this.drawCount++;
	}
	disc(e, t, n, r, i, a) {
		this.polygon(Array.from({ length: 16 }, (a, o) => I(e + Math.cos(o / 16 * Math.PI * 2) * r, t, n + Math.sin(o / 16 * Math.PI * 2) * i)), a);
	}
	render(e, t, n, r, i, a, o = "day") {
		let s = performance.now(), c = this.ctx, l = this.width, u = this.height;
		this.drawCount = 0, this.riderHits = [], this.surfaceDepth.reset(l, u), e.updateMatrixWorld(), this.projection.multiplyMatrices(e.projectionMatrix, e.matrixWorldInverse), this.fov = e.fov * Math.PI / 180, this.cameraPosition = e.position, this.spectatorYaw = Math.round(Math.atan2(e.position.x - i.x, e.position.z - i.z) / (Math.PI * 2) * 24) / 24 * Math.PI * 2, this.lightPreset = o;
		let d = c.createLinearGradient(0, 0, 0, u), f = Oe(o, t.weather);
		d.addColorStop(0, f.sky), d.addColorStop(1, f.horizon), c.fillStyle = d, c.fillRect(0, 0, l, u);
		let p = t.terrain;
		this.terrain = p, this.foliage = t.foliage;
		for (let e of t.water.patches) this.surfaceDepth.polygon(e.points.map((e) => this.project(e)));
		if (!this.grain) {
			let e = document.createElement("canvas");
			e.width = e.height = 64;
			let t = e.getContext("2d"), n = t.createImageData(64, 64), r = 7;
			for (let e = 0; e < n.data.length; e += 4) {
				r = r * 16807 % 2147483647;
				let t = r % 255;
				n.data[e] = n.data[e + 1] = n.data[e + 2] = t, n.data[e + 3] = 7;
			}
			t.putImageData(n, 0, 0), this.grain = c.createPattern(e, "repeat");
		}
		if (p) {
			let e = [], n = Math.floor(i.x / 4) * 4, r = Math.floor(i.z / 4) * 4;
			for (let i = Math.max(r - 240, p.origin[1]); i < Math.min(r + 240, p.origin[1] + (p.rows - 1) * p.step[1] - 4); i += 4) for (let r = Math.max(n - 220, p.origin[0]); r < Math.min(n + 220, p.origin[0] + (p.columns - 1) * p.step[0] - 4); r += 4) {
				let n = this.project(this.terrainCells.center(p, t.water, r, i, 4));
				if (!n || n.x < -l * .3 || n.x > l * 1.3 || n.y < -u * .3 || n.y > u * 1.3) continue;
				let a = this.terrainCells.get(p, t.water, r, i, 4);
				a.surfaces.length && e.push({
					cell: a,
					depth: n.w
				});
			}
			for (let n of t.water.patches) {
				let t = this.project(n.center);
				t && e.push({
					water: n,
					depth: t.w
				});
			}
			e.sort((e, t) => t.depth - e.depth), this.surfaceUnderlay(e.filter((e) => e.cell && e.cell.slope < 1.2).flatMap((e) => e.cell.surfaces), "#6f824b"), this.surfaceUnderlay(e.filter((e) => e.cell && e.cell.slope >= 1.2).flatMap((e) => e.cell.surfaces), "#72756c");
			let a = this.terrainImages.get(t.terrainTexture, o);
			for (let n of e) {
				if (n.water) {
					this.polygon(n.water.points, n.water.color, n.water.color);
					continue;
				}
				let e = n.cell.center.distanceTo(i) < 130 && this.project(n.cell.center)?.scale > 2 ? this.terrainDetail.get(t.terrainTexture, p, a, t.terrainDetail?.image, n.cell.center.x, n.cell.center.z, o) : null, r = e?.image || a;
				for (let t of n.cell.surfaces) this.surfaceDepth.polygon(t.map((e) => this.project(e))), r?.width || this.polygon(t, n.cell.color), r?.width && this.texturedPolygon(t, r, (t) => ({
					x: e ? (t.x - e.origin.x) / e.meters * r.width : (t.x - p.origin[0]) / ((p.columns - 1) * p.step[0]) * r.width,
					y: e ? (t.z - e.origin.z) / e.meters * r.height : (t.z - p.origin[1]) / ((p.rows - 1) * p.step[1]) * r.height
				}));
			}
		}
		if (!p) for (let e of t.water.patches) this.polygon(e.points, e.color, e.color);
		for (let e of t.water.ripples) {
			let t = e.outline.map((e) => this.project(I(...e)));
			if (!t.some((e) => !e)) {
				c.save(), c.beginPath(), t.forEach((e, t) => t ? c.lineTo(e.x, e.y) : c.moveTo(e.x, e.y)), c.closePath(), c.clip();
				for (let t of e.waves) this.line(t, "#d0e7d625", .6);
				c.restore();
			}
		}
		for (let e of t.fields) {
			let { x: t, z: n, width: r, depth: i } = e;
			this.polygon([
				[-1, -1],
				[-1, 1],
				[1, 1],
				[1, -1]
			].map(([e, a]) => I(t + e * r / 2, z(p, t + e * r / 2, n + a * i / 2) + .03, n + a * i / 2)), e.color);
			for (let e = -r / 2; e < r / 2; e += 2) this.line([I(t + e, z(p, t + e, n - i / 2) + .05, n - i / 2), I(t + e, z(p, t + e, n + i / 2) + .05, n + i / 2)], "#a59569", .6);
		}
		let m = [], h = [];
		for (let e of t.routeSamples) e.position.distanceTo(i) < 310 && this.project(e.position) ? h.push(e) : h.length && (m.push(h), h = []);
		h.length && m.push(h);
		for (let e of m) {
			if (e.length < 2) continue;
			let n = (e, t) => e.position.clone().addScaledVector(e.right, t).add(I(0, H, 0)), r = [];
			for (let t = 0; t < e.length - 1; t++) {
				let n = e[t], i = e[t + 1], a = this.project(n.position), o = this.project(i.position);
				!a || !o || Math.min(a.w, o.w) < 2 || r.push({
					a: n,
					b: i,
					depth: (a.w + o.w) / 2,
					screenScale: Math.max(.1, Math.min(a.scale, o.scale))
				});
			}
			r.sort((e, t) => t.depth - e.depth);
			for (let { a: e, b: i, screenScale: a } of r) for (let r of [-1, 1]) {
				let a = bn(e, t.width, r), o = bn(i, t.width, r);
				this.polygon([
					n(e, a.inner),
					n(i, o.inner),
					n(i, o.outer),
					n(e, a.outer)
				], a.color, a.color);
			}
			for (let { a: e, b: i, screenScale: a } of r) {
				let r = (t) => [
					n(e, -t),
					n(i, -t),
					n(i, t),
					n(e, t)
				];
				this.surfaceDepth.polygon(r(t.width / 2).map((e) => this.project(e)));
				let o = t.roadSurfaces?.at((e.distance + i.distance) / 2), s = o?.type || "asphalt", c = {
					asphalt: "#60665f",
					gravel: "#b1a68c",
					cobbles: "#878776",
					dirt: "#988163"
				}[s];
				this.polygon(r(t.width / 2), c, c);
				let l = o?.texture?.image || t.roadTexture?.image, u = o?.tileLength || 8, d = o?.repeatAcross || 1, f = this.roadMips?.get(l, t.width / d * a, u * a) || l;
				if (f?.width) {
					let n = [
						{
							x: 0,
							y: e.distance / u * f.height
						},
						{
							x: 0,
							y: i.distance / u * f.height
						},
						{
							x: f.width * d,
							y: i.distance / u * f.height
						},
						{
							x: f.width * d,
							y: e.distance / u * f.height
						}
					];
					this.texturedPolygon(r(t.width / 2), f, (e, t) => n[t], !0);
				}
				if (t.weather && ["rain", "sleet"].includes(t.weather.condition) && this.polygon(r(t.width / 2), "#344e6922"), s === "asphalt") for (let r of [-1, 1]) this.line([n(e, r * (t.width / 2 - .25)), n(i, r * (t.width / 2 - .25))], "#c7c8af", .8);
				s === "asphalt" && Math.floor(e.distance / 3.6) % 2 == 0 && this.line([e.position.clone().add(I(0, .075, 0)), i.position.clone().add(I(0, .075, 0))], "#d7d7c2", Math.max(.5, (this.project(e.position)?.scale || 1) * .075));
			}
		}
		if (t.roadWeather?.wet) {
			this.ctx.save(), this.ctx.globalAlpha = t.roadWeather.wet * .16;
			for (let e of t.roadWeather.patches) this.polygon(e, "#c6d5d9");
			this.ctx.restore();
		}
		for (let e of t.finish?.paint || []) this.polygon(e.points, e.color);
		for (let e of t.finish?.roadLabels || []) this.texturedPolygon(e.points, e.image, (t, n) => ({
			x: e.uv[n].x * e.image.width,
			y: e.uv[n].y * e.image.height
		}), !1, 0);
		for (let e of t.spectators?.instances || []) {
			let [t, n, r] = e.location.position, i = this.project(I(t, n, r));
			i && i.x > 0 && i.x < l && i.y > 0 && i.y < u && this.disc(t, n + .015, r, .19 * (e.location.scale || 1), .28 * (e.location.scale || 1), "#18302a33");
		}
		for (let e of n.riderTransforms.values()) {
			let n = this.project(e.position);
			if (!(!n || n.x < -40 || n.x > l + 40 || n.y < -40 || n.y > u + 40)) for (let i of Wn(e, a, r.width || t.roadWidth || 8, o)) this.line([i.a, i.b], "#152c294f", Math.max(.45, n.scale * i.radius * 2));
		}
		for (let e of t.trees) {
			if (!e.asset) continue;
			let n = t.foliage.getImage(e.asset.id);
			if (!n?.width) continue;
			let r = this.project(I(e.x, e.y, e.z));
			!r || r.x < -160 || r.x > l + 160 || r.y < -200 || r.y > u + 200 || this.foliageShadow(e, n, t.water);
		}
		let g = [];
		for (let e of t.details.rocks) {
			let t = this.project(I(...e.location.position));
			t && t.x > -60 && t.x < l + 60 && t.y > -60 && t.y < u + 60 && t.scale * (e.location.scale || 1) > 1.5 && g.push({
				kind: "model",
				data: e,
				depth: t.w
			});
		}
		for (let e of t.details.grass) {
			let t = this.project(I(...e.position));
			t && t.x > 0 && t.x < l && t.y > 0 && t.y < u && t.scale * (e.scale || 1) > 2 && g.push({
				kind: "grass",
				data: e,
				p: t,
				depth: t.w
			});
		}
		for (let e of [
			...t.models.instances,
			...t.spectators?.instances || [],
			...t.crowd?.instances || [],
			...t.finish?.instances || [],
			...t.finish?.models?.instances || []
		]) {
			let t = this.project(I(...e.location.position));
			t && (e.kind !== "spectator" || t.scale > 2) && t.x > -200 && t.x < l + 200 && t.y > -200 && t.y < u + 200 && g.push({
				kind: "model",
				data: e,
				depth: t.w
			});
		}
		for (let e of t.barriers || []) {
			let t = I(...e.a), n = I(...e.b), r = this.project(t);
			r && g.push({
				kind: "rail",
				data: {
					a: t,
					b: n,
					event: e.event,
					color: e.color
				},
				depth: r.w
			});
		}
		for (let e of t.trees) {
			let t = this.project(I(e.x, e.y, e.z));
			t && t.x > -80 && t.x < l + 80 && t.y > -80 && t.y < u + 160 && g.push({
				kind: "tree",
				data: e,
				p: t,
				depth: t.w
			});
		}
		for (let e of t.houses) {
			let t = this.project(I(...e.position));
			t && g.push({
				kind: "house",
				data: e,
				p: t,
				depth: t.w
			});
		}
		for (let e of n.riderTransforms.values()) {
			let t = this.project(mt(e));
			t && t.x > -20 && t.x < l + 20 && t.y > -20 && t.y < u + 40 && g.push({
				kind: "rider",
				data: e,
				p: t,
				depth: t.w
			});
		}
		for (let e of t.finish?.labels || []) {
			let t = this.project(e.center);
			t && e.normal.dot(this.cameraPosition.clone().sub(e.center)) > 0 && g.push({
				kind: "finishLabel",
				data: e,
				depth: t.w
			});
		}
		for (let e of t.roadWeather?.spray || []) {
			let t = this.project(e[0]);
			t && !this.surfaceDepth.hidden(t) && g.push({
				kind: "spray",
				data: e,
				depth: t.w
			});
		}
		g.sort((e, t) => t.depth - e.depth);
		for (let e of g) {
			if (e.kind === "spray" && this.line(e.data, "#cfdfda55", .65), e.kind === "model" && (e.data.kind === "spectator" ? this.spectatorSprite(e.data) : this.model(e.data)), e.kind === "finishLabel") {
				let t = e.data, n = [
					{
						x: 0,
						y: 1
					},
					{
						x: 1,
						y: 1
					},
					{
						x: 1,
						y: 0
					},
					{
						x: 0,
						y: 0
					}
				];
				this.texturedPolygon(t.points, t.image, (e, r) => ({
					x: n[r].x * t.image.width,
					y: n[r].y * t.image.height
				}), !1, 0);
			}
			if (e.kind === "grass" && this.spectatorSprite(e.data), e.kind === "rail") {
				let { a: t, b: n, event: r, color: i } = e.data;
				this.line([t, t.clone().add(I(0, .85, 0))], "#8b9584", 1);
				for (let e of r ? [.18, .88] : [.58, .82]) this.line([t.clone().add(I(0, e, 0)), n.clone().add(I(0, e, 0))], "#e1e3cf", Math.max(.8, (this.project(t)?.scale || 1) * .1));
				r && (this.line([t.clone().add(I(0, .18, 0)), n.clone().add(I(0, .88, 0))], "#b9c5b8", .65), this.line([t.clone().add(I(0, .88, 0)), n.clone().add(I(0, .18, 0))], "#b9c5b8", .65), this.line([t.clone().add(I(0, .34, 0)), n.clone().add(I(0, .34, 0))], i || "#315845", Math.max(1, (this.project(t)?.scale || 1) * .13)));
			}
			e.kind === "tree" && this.tree(e.data, e.p), e.kind === "house" && this.house(e.data), e.kind === "rider" && this.riderSprite(e.data, a);
		}
		let _ = c.createLinearGradient(0, 0, 0, u * .65);
		_.addColorStop(0, f.fog + Math.round(f.haze * 255).toString(16).padStart(2, "0")), _.addColorStop(1, f.fog + "00"), c.fillStyle = _, c.fillRect(0, 0, l, u * .65), this.lastMs = performance.now() - s;
	}
	spectatorSprite(e) {
		let t = I(...e.location.position), n = this.project(t);
		if (!n) return;
		let r = this.cameraPosition.clone().sub(t), i = this.spectatorYaw ?? Math.round(Math.atan2(r.x, r.z) / (Math.PI * 2) * 24) / 24 * Math.PI * 2, a = e.rotation - i, o = (Math.round(a / (Math.PI * 2) * 24) % 24 + 24) % 24, s = e.styleKey + "/" + o + "/" + i + "/" + this.lightPreset, l = this.spectatorSprites.get(s);
		if (!l) {
			let t = document.createElement("canvas");
			t.width = 96, t.height = 112;
			let n = {
				ctx: this.ctx,
				projection: this.projection,
				width: this.width,
				height: this.height,
				fov: this.fov,
				cameraPosition: this.cameraPosition,
				surfaceDepth: this.surfaceDepth
			};
			this.ctx = t.getContext("2d"), this.width = 96, this.height = 112, this.spriteCamera.position.set(0, 5.8, 8), this.spriteCamera.lookAt(0, .77, 0), this.spriteCamera.updateMatrixWorld(), this.projection = new c.Matrix4().multiplyMatrices(this.spriteCamera.projectionMatrix, this.spriteCamera.matrixWorldInverse), this.cameraPosition = this.spriteCamera.position, this.fov = this.spriteCamera.fov * Math.PI / 180;
			let r = this.project(I());
			this.surfaceDepth = { hidden: () => !1 }, e.kind === "spectator" && this.disc(0, .01, 0, .18, .24, "#1c302d3b"), this.model({
				...e,
				matrix: new c.Matrix4().makeRotationY(o / 24 * Math.PI * 2),
				sunYaw: -i
			}), Object.assign(this, n), l = {
				canvas: t,
				anchor: r
			}, this.spectatorSprites.set(s, t), t.anchor = r;
		}
		let u = l.canvas || l, d = l.anchor || u.anchor, f = e.location.scale || 1, p = n.scale * f / d.scale, m = {
			x: n.x - d.x * p,
			y: n.y - d.y * p,
			width: u.width * p,
			height: u.height * p
		}, h = (e) => this.project(t.clone().add(I(0, e * f, 0))), g = (e.kind === "grass" ? [{
			a: h(.03),
			b: h(.52),
			radius: n.scale * .34 * f,
			depthRadius: .25 * f
		}] : [{
			a: h(.1),
			b: h(1.3),
			radius: n.scale * .24 * f,
			depthRadius: .2 * f
		}, {
			a: h(1.4),
			b: h(1.8),
			radius: n.scale * .35 * f,
			depthRadius: .2 * f
		}]).filter((e) => e.a && e.b);
		if (!g.length) return;
		let _ = Jn(g, m, this.surfaceDepth);
		if (!_ || _.length) {
			if (this.ctx.save(), _) {
				this.ctx.beginPath();
				for (let e of _) this.ctx.rect(e.x, e.y, e.width, e.height);
				this.ctx.clip();
			}
			this.ctx.drawImage(u, m.x, m.y, m.width, m.height), this.ctx.restore();
		}
	}
	model(e) {
		let t = [];
		for (let n of this.staticFaces.get(e, this.lightPreset, e.sunYaw || 0)) {
			let e = n.world.map((e) => this.project(e));
			if (e.some((e) => !e) || e.every((e) => e.x < 0) || e.every((e) => e.x > this.width) || e.every((e) => e.y < 0) || e.every((e) => e.y > this.height)) continue;
			let r = this.project(n.world.reduce((e, t) => e.add(t), I()).multiplyScalar(1 / 3));
			r && this.surfaceDepth.hidden(r) || t.push({
				screen: e,
				color: n.color,
				opacity: n.opacity,
				depth: e.reduce((e, t) => e + t.w, 0) / 3
			});
		}
		t.sort((e, t) => t.depth - e.depth);
		let n = this.ctx;
		n.save();
		for (let { screen: e, color: r, opacity: i } of t) n.globalAlpha = i, n.beginPath(), n.moveTo(e[0].x, e[0].y), n.lineTo(e[1].x, e[1].y), n.lineTo(e[2].x, e[2].y), n.closePath(), n.fillStyle = r, n.fill();
		n.restore();
	}
	foliageShadow(e, t, n) {
		this.shadowMasks ||= /* @__PURE__ */ new WeakMap();
		let r = this.shadowMasks.get(t);
		if (!r) {
			r = document.createElement("canvas"), r.width = 128, r.height = 192;
			let e = r.getContext("2d");
			e.drawImage(t, 0, 0, 128, 192), e.globalCompositeOperation = "source-in", e.fillStyle = "#152719", e.fillRect(0, 0, 128, 192), this.shadowMasks.set(t, r);
		}
		this.ctx.save(), this.ctx.globalAlpha = this.lightPreset === "evening" ? .28 : .24;
		let i = this.groundShadows.get(e, this.terrain, this.lightPreset === "evening" ? 60 : 100);
		for (let e of i) {
			let t = e.points.reduce((e, t) => e.add(t), I()).multiplyScalar(.25);
			n.covers(t.x, t.z, t.y) || this.texturedPolygon(e.points, r, (t, n) => ({
				x: e.uv[n].x * r.width,
				y: e.uv[n].y * r.height
			}), !1, 0);
		}
		this.ctx.restore();
	}
	pine(e, t) {
		if (e.asset) {
			let n = this.foliage.getImage(e.asset.id);
			if (n?.width) {
				let r = t.scale * e.scale, i = Vn(e, this.foliage.time, this.foliage.wind, this.spectatorYaw) * r, a = Un(i), o = n.height / a;
				for (let s = 0; s < a; s++) {
					let c = s * o, l = a === 1 ? 0 : i * Hn(1 - (s + .5) / a);
					this.ctx.drawImage(n, 0, c, n.width, o, t.x - e.asset.width * r / 2 + l, t.y - e.asset.height * r + s * e.asset.height * r / a, e.asset.width * r, e.asset.height * r / a + (a > 1 ? .5 : 0));
				}
				return;
			}
			return;
		}
		this.pineSprites ||= /* @__PURE__ */ new Map();
		let n = Math.floor(e.rotation * 2) % 5, r = this.pineSprites.get(n);
		if (!r) {
			r = document.createElement("canvas"), r.width = 180, r.height = 320;
			let e = r.getContext("2d"), t = 71 + n, i = () => (t = t * 16807 % 2147483647, t / 2147483647), a = e.createLinearGradient(35, 0, 145, 0);
			a.addColorStop(0, "#344d29"), a.addColorStop(.65, "#59703a"), a.addColorStop(1, "#7e8948"), e.fillStyle = a, e.beginPath(), e.moveTo(90, 20);
			for (let t = 16; t >= 0; t--) {
				let n = 270 - t * 14, r = 68 * (1 - t / 18);
				e.lineTo(90 - r * .76, n - 12), e.lineTo(90 - r * (.95 + i() * .12), n + 8), e.lineTo(90 - r * .63, n + 2);
			}
			for (let t = 0; t <= 16; t++) {
				let n = 270 - t * 14, r = 68 * (1 - t / 18);
				e.lineTo(90 + r * .63, n + 2), e.lineTo(90 + r * (.95 + i() * .12), n + 8), e.lineTo(90 + r * .76, n - 12);
			}
			e.closePath(), e.fill(), e.strokeStyle = "#70543b", e.lineWidth = 3.6, e.beginPath(), e.moveTo(90, 300), e.lineTo(90, 28), e.stroke();
			for (let t = 0; t < 17; t++) {
				let n = 270 - t * 14, r = 68 * (1 - t / 18);
				for (let a of [-1, 1]) {
					let o = 90 + a * r * (.8 + i() * .3), s = n + 8 + i() * 8;
					e.strokeStyle = "#514c2f", e.lineWidth = 1.6, e.beginPath(), e.moveTo(90, n - 7), e.lineTo(o, s), e.stroke();
					for (let r = 0; r < 9; r++) {
						let c = r / 9, l = 90 + (o - 90) * c, u = n - 7 + (s - n + 7) * c;
						for (let n = 0; n < 6; n++) {
							let o = (1 - c) * 14 + 5;
							a * (.3 + n * .2), e.strokeStyle = [
								"#334d29",
								"#536b35",
								"#6b7a3e",
								"#82904e"
							][(t + r + n) % 4], e.lineWidth = .7 + i() * .8, e.beginPath(), e.moveTo(l, u), e.lineTo(l + a * (o * (.6 + i() * .5)), u - o * (.3 + n * .13)), e.stroke();
						}
					}
				}
			}
			this.pineSprites.set(n, r);
		}
		let i = e.scale;
		I(e.x, e.y, e.z);
		let a = [];
		for (let t = 0; t < 18; t++) {
			let n = t / 18 * Math.PI * 2;
			a.push(I(e.x + 3.3 * i + Math.cos(n) * 4.5 * i, e.y + .04, e.z - 2 * i + Math.sin(n) * 1.6 * i));
		}
		this.polygon(a, "#263b2330");
		let o = t.scale * i / 20;
		this.ctx.drawImage(r, t.x - 90 * o, t.y - 300 * o, 180 * o, 320 * o);
	}
	tree(e, t) {
		if (e.kind === 3) {
			this.pine(e, t);
			return;
		}
		let n = this.ctx, r = e.scale, i = this.project(I(e.x, e.y + 5.2 * r, e.z));
		if (!i) return;
		let a = t.scale * r;
		this.disc(e.x + 1.3 * r, e.y + .02, e.z + .8 * r, 2.8 * r, 1.7 * r, "#3a523a25"), this.line([I(e.x, e.y, e.z), I(e.x + .06 * r, e.y + 4.4 * r, e.z)], "#705c45", Math.max(1, a * .32));
		let o = [
			[
				"#536e50",
				"#71875c",
				"#82946a"
			],
			[
				"#657a47",
				"#829357",
				"#9ba566"
			],
			[
				"#416551",
				"#5e7f60",
				"#7b956e"
			]
		][e.kind], s = [
			[
				-1.2,
				.15,
				1.4
			],
			[
				1.1,
				.1,
				1.45
			],
			[
				0,
				-.25,
				1.9
			],
			[
				-1,
				-1.05,
				1.35
			],
			[
				.9,
				-1.1,
				1.3
			],
			[
				0,
				-1.55,
				1.25
			]
		];
		for (let e = 0; e < s.length; e++) {
			let [t, r, c] = s[e], l = n.createRadialGradient(i.x + (t - .5) * a, i.y + (r - .5) * a, .1, i.x + t * a, i.y + r * a, c * a);
			l.addColorStop(0, o[2]), l.addColorStop(1, o[0]), n.fillStyle = l, n.beginPath(), n.ellipse(i.x + t * a, i.y + r * a, c * a, c * a * 1.04, 0, 0, Math.PI * 2), n.fill();
		}
		if (a > 3) {
			n.globalAlpha = .3;
			for (let e = 0; e < 18; e++) {
				let t = e * 2.399, r = Math.sqrt(e / 18) * 2.4 * a;
				n.fillStyle = e % 2 ? o[2] : o[1], n.beginPath(), n.arc(i.x + Math.cos(t) * r, i.y + Math.sin(t) * r - a * .5, a * .23, 0, Math.PI * 2), n.fill();
			}
			n.globalAlpha = 1;
		}
	}
	house(e) {
		let [t, n, r] = e.position, i = e.scale || 1, a = e.rotation || 0, o = (e, o, s) => I(t + (e * Math.cos(a) + s * Math.sin(a)) * i, n + o * i, r + (-e * Math.sin(a) + s * Math.cos(a)) * i), s = e.type === "farm" ? 9 : 6.4, c = e.type === "farm" ? 11 : 8.4;
		this.disc(t + 2, n + .02, r + 1, s * .8 * i, c * .65 * i, "#334d322b");
		let l = [
			{
				points: [
					[
						-s / 2,
						0,
						-c / 2
					],
					[
						s / 2,
						0,
						-c / 2
					],
					[
						s / 2,
						4.4,
						-c / 2
					],
					[
						-s / 2,
						4.4,
						-c / 2
					]
				],
				color: "#d8c8ab"
			},
			{
				points: [
					[
						-s / 2,
						0,
						c / 2
					],
					[
						s / 2,
						0,
						c / 2
					],
					[
						s / 2,
						4.4,
						c / 2
					],
					[
						-s / 2,
						4.4,
						c / 2
					]
				],
				color: "#e5d8ba"
			},
			{
				points: [
					[
						-s / 2,
						0,
						-c / 2
					],
					[
						-s / 2,
						0,
						c / 2
					],
					[
						-s / 2,
						4.4,
						c / 2
					],
					[
						-s / 2,
						4.4,
						-c / 2
					]
				],
				color: "#c4b494"
			},
			{
				points: [
					[
						s / 2,
						0,
						-c / 2
					],
					[
						s / 2,
						0,
						c / 2
					],
					[
						s / 2,
						4.4,
						c / 2
					],
					[
						s / 2,
						4.4,
						-c / 2
					]
				],
				color: "#dbcdb0"
			}
		];
		l.sort((e, t) => (this.project(o(...t.points[0]))?.w || 0) - (this.project(o(...e.points[0]))?.w || 0));
		for (let e of l) this.polygon(e.points.map((e) => o(...e)), e.color);
		for (let e of [-1, 1]) {
			this.polygon([
				[
					-s / 2,
					4.4,
					e * c / 2
				],
				[
					s / 2,
					4.4,
					e * c / 2
				],
				[
					0,
					7.1,
					e * c / 2
				]
			].map((e) => o(...e)), "#d6c6a5");
			for (let t of [-s * .28, s * .28]) {
				let n = e * (c / 2 + .03);
				this.polygon([
					[
						t - .45,
						1.95,
						n
					],
					[
						t + .45,
						1.95,
						n
					],
					[
						t + .45,
						3.15,
						n
					],
					[
						t - .45,
						3.15,
						n
					]
				].map((e) => o(...e)), "#547577"), this.line([o(t, 2, n), o(t, 3.1, n)], "#e9dfc4", .7), this.line([o(t - .45, 2.55, n), o(t + .45, 2.55, n)], "#e9dfc4", .7);
				for (let e of [-1, 1]) {
					let r = t + e * .64;
					this.polygon([
						[
							r - .12,
							1.95,
							n
						],
						[
							r + .12,
							1.95,
							n
						],
						[
							r + .12,
							3.15,
							n
						],
						[
							r - .12,
							3.15,
							n
						]
					].map((e) => o(...e)), "#6a7b5e");
				}
				this.line([o(t - .56, 1.89, n), o(t + .56, 1.89, n)], "#bba883", 1.2);
			}
			this.polygon([
				[
					-.5,
					0,
					e * (c / 2 + .06)
				],
				[
					.5,
					0,
					e * (c / 2 + .06)
				],
				[
					.5,
					2.1,
					e * (c / 2 + .06)
				],
				[
					-.5,
					2.1,
					e * (c / 2 + .06)
				]
			].map((e) => o(...e)), "#78604a");
		}
		let u = [{
			p: [
				[
					-s / 2 - .5,
					4.35,
					-c / 2 - .5
				],
				[
					0,
					7.1,
					-c / 2 - .5
				],
				[
					0,
					7.1,
					c / 2 + .5
				],
				[
					-s / 2 - .5,
					4.35,
					c / 2 + .5
				]
			],
			color: "#96694f"
		}, {
			p: [
				[
					s / 2 + .5,
					4.35,
					-c / 2 - .5
				],
				[
					0,
					7.1,
					-c / 2 - .5
				],
				[
					0,
					7.1,
					c / 2 + .5
				],
				[
					s / 2 + .5,
					4.35,
					c / 2 + .5
				]
			],
			color: "#ae7c5c"
		}];
		u.sort((e, t) => (this.project(o(...t.p[0]))?.w || 0) - (this.project(o(...e.p[0]))?.w || 0));
		for (let e of u) this.polygon(e.p.map((e) => o(...e)), e.color);
		for (let e = -c / 2; e < c / 2; e += 1) this.line([
			o(-s / 2 - .4, 4.4, e),
			o(0, 7.12, e),
			o(s / 2 + .4, 4.4, e)
		], "#b88b6644", .5);
		this.line([o(-s * .2, 6.3, -c * .2), o(-s * .2, 7.4, -c * .2)], "#c8b79a", Math.max(1, (this.project(o(0, 0, 0))?.scale || 1) * .7));
	}
	riderSprite(e, t) {
		let n = e.riderModel || B(), r = mt(e), i = this.project(r);
		if (!i) return;
		let a = new c.Vector3().subVectors(this.cameraPosition, r), o = Math.atan2(a.x, a.z), { bin: s, frame: l, wheelBin: u, lift: d, pitch: f, celebration: p, leftArm: m, rightArm: h, roadPitch: g, roll: _ } = Kn(e.heading - o, wt(e.sample, t, e.rider.number), e.sample.distance, e.motion, e.roadPitch, e.roll), v = 0;
		e.jerseyImage && (v = this.jerseyImages.get(e.jerseyImage), v || (v = this.nextJerseyImageId++, this.jerseyImages.set(e.jerseyImage, v)));
		let y = Math.round(o / (Math.PI * 2) * 24), b = y / 24 * Math.PI * 2, x = Math.round((e.crash?.amount || 0) * 20) / 20, S = `${x}/${n.category}/${n.hairStyle}/${n.hairColor}/${this.lightPreset}/${y}/${v}/${e.team.id}/${e.kit?.color}/${e.helmetColor}/${e.rider.jersey}/${e.rider.helmet}/${s}/${l}/${u}/${d}/${f}/${p}/${m}/${h}/${g}/${_}`, C = this.spriteCache.get(S);
		if (!C) {
			let t = document.createElement("canvas");
			t.width = 192, t.height = 224;
			let n = {
				ctx: this.ctx,
				projection: this.projection,
				width: this.width,
				height: this.height,
				fov: this.fov,
				cameraPosition: this.cameraPosition
			};
			this.ctx = t.getContext("2d"), this.width = 192, this.height = 224, this.spriteCamera.position.set(0, 5.8, 8), this.spriteCamera.lookAt(0, .77, 0), this.spriteCamera.updateMatrixWorld(), this.projection = new c.Matrix4().multiplyMatrices(this.spriteCamera.projectionMatrix, this.spriteCamera.matrixWorldInverse), this.cameraPosition = this.spriteCamera.position, this.fov = this.spriteCamera.fov * Math.PI / 180, this.spriteAnchor = this.project(I());
			let r = new c.Matrix4().makeRotationY(s / 24 * Math.PI * 2).multiply(new c.Matrix4().makeRotationX(g)).multiply(new c.Matrix4().makeRotationZ(_)), i = e.crash ? {
				...e.crash,
				amount: x
			} : null, a = rt(Tt(d, f), i), o = {
				...e,
				position: I(),
				sunYaw: b,
				motion: {
					...e.motion,
					celebration: p,
					leftArm: m,
					rightArm: h
				},
				matrix: r,
				crash: i,
				upperLocal: a,
				upperMatrix: r.clone().multiply(a),
				sample: {
					...e.sample,
					cadence: 60,
					pedalAngle: l / 8 * Math.PI * 2,
					distance: u * Math.PI / 6 * .335
				},
				rider: {
					...e.rider,
					number: 0
				}
			};
			this.rider(o, l / 8), Object.assign(this, n), C = t, this.spriteCache.set(S, C);
		}
		let w = (t, n = !1) => {
			let r = I(...t);
			return n && r.applyMatrix4(e.upperLocal), this.project(r.applyMatrix4(e.matrix));
		}, T = [
			{
				a: w([
					0,
					.35,
					-.56
				]),
				b: w([
					0,
					.35,
					.56
				]),
				radius: i.scale * .335 + 2,
				depthRadius: .335
			},
			{
				a: w([
					0,
					1.01,
					-.14
				], !0),
				b: w([
					0,
					1.3,
					.21
				], !0),
				radius: i.scale * .15 + 2,
				depthRadius: .15
			},
			{
				a: w([
					0,
					1.51,
					.35
				], !0),
				b: w([
					0,
					1.51,
					.35
				], !0),
				radius: i.scale * .13 + 2,
				depthRadius: .13
			}
		].filter((e) => e.a && e.b), E = i.scale / this.spriteAnchor.scale, D = {
			x: i.x - this.spriteAnchor.x * E,
			y: i.y - this.spriteAnchor.y * E,
			width: 192 * E,
			height: 224 * E
		}, O = Jn(T, D, this.surfaceDepth);
		if (O && !O.length) return;
		if (this.riderHits.push({
			id: e.rider.id,
			parts: T,
			clip: O,
			alphaAt: (e, t) => {
				let n = Math.floor((e - D.x) / E), r = Math.floor((t - D.y) / E);
				return n < 0 || r < 0 || n >= 192 || r >= 224 ? !1 : C.getContext("2d").getImageData(n, r, 1, 1).data[3] > 16;
			}
		}), this.ctx.save(), O) {
			this.ctx.beginPath();
			for (let e of O) this.ctx.rect(e.x, e.y, e.width, e.height);
			this.ctx.clip();
		}
		this.ctx.drawImage(C, i.x - this.spriteAnchor.x * E, i.y - this.spriteAnchor.y * E, 192 * E, 224 * E);
		let k = I(...xt).applyMatrix4(e.upperMatrix || e.matrix), A = I(...St).transformDirection(e.upperMatrix || e.matrix), ee = this.cameraPosition.clone().sub(k).normalize();
		if (A.dot(ee) > 0) {
			let t = this.project(k);
			if (t) {
				let n = this.ctx, r = Math.max(.7, i.scale * .168);
				n.fillStyle = "#f0efde", n.fillRect(t.x - r / 2, t.y - r * .4, r, r * .8), i.scale > 15 && (n.fillStyle = "#263a32", n.font = `bold ${Math.max(3, i.scale * .11)}px sans-serif`, n.textAlign = "center", n.fillText(String(e.rider.number), t.x, t.y + r * .22));
			}
		}
		this.ctx.restore(), this.drawCount++;
	}
	rider(e, t) {
		let n = e.riderModel || B(), r = this.ctx, i = (t, n, r) => I(t, n, r).applyMatrix4(e.matrix), a = (t, n, r) => I(t, n, r).applyMatrix4(e.upperLocal || new c.Matrix4()).applyMatrix4(e.matrix), o = (e, t, n) => this.project(i(e, t, n)), s = [], l = (e, t) => {
			let n = e.map((e) => this.project(e));
			n.some((e) => !e) || s.push({
				depth: n.reduce((e, t) => e + t.w, 0) / n.length,
				draw: t
			});
		}, u = (e, t, n) => l(e, () => this.line(e, t, n)), d = (e, t) => l(e, () => this.polygon(e, t)), f = this.project(e.position);
		if (!f) return;
		let p = f.scale, m = e.team, h = "#273a3c", g = e.kit?.color || m.color;
		for (let t of [-.56, .56]) {
			u(Array.from({ length: 19 }, (e, n) => i(0, .35 + Math.cos(n / 18 * Math.PI * 2) * .335, t + Math.sin(n / 18 * Math.PI * 2) * .335)), h, Math.max(.65, p * U.tyreRadius * 2)), p > 4 && u(Array.from({ length: 19 }, (e, n) => i(0, .35 + Math.cos(n / 18 * Math.PI * 2) * .303, t + Math.sin(n / 18 * Math.PI * 2) * .303)), "#a7b5a7", Math.max(.3, p * .018));
			let n = o(0, .35, t);
			if (p > 4 && n) for (let n = 0; n < 3; n++) {
				let r = n * Math.PI / 3 + e.sample.distance / .335;
				u([i(0, .35 - Math.cos(r) * .3, t - Math.sin(r) * .3), i(0, .35 + Math.cos(r) * .3, t + Math.sin(r) * .3)], "#9ba99a", .35);
			}
		}
		let _ = [
			[
				0,
				.35,
				-.56
			],
			[
				0,
				q.bottomBracket,
				0
			],
			[
				0,
				.94,
				-.2
			],
			[
				0,
				.87,
				.38
			],
			[
				0,
				.35,
				.56
			]
		];
		for (let [e, t] of [
			[0, 1],
			[0, 2],
			[1, 2],
			[2, 3],
			[1, 3],
			[3, 4],
			[1, 4]
		]) u([i(..._[e]), i(..._[t])], m.color, Math.max(.6, p * .035));
		d([
			i(-.11, .99, -.355),
			i(.11, .99, -.355),
			i(.08, .99, -.105),
			i(-.08, .99, -.105)
		], h), u([i(0, .55, .13), i(0, .73, .23)], "#ecebdd", Math.max(.7, p * .084)), u([i(0, .73, .23), i(0, .76, .247)], h, Math.max(.4, p * .052)), u([i(.09, .4, -.56), i(.09, .39, 0)], h, Math.max(.35, p * .014)), u([i(.09, .3, -.56), i(.09, .19, 0)], h, Math.max(.35, p * .014)), u([i(.09, .35, -.56), i(.1, .22, -.62)], "#a7b5a7", Math.max(.35, p * .02)), u(Array.from({ length: 17 }, (e, t) => i(.09, q.bottomBracket + Math.cos(t / 16 * Math.PI * 2) * .1, Math.sin(t / 16 * Math.PI * 2) * .1)), "#b0bab3", Math.max(.35, p * .018));
		for (let e of $e) u([i(...e.a), i(...e.b)], e.color, Math.max(.35, p * e.radius * 1.6));
		for (let r of [-1, 1]) {
			let a = it(Ot(r, wt(e.sample, t, e.rider.number) + (r === 1 ? Math.PI : 0)), r, e.crash).toArray(), o = I(r * n.hipHalfWidth, 1.01, -.14).applyMatrix4(e.upperLocal || new c.Matrix4()), s = K(o, I(...a), q.upperLeg, q.lowerLeg, I(r * .08, 0, 1)).toArray();
			u([i(r * q.pedalHalfWidth, q.bottomBracket, 0), i(...a)], "#b0bab3", Math.max(.4, p * .024)), u([i(...o.toArray()), i(...s)], h, Math.max(1, p * .13 * n.legScale)), u([i(...s), i(...a)], "#c99f7b", Math.max(.8, p * .075 * n.legScale)), u([i(a[0], a[1], a[2] - .06), i(a[0], a[1], a[2] + .12)], "#e9e9d9", Math.max(.7, p * .075)), u([i(...bt(I(...a), I(...s)).toArray()), i(...a)], "#f0efe4", Math.max(.7, p * .078 * n.legScale));
		}
		let v = I(-55, this.lightPreset === "evening" ? 60 : 100, 35).normalize().applyAxisAngle(I(0, 1, 0), -(e.sunYaw || 0));
		for (let t of yt(n)) {
			let n = t.points.map((e) => a(...e.toArray())), r = n[1].clone().sub(n[0]).cross(n[2].clone().sub(n[0])).normalize();
			if (r.dot(this.cameraPosition.clone().sub(n[0])) <= 0) continue;
			let i = .68 + .32 * Math.max(0, r.dot(v));
			l(n, () => {
				e.jerseyImage?.width ? (this.texturedPolygon(n, e.jerseyImage, (n, r) => ({
					x: t.uv[r].x * e.jerseyImage.width,
					y: t.uv[r].y * e.jerseyImage.height
				}), !1, .15), this.ctx.save(), this.ctx.globalAlpha = 1 - i, this.polygon(n, "#10251b"), this.ctx.restore()) : this.polygon(n, "#" + new c.Color(g).multiplyScalar(i).getHexString());
			});
		}
		for (let t of [-1, 1]) {
			let r = I(t * n.shoulderHalfWidth, 1.3, .21).applyMatrix4(e.upperLocal || new c.Matrix4()), a = at(Dt(t, e.upperLocal || new c.Matrix4(), (t < 0 ? e.motion?.leftArm : e.motion?.rightArm) ?? e.motion?.celebration ?? 0, n), t, e.upperLocal, e.crash), o = K(r, a, .28, .29, I(t * .35, -.6, -.25));
			u([i(...r.toArray()), i(...o.toArray())], g, Math.max(1, p * .095 * n.armScale)), u([i(...o.toArray()), i(...a.toArray())], "#c99f7b", Math.max(.7, p * .06 * n.armScale)), u([i(...a.toArray()), i(...a.clone().lerp(o, .05).toArray())], "#283b3d", Math.max(.85, p * .084));
		}
		u([i(-.23, 1.05, .52), i(.23, 1.05, .52)], h, Math.max(.7, p * .03));
		for (let e of ct) u(e.map((e) => i(...e)), h, Math.max(.5, p * .03));
		u([a(0, 1.32, .25), a(0, 1.4, .34)], "#c99f7b", Math.max(.7, p * .12)), n.hairStyle !== "none" && u([a(-.055, 1.44, .245), a(.055, 1.44, .245)], n.hairColor, Math.max(.5, p * .08)), n.hairStyle === "tied" && u(V.map((e) => a(...e)), n.hairColor, Math.max(.6, p * .07)), l([a(0, 1.43, .37)], () => {
			let e = dt(ft.map((e) => this.project(a(e[0] * n.headScale, 1.43 + (e[1] - 1.43) * n.headScale, .37 + (e[2] - .37) * n.headScale))));
			if (e.length >= 3) {
				let t = r.createLinearGradient(0, Math.min(...e.map((e) => e.y)), 0, Math.max(...e.map((e) => e.y)));
				t.addColorStop(0, "#dfb894"), t.addColorStop(1, "#af7d5b"), r.fillStyle = t, r.beginPath(), e.forEach((e, t) => t ? r.lineTo(e.x, e.y) : r.moveTo(e.x, e.y)), r.closePath(), r.fill();
			}
		});
		for (let e of et) u([a(...e.a), a(...e.b)], "#344348", Math.max(.35, p * .008));
		I(0, 0, 1).transformDirection(e.upperMatrix || e.matrix).dot(this.cameraPosition.clone().sub(a(0, 1.43, .37))) > 0 && u([a(-.095, 1.445, .475), a(.095, 1.445, .475)], "#273f43", Math.max(.5, p * .034)), l([a(0, 1.54, .35)], () => {
			if (this.project(a(0, 1.51, .35))) {
				let t = dt(ut.map((e) => this.project(a(...e))));
				if (t.length >= 3) {
					let n = Math.min(...t.map((e) => e.y)), i = Math.max(...t.map((e) => e.y)), a = r.createLinearGradient(0, n, 0, i), o = new c.Color(e.helmetColor || g);
					a.addColorStop(0, "#" + o.clone().lerp(new c.Color("#ffffff"), .2).getHexString()), a.addColorStop(.45, "#" + o.getHexString()), a.addColorStop(1, "#" + o.clone().multiplyScalar(.65).getHexString()), r.fillStyle = a, r.beginPath(), t.forEach((e, t) => t ? r.lineTo(e.x, e.y) : r.moveTo(e.x, e.y)), r.closePath(), r.fill();
				}
				if (p > 6) for (let e of lt) this.line(e.map((e) => a(...e)), "#344347", Math.max(.45, p * .016));
			}
		}), s.sort((e, t) => t.depth - e.depth);
		for (let e of s) e.draw();
	}
	pick(e, t) {
		return Yn(this.riderHits, e, t, this.surfaceDepth);
	}
	dispose() {
		this.terrainCells.clear(), this.terrainImages.clear(), this.terrainDetail.clear(), this.spriteCache.clear(), this.spectatorSprites.clear(), this.roadMips.clear(), this.riderHits = [], this.jerseyImages = /* @__PURE__ */ new WeakMap(), this.pineSprites?.clear(), this.groundShadows.clear(), this.shadowMasks = null, this.foliage = null, this.domElement.remove();
	}
};
// src/viewer/rendererFactory.js
function ur(e = globalThis.devicePixelRatio) {
	return Number.isFinite(e) && e > 0 ? Math.min(e, 1.8) : 1;
}
function dr(e, { canvas: t = document.createElement("canvas"), webglFactory: n = (e) => new c.WebGLRenderer(e), fallbackFactory: r = (e) => new lr(e) } = {}) {
	let i, a, o;
	try {
		if (a = t.getContext("webgl2", {
			antialias: !0,
			alpha: !1
		}), a) return i = n({
			canvas: t,
			context: a,
			antialias: !0
		}), i.setPixelRatio(ur()), i.shadowMap.enabled = !0, i.shadowMap.type = c.PCFShadowMap, i.toneMapping = c.ACESFilmicToneMapping, i.toneMappingExposure = 1.18, i.outputColorSpace = c.SRGBColorSpace, i.mode = "WebGL", e.appendChild(t), {
			renderer: i,
			error: null
		};
	} catch (e) {
		o = e;
		try {
			i?.dispose();
		} catch {}
		t.remove?.();
	}
	return {
		renderer: r(e),
		error: o || null
	};
}
// src/viewer/ViewerController.js
var fr = class {
	constructor(e, t, { onStats: n = () => {}, onSelect: r = () => {}, onError: i = () => {} } = {}) {
		F(t), this.host = e, this.onStats = n, this.onSelect = r, this.onError = i, this.measurements = new Re(), this.assetRevision = 0, this.viewportRevision = 0, this.sceneRevision = 0, this.cameraSettled = !1, this.contextLost = !1, this.disposed = !1, this.target = null, this.targetChosen = !1, this.mode = "follow", this.zoom = 1, this.safeArea = Ne(), this.yaw = 0, this.light = "day", this.shared = null, this.local = {
			position: 110,
			epoch: performance.now(),
			rate: 1,
			paused: !1
		}, this.focus = I(), this.initial = !0, this.scene = new c.Scene(), this.scene.background = new c.Color("#d6e1d7"), this.scene.fog = new c.Fog("#d6e1d7", 200, 600), this.camera = new c.PerspectiveCamera(36, 1, .2, 1800);
		let a = dr(e);
		if (this.renderer = a.renderer, a.error && (this.measurements.error("webgl-initialization", a.error?.message || String(a.error)), this.notifyError(a.error)), this.renderer.mode === "WebGL") {
			let e = this.renderer.domElement;
			this.renderer.debug.onShaderError = (e, t, n, r) => {
				this.measurements.error("shader", [
					e.getProgramInfoLog(t),
					e.getShaderInfoLog(n),
					e.getShaderInfoLog(r)
				].filter(Boolean).join("\n")), this.notifyError(/* @__PURE__ */ Error("WebGL shader program failed; see viewer diagnostics"));
			}, this.onContextLost = () => {
				this.contextLost = !0, this.notifyError(/* @__PURE__ */ Error("WebGL context lost; broadcast time is retained"));
			}, this.onContextRestored = () => {
				this.contextLost = !1, this.assetRevision++, this.cameraSettled = !1, this.renderFault = !1;
			}, e.addEventListener("webglcontextlost", this.onContextLost), e.addEventListener("webglcontextrestored", this.onContextRestored);
		}
		this.ambient = new c.HemisphereLight("#fff4d9", "#63715c", 2.25), this.scene.add(this.ambient), this.sun = new c.DirectionalLight("#ffebcc", 3.1), this.sun.position.set(-55, 100, 30), this.sun.castShadow = !0, this.sun.shadow.mapSize.set(2048, 2048), Object.assign(this.sun.shadow.camera, {
			left: -100,
			right: 100,
			top: 110,
			bottom: -110,
			near: 1,
			far: 300
		}), this.sun.shadow.bias = -25e-5, this.sun.shadow.normalBias = .04, this.scene.add(this.sun, this.sun.target), this.selection = new c.Mesh(new c.RingGeometry(.8, .94, 48), new c.MeshBasicMaterial({
			color: "#f4d56d",
			side: c.DoubleSide,
			depthWrite: !1
		})), this.selection.rotation.x = -Math.PI / 2, this.selection.visible = !1, this.scene.add(this.selection), this.ray = new c.Raycaster(), this.pointer = new c.Vector2(), this.click = (e) => {
			let t = this.renderer.domElement.getBoundingClientRect(), n = e.clientX - t.left, r = e.clientY - t.top, i;
			this.renderer.mode === "Compatibility" ? i = this.renderer.pick(n, r, this.field) : (this.pointer.set(n / t.width * 2 - 1, 1 - r / t.height * 2), this.ray.setFromCamera(this.pointer, this.camera), i = this.field.pick(this.ray)), i && this.emitSelection({
				type: "rider",
				id: i
			});
		}, this.renderer.domElement.tabIndex = 0, this.renderer.domElement.setAttribute("aria-label", "Race camera: drag to orbit, scroll to zoom, Q and E to rotate, Home to reset"), this.renderer.domElement.setAttribute("aria-keyshortcuts", "Q E Home"), this.disposeCameraInput = We(this.renderer.domElement, this, this.click), this.onWindowResize = () => this.resize(), window.addEventListener("resize", this.onWindowResize), this.resizeObserver = new ResizeObserver(() => this.resize()), this.resizeObserver.observe(e), this.setFeed(t), this.resize(), this.last = performance.now(), this.statEpoch = this.last, this.frames = 0, this.frame = (e) => {
			if (!this.disposed && (this.raf = requestAnimationFrame(this.frame), !(this.contextLost || this.renderFault))) try {
				this.render(e);
			} catch (e) {
				this.renderFault = !0, this.measurements.error("render", e.message), this.notifyError(e);
			}
		}, this.raf = requestAnimationFrame(this.frame);
	}
	setFeed(e) {
		F(e), this.sceneRevision++, this.cameraSettled = !1, this.renderFault = !1, this.routeCoverage = null, this.lastFitScale = .88, this.cancelAssets?.(), this.assetCancelled = new Promise((e) => {
			this.cancelAssets = e;
		}), this.feed = e, this.weatherState = null, this.sample = we(e), this.route = ke(e.route.points, {
			interpolation: e.route.interpolation,
			distanceStations: e.route.distanceStations
		}), this.sun.castShadow = !((e.synthetic === !0 || e.route.label?.startsWith("Schematic distance axis")) && e.route.points?.length === 2), this.weatherEffects?.dispose(), this.roadFlags?.dispose(), this.environment?.dispose(), this.field?.dispose(), this.environment = zn(this.scene, e, this.route), this.field = new Kt(this.scene, e), this.weatherEffects = new je(this.scene), this.roadFlags = new Ae(this.scene, e, this.route), this.local.position = e.synthetic ? Math.min(110, e.duration) : 0, this.local.paused = !1, this.local.rate = 1, this.local.epoch = performance.now(), this.shared = null, this.initial = !0, this.targetChosen = !1, this.target = Ze(this.sample(this.local.position).positions.filter((e) => Fe(e, this.route.length)), e.riders[0].id);
		let t = this.sceneRevision;
		this.whenAssetsReady().then((e) => {
			!this.disposed && !e.superseded && t === this.sceneRevision && this.assetRevision++;
		});
	}
	appendRecordedFrames(e) {
		if (this.disposed || !this.feed?.streaming || !Array.isArray(e)) throw Error("Incremental frames require a live recorded feed");
		let t = this.feed.frames, n = t.at(-1), r = n.time === this.feed.duration && n.positions.length === 0, i = r ? t.slice(0, -1) : t, a = i.at(-1).time;
		if (e.some((t, n) => !t || t.time <= (n ? e[n - 1].time : a) || t.time > this.feed.duration)) throw Error("Recorded frames must advance in source order");
		if (!e.length) return a;
		if (!r) throw Error("Recorded race already has its final frame");
		let o = [...i, ...e];
		o.at(-1).time < this.feed.duration && o.push({
			time: this.feed.duration,
			positions: []
		});
		let s = {
			...this.feed,
			frames: o
		};
		return F(s), this.feed = s, this.sample = we(s), this.sceneRevision++, this.cameraSettled = !1, e.at(-1).time;
	}
	time(e = performance.now()) {
		return this.shared ? Ee(this.shared.clock, Date.now() + this.shared.offsetMs) : Math.min(this.feed.duration, Math.max(0, this.local.position + (this.local.paused ? 0 : (e - this.local.epoch) / 1e3 * this.local.rate)));
	}
	pause(e) {
		if (this.shared) return !1;
		if (typeof e != "boolean") throw Error("Invalid pause state");
		return this.local.position = this.time(), this.local.epoch = performance.now(), this.local.paused = e, !0;
	}
	seek(e) {
		if (this.shared) return !1;
		if (!Number.isFinite(e)) throw Error("Invalid seek position");
		return this.local.position = c.MathUtils.clamp(e, 0, this.feed.duration), this.local.epoch = performance.now(), !0;
	}
	speed(e) {
		if (this.shared) return !1;
		if (!Number.isFinite(e) || e < 0) throw Error("Invalid playback rate");
		return this.local.position = this.time(), this.local.epoch = performance.now(), this.local.rate = e, !0;
	}
	setBroadcastClock(e, t = 0) {
		if (Te(e), !Number.isFinite(t)) throw Error("Invalid server clock offset");
		if (e.duration !== this.feed.duration) throw Error("Clock duration does not match feed");
		let n = !this.shared;
		this.shared = {
			clock: { ...e },
			offsetMs: t
		}, n && !this.targetChosen && (this.target = Ze(this.sample(this.time()).positions.filter((e) => Fe(e, this.route.length)), this.feed.riders[0].id));
	}
	leaveBroadcast() {
		let e = this.time();
		this.shared = null, this.local = {
			position: e,
			epoch: performance.now(),
			paused: !0,
			rate: 1
		};
	}
	isTargetAvailable() {
		return this.sample(this.time()).positions.filter((e) => Fe(e, this.route.length)).some((e) => this.target.type === "rider" ? e.riderId === this.target.id : e.groupId === this.target.id);
	}
	getRiderState(e) {
		return this.sample(this.time()).positions.find((t) => t.riderId === e) || null;
	}
	getCameraState() {
		return {
			yaw: this.yaw,
			zoom: this.zoom,
			mode: this.mode,
			elevationDegrees: this.orbitState && this.camera ? Math.atan2(this.camera.position.y - this.focus.y, Math.hypot(this.camera.position.x - this.focus.x, this.camera.position.z - this.focus.z)) * 180 / Math.PI : Ge * 180 / Math.PI,
			renderedYaw: this.orbitState?.yaw ?? this.yaw,
			renderedScale: this.orbitState?.scale ?? this.zoom,
			safeArea: Ne(this.safeArea),
			...this.camera && this.focus ? {
				position: this.camera.position.toArray(),
				focus: this.focus.toArray(),
				aspect: this.camera.aspect,
				verticalFovDegrees: this.camera.fov,
				fittedScale: this.lastFitScale ?? .88
			} : {}
		};
	}
	setCamera({ yaw: e = this.yaw, zoom: t = this.zoom, mode: n = this.mode, safeArea: r = this.safeArea } = {}) {
		if (!Number.isFinite(e) || !Number.isFinite(t) || ![
			"follow",
			"overview",
			"finish"
		].includes(n) || n === "finish" && !this.feed?.finish) throw Error("Invalid camera settings");
		let i = Ne(r);
		return this.safeArea = i, this.yaw = Ke(e), this.zoom = c.MathUtils.clamp(t, .35, 2.5), this.mode = n, this.getCameraState();
	}
	orbit(e) {
		if (!Number.isFinite(e)) throw Error("Invalid orbit angle");
		return this.setCamera({ yaw: this.yaw + e });
	}
	setZoom(e) {
		return this.setCamera({ zoom: e });
	}
	focusFinish() {
		let e = Qe(this.route, this.feed.finish);
		return e ? (this.setCamera({
			mode: "finish",
			yaw: e.yaw,
			zoom: .45
		}), !0) : !1;
	}
	resetCamera() {
		return this.setCamera({
			yaw: 0,
			zoom: 1,
			mode: "follow"
		});
	}
	follow(e) {
		if (!e || !["rider", "group"].includes(e.type) || typeof e.id != "string" || !e.id) throw Error("Invalid camera target");
		this.targetChosen = !0, this.target = { ...e }, this.mode = "follow";
	}
	resize() {
		if (this.disposed) return;
		let e = this.host.clientWidth, t = this.host.clientHeight;
		if (e && t) {
			if (this.viewportRevision++, this.renderer.mode === "WebGL") {
				let n = ur();
				this.renderer.getPixelRatio() !== n && this.renderer.setPixelRatio(n), this.renderer.setSize(e, t);
			} else this.renderer.resize(e, t);
			this.camera.aspect = e / t, Pe(this.camera, this.safeArea || Ne()), this.camera.updateProjectionMatrix();
		}
	}
	setLight(e) {
		this.light = e;
		let t = Oe(e, this.weatherState);
		this.sun.color.set(t.sunColor), this.sun.intensity = t.sunIntensity, this.ambient.intensity = t.ambientIntensity, this.scene.background.set(t.fog), this.scene.fog.color.copy(this.scene.background);
	}
	render(e) {
		let t = Math.min((e - this.last) / 1e3, .5);
		this.last = e;
		let n = this.time(e), r = ze(this, n);
		if (!this.initial && this.cameraSettled && r === this.lastRenderKey) {
			this.measurements.skip(), this.wasIdle = !0;
			return;
		}
		this.wasIdle &&= (this.frames = 0, this.statEpoch = e, !1);
		let i = performance.now();
		n >= this.feed.duration && !this.shared && !this.local.paused && (this.local.paused = !0, this.local.position = this.feed.duration, this.local.epoch = e);
		let a = this.sample(n), o = Ie(a.positions, this.route.length, n), s = performance.now();
		this.field.update(a, this.route, n, this.target?.type === "rider" ? this.target.id : null);
		let c = performance.now(), l = [...this.field.riderTransforms.values()], u = Xe(l, this.target);
		this.targetAvailable = u.length > 0;
		let d = this.mode === "finish" ? Qe(this.route, this.feed.finish) : null, f = d ? [] : u.length ? u : this.initial ? l : [], p = this.focus.clone();
		if (f.length) {
			p.set(0, 0, 0);
			for (let e of f) p.add(e.position);
			p.divideScalar(f.length);
		}
		d && p.copy(d.position);
		let m = d ? 0 : this.lastRadius || 0;
		if (f.length) {
			m = 0;
			for (let e of f) m = Math.max(m, e.position.distanceTo(p));
			this.lastRadius = m;
		}
		f.length && (this.lastFitScale = Math.max(Ye(f, p, this.yaw, this.camera.fov, this.camera.aspect, .12, this.safeArea), Ye(f, p, this.orbitState?.yaw ?? this.yaw, this.camera.fov, this.camera.aspect, .12, this.safeArea)));
		let h = this.zoom * (d ? .77 : this.mode === "overview" ? Math.max(2.8, this.lastFitScale || .88) : this.lastFitScale || .88), g = this.shared ? 1 : 1 - Math.exp(-t * 3.8);
		this.initial ? (this.focus.copy(p), this.orbitState = {
			yaw: this.yaw,
			scale: h
		}, this.initial = !1) : (this.focus.lerp(p, g), this.orbitState = Je(this.orbitState, {
			yaw: this.yaw,
			scale: h
		}, t));
		let _ = qe(this.orbitState.yaw, this.orbitState.scale);
		this.camera.position.copy(this.focus).add(I(_.x, _.y, _.z));
		let v = this.camera.position.distanceTo(this.focus), y = Math.max(1800, v + m + 500);
		this.camera.far !== y && (this.camera.far = y, this.camera.updateProjectionMatrix()), this.scene.fog.near = Math.max(200, v + m + 50), this.scene.fog.far = Math.max(600, this.scene.fog.near + v * 2), Pe(this.camera, this.safeArea || Ne()), this.camera.lookAt(this.focus), this.camera.updateMatrixWorld(), this.cameraSettled = this.focus.distanceToSquared(p) < 4e-6 && Math.abs(Ke(this.orbitState.yaw - this.yaw)) < 1e-4 && Math.abs(this.orbitState.scale - h) < 1e-4, this.environment.foliage.update(this.camera, n, A(this.feed, n)), this.environment.water.update(n), this.sun.position.copy(this.focus).add(I(-55, this.light === "evening" ? 60 : 100, 35)), this.sun.target.position.copy(this.focus);
		let b = this.target.type === "rider" ? u[0] : null;
		this.selection.visible = !!b, b && this.selection.position.copy(b.position).add(I(0, .12, 0));
		let x = A(this.feed, n);
		if (this.weatherState = x, this.environment.weather = x, this.environment.roadSurfaces?.update(x), this.environment.roadWeather?.update(a.positions, n, x), this.environment.crowd?.update(d ? this.route.length * this.feed.finish.routeFraction : u.length ? u.reduce((e, t) => e + t.sample.distance, 0) / u.length : 0), this.weatherEffects?.update(x, n, this.focus), this.roadFlags?.update(d ? this.route.length * this.feed.finish.routeFraction : u[0]?.sample.distance || 0, x, n), this.setLight(this.light), this.renderer.mode === "WebGL") this.renderer.render(this.scene, this.camera);
		else if (this.renderer.render(this.camera, this.environment, this.field, this.route, this.focus, n, this.light), this.roadFlags?.drawCPU(this.renderer), this.weatherEffects?.drawCPU(this.renderer), b) {
			let e = this.renderer.project(b.position.clone().add(I(0, 1.9, 0)));
			if (e) {
				let t = this.renderer.ctx;
				t.fillStyle = "#f1cd58", t.beginPath(), t.moveTo(e.x, e.y + 4), t.lineTo(e.x - 4, e.y - 3), t.lineTo(e.x + 4, e.y - 3), t.fill();
			}
		}
		this.lastRenderKey = r, this.routeCoverage = o, this.measurements.record({
			frameMs: performance.now() - i,
			samplingMs: s - i,
			rigMs: c - s,
			drawMs: performance.now() - c
		}), this.frames++;
		let S = this.shared ? this.shared.clock.paused || this.shared.clock.rate === 0 : this.local.paused || this.local.rate === 0;
		if (e - this.statEpoch > 350 || S && this.cameraSettled) {
			let t = e - this.statEpoch >= 350 ? Math.round(this.frames * 1e3 / (e - this.statEpoch)) : 0;
			this.emitStats({
				time: n,
				targetAvailable: this.targetAvailable,
				camera: this.getCameraState(),
				fps: t,
				renderer: this.renderer.mode,
				drawCalls: this.renderer.mode === "WebGL" ? this.renderer.info.render.calls : null,
				cpuMs: this.renderer.lastMs || null,
				visible: l.length,
				playing: this.shared ? !this.shared.clock.paused : !this.local.paused,
				shared: !!this.shared,
				gaps: a.gaps,
				events: a.events,
				results: a.results,
				distance: u.length ? u.reduce((e, t) => e + t.sample.distance, 0) / u.length : 0,
				routeLength: this.route.length,
				routeCoverage: Le(this.routeCoverage),
				finishRemaining: Ve(a.positions, this.route.length, this.feed.finish),
				weather: {
					...x,
					wind: [...x.wind]
				},
				incidentCount: a.positions.filter((e) => e.crash).length,
				crowdCount: this.environment.crowd?.count || 0,
				surface: u.length && this.environment.roadSurfaces?.at(u[0].sample.distance).type || "asphalt",
				assetStatus: this.assetStatus(),
				position: b?.sample.distance ?? null
			}), this.frames = 0, this.statEpoch = e;
		}
	}
	getSnapshot() {
		let e = this.time(), t = this.sample(e);
		return {
			raceId: this.feed.raceId,
			time: e,
			target: { ...this.target },
			routeCoverage: Ie(t.positions, this.route.length, e),
			targetAvailable: t.positions.filter((e) => Fe(e, this.route.length)).some((e) => this.target.type === "rider" ? e.riderId === this.target.id : e.groupId === this.target.id),
			results: t.results,
			camera: this.getCameraState()
		};
	}
	getResults() {
		return j(this.feed, this.time());
	}
	notifyError(e) {
		try {
			this.onError(e);
		} catch (e) {
			this.measurements.error("error-subscriber", String(e?.message ?? e));
		}
	}
	emitSelection(e) {
		if (!this.disposed) try {
			this.onSelect(e);
		} catch (e) {
			this.measurements.error("selection-subscriber", String(e?.message ?? e)), this.notifyError(e);
		}
	}
	emitStats(e) {
		if (!this.disposed) try {
			this.onStats(e);
		} catch (e) {
			this.measurements.error("stats-subscriber", String(e?.message ?? e)), this.notifyError(e);
		}
	}
	assetContentRevision() {
		return (this.field?.textures?.revision || 0) + (this.environment?.textures?.revision || 0) + (this.environment?.models?.revision || 0) + (this.environment?.foliage?.revision || 0) + (this.environment?.finish?.models?.revision || 0);
	}
	getDiagnostics() {
		let e = this.renderer.info;
		return {
			weather: this.weatherState ? {
				...this.weatherState,
				wind: [...this.weatherState.wind]
			} : A(this.feed, this.time()),
			crashedRiders: this.sample(this.time()).positions.filter((e) => e.crash).map((e) => e.riderId),
			crowdCount: this.environment?.crowd?.count || 0,
			riderCategory: this.feed.riderCategory ?? "men",
			viewerVersion: Me,
			assetContentRevision: this.assetContentRevision(),
			routeCoverage: Le(this.routeCoverage),
			renderer: this.renderer.mode,
			contextLost: this.contextLost,
			renderFault: !!this.renderFault,
			cameraSettled: this.cameraSettled,
			...this.measurements.snapshot(),
			resources: e ? {
				geometries: e.memory.geometries,
				textures: e.memory.textures,
				programs: e.programs?.length || 0,
				drawCalls: e.render.calls,
				triangles: e.render.triangles
			} : null,
			caches: this.renderer.mode === "Compatibility" ? {
				riderBytes: this.renderer.spriteCache.bytes,
				staticSpriteBytes: this.renderer.spectatorSprites.bytes,
				terrainDetailBytes: this.renderer.terrainDetail.tiles.bytes,
				terrainCellCount: this.renderer.terrainCells.cells.size,
				terrainCenterCount: this.renderer.terrainCells.centers.size
			} : null
		};
	}
	assetStatus() {
		return [
			this.environment.models.status(),
			...this.environment.finish ? [this.environment.finish.status()] : [],
			this.environment.foliage.status(),
			this.environment.textures.status(),
			this.field.textures.status()
		].reduce((e, t) => ({
			pending: e.pending + t.pending,
			loaded: e.loaded + t.loaded,
			errors: [...e.errors, ...t.errors]
		}), {
			pending: 0,
			loaded: 0,
			errors: []
		});
	}
	async whenAssetsReady() {
		let e = this.environment, t = this.field;
		return await Promise.race([Promise.all([
			e.models.ready,
			e.finish?.ready,
			e.foliage.ready,
			e.textures.ready,
			t.textures.ready
		]), this.assetCancelled]), this.disposed || e !== this.environment || t !== this.field ? { superseded: !0 } : this.assetStatus();
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.cancelAssets?.(), cancelAnimationFrame(this.raf), this.resizeObserver.disconnect(), window.removeEventListener("resize", this.onWindowResize), this.disposeCameraInput?.(), this.weatherEffects?.dispose(), this.roadFlags?.dispose(), this.environment.dispose(), this.field.dispose(), this.selection.geometry.dispose(), this.selection.material.dispose(), this.sun.shadow.dispose(), this.renderer.domElement.removeEventListener("webglcontextlost", this.onContextLost), this.renderer.domElement.removeEventListener("webglcontextrestored", this.onContextRestored), this.renderer.dispose(), this.renderer.domElement.parentNode && this.renderer.domElement.remove());
	}
}, pr = t(function({ feed: e, target: t, clock: r = null, serverOffsetMs: a = 0, cameraSafeArea: c, onSelect: l = () => {}, onStats: u = () => {}, onError: d = () => {}, className: f, style: p }, m) {
	let h = o(), g = o(), _ = o({
		onSelect: l,
		onStats: u,
		onError: d
	}), v = o(!1);
	v.current = t != null, _.current = {
		onSelect: l,
		onStats: u,
		onError: d
	};
	let y = (e) => {
		if (g.current) g.current.notifyError(e);
		else try {
			_.current.onError(e);
		} catch {}
	}, [b, x] = s(0);
	return n(() => () => {
		g.current?.dispose(), g.current = null;
	}, []), n(() => {
		try {
			F(e);
		} catch (e) {
			y(e);
			return;
		}
		g.current?.dispose(), g.current = null;
		let t = new fr(h.current, e, {
			onSelect: (e) => T(g.current, v.current, e, _.current.onSelect),
			onStats: (e) => _.current.onStats(e),
			onError: (e) => _.current.onError(e)
		});
		g.current = t, x((e) => e + 1);
	}, [e]), n(() => {
		try {
			t && g.current?.follow(t);
		} catch (e) {
			y(e);
		}
	}, [
		t?.type,
		t?.id,
		typeof t,
		b
	]), n(() => {
		try {
			r ? g.current?.setBroadcastClock(r, a) : g.current?.shared && g.current.leaveBroadcast();
		} catch (e) {
			y(e);
		}
	}, [
		r,
		a,
		b
	]), n(() => {
		try {
			g.current?.setCamera({ safeArea: c === void 0 ? {} : c });
		} catch (e) {
			y(e);
		}
	}, [c, b]), i(m, () => ({
		pause: (e) => g.current?.pause(e),
		seek: (e) => g.current?.seek(e),
		speed: (e) => g.current?.speed(e),
		follow: (e) => g.current?.follow(e),
		getCameraState: () => g.current?.getCameraState(),
		setCamera: (e) => g.current?.setCamera(e),
		orbit: (e) => g.current?.orbit(e),
		setZoom: (e) => g.current?.setZoom(e),
		focusFinish: () => g.current?.focusFinish(),
		resetCamera: () => g.current?.resetCamera(),
		getResults: () => g.current?.getResults(),
		getRiderState: (e) => g.current?.getRiderState(e),
		getSnapshot: () => g.current?.getSnapshot() || {
			time: void 0,
			target: void 0,
			targetAvailable: void 0,
			results: null
		},
		whenAssetsReady: () => g.current?.whenAssetsReady(),
		getAssetStatus: () => g.current?.assetStatus(),
		getDiagnostics: () => g.current?.getDiagnostics(),
		appendRecordedFrames: (e) => g.current?.appendRecordedFrames(e),
		setLight: (e) => g.current?.setLight(e)
	}), []), /* @__PURE__ */ C("div", {
		ref: h,
		className: f,
		style: {
			position: "relative",
			width: "100%",
			height: "100%",
			minHeight: 300,
			...p
		},
		"aria-label": "Interactive Pelotonia race viewer"
	});
});
// src/pelotoniaAdapter.js
function mr(e, t, n) {
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
function hr({ raceId: e, riderCategory: t, replay: n, scene: r, teams: i, riders: a, distanceOriginM: o, lateralByRider: s = {}, orders: c = [], actions: l = [], events: u = [] }) {
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
	return F({
		...r,
		schemaVersion: xe,
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
function gr(e, { originKm: t, elevationsM: n, width: r, chainagesM: i }) {
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
function _r(e) {
	if (e?.schemaVersion === "pelotonia.viewer.v1") return F(e);
	if (e?.exportVersion === "pelotonia.physical-export.v1") {
		if (!e.payload || typeof e.payload != "object") throw Error("Physical export payload missing");
		return hr(e.payload);
	}
	throw Error("Unsupported import. Expected pelotonia.viewer.v1 or pelotonia.physical-export.v1");
}
// src/raceSession.js
function vr({ load: e, onListenerError: t = () => {} }) {
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
		if (n && F(r), Te(i), r.raceId !== e || i.duration !== r.duration || !Number.isSafeInteger(a) || a < 0 || !Number.isFinite(o)) throw Error("Race session identity, duration or revision mismatch");
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
function yr(e) {
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
function br(e) {
	return F(e), yr(e).map(({ owner: e, url: t }) => ({
		owner: e,
		url: t
	}));
}
function xr(e, t) {
	F(e);
	let n = new URL(t);
	if (!["https:", "http:"].includes(n.protocol)) throw Error("Asset base must be HTTP(S)");
	let r = structuredClone(e);
	for (let { object: e, key: t, url: i } of yr(r)) e[t] = new URL(i, n).href;
	return F(r);
}
// src/raceLoader.js
var Z = class extends Error {
	constructor(e, t) {
		super(t), this.name = "RaceLoadError", this.code = e;
	}
};
function Sr(e) {
	try {
		Promise.resolve(e?.cancel?.()).catch(() => {});
	} catch {}
}
async function Cr(e, t, n) {
	if (Number(e.headers?.get("content-length")) > t) throw Sr(e.body), new Z("SIZE", "Race export exceeds the configured size limit");
	let r = "";
	if (e.body?.getReader) {
		let i = e.body.getReader(), a = new TextDecoder(), o = 0, s, c = new Promise((e, t) => {
			s = t;
		}), l = () => {
			Sr(i), s(new Z("ABORTED", "Race export request was cancelled"));
		};
		n?.addEventListener("abort", l, { once: !0 });
		try {
			if (n?.aborted) throw new Z("ABORTED", "Race export request was cancelled");
			for (;;) {
				let e = await Promise.race([i.read(), c]);
				if (e.done) break;
				if (o += e.value.byteLength, o > t) throw new Z("SIZE", "Race export exceeds the configured size limit");
				r += a.decode(e.value, { stream: !0 });
			}
			r += a.decode();
		} catch (e) {
			throw Sr(i), e;
		} finally {
			n?.removeEventListener("abort", l);
			try {
				i.releaseLock();
			} catch {}
		}
	} else if (r = await e.text(), new TextEncoder().encode(r).byteLength > t) throw new Z("SIZE", "Race export exceeds the configured size limit");
	try {
		return JSON.parse(r);
	} catch {
		throw new Z("PARSE", "Race export is not valid JSON");
	}
}
function wr({ urlForRace: e, fetchImpl: t = globalThis.fetch, requestInit: n = {}, resolveAssets: r = !0, maxBytes: i = 67108864, timeoutMs: a = 15e3 }) {
	if (!Number.isFinite(a) || a < 0) throw Error("Invalid loader timeout");
	if (typeof e != "function" || typeof t != "function" || !Number.isSafeInteger(i) || i <= 0) throw Error("Invalid race loader configuration");
	let o = async (a, { signal: o } = {}) => {
		let s = new URL(e(a));
		if (!["http:", "https:"].includes(s.protocol)) throw new Z("URL", "Race export endpoint must use HTTP(S)");
		let c = await t(s.href, {
			...n,
			method: "GET",
			signal: o
		});
		if (!c.ok) throw new Z("HTTP", `Race export request failed (${c.status})`);
		let l = await Cr(c, i, o), u;
		try {
			if (u = _r(l.feed), Te(l.clock), u.raceId !== a || l.clock.duration !== u.duration || !Number.isSafeInteger(l.revision) || l.revision < 0 || !Number.isFinite(l.serverOffsetMs ?? 0)) throw Error("Mismatch");
		} catch {
			throw new Z("PAYLOAD", "Race export identity, data, clock or revision is invalid");
		}
		return r && (u = xr(u, c.url || s.href)), {
			feed: u,
			clock: { ...l.clock },
			revision: l.revision,
			serverOffsetMs: l.serverOffsetMs ?? 0
		};
	};
	return async (e, { signal: t } = {}) => {
		if (t?.aborted) throw new Z("ABORTED", "Race export request was cancelled");
		let n = new AbortController(), r, i = new Promise((e, t) => {
			r = t;
		}), s = () => {
			n.abort(), r(new Z("ABORTED", "Race export request was cancelled"));
		};
		t?.addEventListener("abort", s, { once: !0 });
		let c = a ? setTimeout(() => {
			n.abort(), r(new Z("TIMEOUT", "Race export request timed out"));
		}, a) : null;
		try {
			return await Promise.race([o(e, { signal: n.signal }), i]);
		} finally {
			c !== null && clearTimeout(c), t?.removeEventListener("abort", s), n.abort();
		}
	};
}
// src/preflight.js
function Tr(e) {
	try {
		F(e);
	} catch (e) {
		return {
			valid: !1,
			errors: [e.message],
			summary: null,
			assets: []
		};
	}
	let t = br(e), n = e.frames.reduce((e, t) => e + t.positions.length, 0);
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
// src/viewer/FeedPreflight.jsx
function Er({ feed: t }) {
	let n = a(() => Tr(t), [t]), r = n.summary;
	return /* @__PURE__ */ w("details", {
		style: {
			padding: 12,
			border: "1px solid #d1d7c4",
			borderRadius: 6,
			marginBlock: 12
		},
		children: [/* @__PURE__ */ w("summary", { children: ["Game export preflight · ", n.valid ? "valid" : "invalid"] }), r ? /* @__PURE__ */ w(S, { children: [
			/* @__PURE__ */ C("dl", {
				style: {
					display: "grid",
					gridTemplateColumns: "1fr auto",
					gap: 6,
					fontSize: 12
				},
				children: Object.entries({
					"Race field": r.riderCategory === "women" ? "Women" : "Men",
					Riders: r.riderCount,
					Teams: r.teamCount,
					"Recorded frames": r.frameCount,
					"Route points": r.routePointCount,
					"Asset files": r.uniqueAssetCount,
					"Relative asset references": r.relativeAssetCount,
					"Absent rider/frame samples": r.missingRiderSamples
				}).map(([t, n]) => /* @__PURE__ */ w(e.Fragment, { children: [/* @__PURE__ */ C("dt", { children: t }), /* @__PURE__ */ C("dd", {
					style: {
						margin: 0,
						fontVariantNumeric: "tabular-nums"
					},
					children: n
				})] }, t))
			}),
			/* @__PURE__ */ w("p", {
				style: { fontSize: 12 },
				children: [
					"Terrain: ",
					r.hasTerrain ? "supplied" : "not supplied",
					" · Finish: ",
					r.hasFinish ? "supplied" : "not supplied",
					" · Results: ",
					r.hasOfficialResults ? "supplied" : "not supplied"
				]
			}),
			/* @__PURE__ */ C("p", {
				style: { fontSize: 12 },
				children: "Valid data does not confirm that remote assets are reachable. Sparse rider samples are held by the viewer; no new race movement is calculated."
			})
		] }) : /* @__PURE__ */ C("ul", {
			role: "alert",
			children: n.errors.map((e, t) => /* @__PURE__ */ C("li", { children: e }, t))
		})]
	});
}
// src/viewer/routeProfileData.js
function Dr(e) {
	if (e.route.profile) return ae(e.route.profile);
	let t = ke(e.route.points, {
		interpolation: e.route.interpolation,
		distanceStations: e.route.distanceStations
	}), n = t.length * (e.finish?.routeFraction ?? 1), r = e.route.distanceStations ? null : t.curve.getLengths(), i = e.route.distanceStations || e.route.points.map((t, n) => {
		let i = n / (e.route.points.length - 1) * (r.length - 1), a = Math.floor(i), o = Math.min(r.length - 1, a + 1);
		return r[a] + (r[o] - r[a]) * (i - a);
	}), a = /* @__PURE__ */ new Set([
		0,
		n,
		...i.filter((e) => e <= n)
	]), o = Math.min(512, Math.max(0, 2e4 - a.size));
	for (let e = 1; e < o; e++) a.add(n * e / o);
	return ae({
		schemaVersion: ne,
		samples: [...a].sort((e, t) => e - t).map((e) => [e, t.at(e).position.y])
	});
}
// src/viewer/RouteProfile.jsx
var Q = "#315845", Or = "#c8ab62", kr = "#f4f3e8", Ar = "#7a886f", $ = (e) => (e / 1e3).toLocaleString("en-GB", { maximumFractionDigits: 1 });
function jr(e, t = 16) {
	let n = e.split(/\s+/).flatMap((e) => e.length <= t ? [e] : Array.from({ length: Math.ceil(e.length / t) }, (n, r) => e.slice(r * t, (r + 1) * t))), r = [], i = "";
	for (let e of n) i && i.length + e.length + 1 > t ? (r.push(i), i = e) : i += (i ? " " : "") + e;
	return i && r.push(i), r.length > 3 ? [...r.slice(0, 2), r[2].slice(0, t - 1) + "…"] : r;
}
function Mr({ marker: e, x: t, y: n, selected: r = !1, small: i = !1 }) {
	let a = i ? 8 : 13, o = e.type === "climb" ? Q : e.type === "sprint" ? "#91a45f" : Or;
	return /* @__PURE__ */ w("g", {
		transform: `translate(${t} ${n})`,
		children: [
			/* @__PURE__ */ C("circle", {
				r: a + 2,
				fill: r ? Or : kr
			}),
			/* @__PURE__ */ C("circle", {
				r: a,
				fill: o
			}),
			/* @__PURE__ */ C("text", {
				textAnchor: "middle",
				dy: ".35em",
				fill: e.type === "place" ? Q : kr,
				fontSize: i ? 7 : 11,
				fontWeight: "700",
				children: e.type === "sprint" ? "S" : e.type === "climb" ? e.category || "▲" : "•"
			})
		]
	});
}
function Nr({ model: e, progress: t, selected: n, full: i = !1 }) {
	let o = r().replace(/:/g, ""), s = i ? 960 : 320, c = i ? 58 : 36, l = i ? 24 : 12, u = s - c - l, d = i && e.markers.length ? Math.ceil(e.markers.length / 8) : 0, f = i ? d * 92 + 28 : 35, p = f + (i ? 205 : 116), m = p + (i ? 62 : 38), h = a(() => se(e), [e]), g = (t) => c + (e.length ? (t - e.start) / e.length : 0) * u, _ = (e) => p - (e - h.min) / (h.max - h.min) * (p - f), { line: v, area: y } = a(() => {
		let t = e.samples.map((t, n) => `${n ? "L" : "M"}${(c + (e.length ? (t[0] - e.start) / e.length : 0) * u).toFixed(2)},${(p - (t[1] - h.min) / (h.max - h.min) * (p - f)).toFixed(2)}`).join("");
		return {
			line: t,
			area: `${t}L${e.length ? c + u : c},${p}L${c},${p}Z`
		};
	}, [
		e,
		c,
		u,
		p,
		h,
		f
	]), b = e.length ? Array.from({ length: 5 }, (t, n) => e.start + n * e.length / 4) : [e.start], x = e.markers.find((e) => e.id === n);
	return /* @__PURE__ */ w("svg", {
		className: "route-profile-graphic",
		viewBox: `0 0 ${s} ${m}`,
		role: "img",
		"aria-label": `Elevation profile: ${e.startName} to ${e.finishName}, ${$(e.length)} kilometres, maximum ${Math.round(e.maxElevation)} metres${t ? `, race at ${$(t.distance)} kilometres` : ""}`,
		style: {
			display: "block",
			width: "100%",
			height: "auto"
		},
		children: [
			/* @__PURE__ */ w("defs", { children: [
				/* @__PURE__ */ w("linearGradient", {
					id: `${o}-land`,
					x1: "0",
					y1: "0",
					x2: "0",
					y2: "1",
					children: [/* @__PURE__ */ C("stop", { stopColor: "#dac57e" }), /* @__PURE__ */ C("stop", {
						offset: "1",
						stopColor: "#98a765"
					})]
				}),
				/* @__PURE__ */ C("pattern", {
					id: `${o}-grain`,
					width: "24",
					height: "18",
					patternUnits: "userSpaceOnUse",
					children: /* @__PURE__ */ C("path", {
						d: "M-4 9Q3 1 10 9T24 9T38 9M-4 18Q3 10 10 18T24 18",
						fill: "none",
						stroke: "#edf0ca",
						strokeWidth: ".7",
						opacity: ".35"
					})
				}),
				/* @__PURE__ */ C("clipPath", {
					id: `${o}-clip`,
					children: /* @__PURE__ */ C("path", { d: y })
				})
			] }),
			h.ticks.map((e) => /* @__PURE__ */ w("g", { children: [/* @__PURE__ */ C("path", {
				d: `M${c} ${_(e)}H${s - l}`,
				stroke: "#d9decf",
				strokeWidth: ".7",
				strokeDasharray: "3 5"
			}), /* @__PURE__ */ C("text", {
				x: c - 7,
				y: _(e) + 3,
				textAnchor: "end",
				fill: Ar,
				fontSize: i ? 11 : 8,
				children: Math.round(e)
			})] }, e)),
			/* @__PURE__ */ C("text", {
				x: c - 7,
				y: f - 9,
				textAnchor: "end",
				fill: Ar,
				fontSize: i ? 10 : 8,
				children: "m"
			}),
			/* @__PURE__ */ C("path", {
				d: y,
				fill: `url(#${o}-land)`
			}),
			/* @__PURE__ */ C("path", {
				d: y,
				fill: `url(#${o}-grain)`
			}),
			t && /* @__PURE__ */ C("rect", {
				x: c,
				y: f,
				width: Math.max(0, g(t.distance) - c),
				height: p - f,
				fill: Q,
				opacity: ".13",
				clipPath: `url(#${o}-clip)`
			}),
			/* @__PURE__ */ C("path", {
				d: v,
				fill: "none",
				stroke: Q,
				strokeWidth: i ? 2 : 1.4,
				strokeLinejoin: "round"
			}),
			e.markers.map((t, r) => {
				let a = g(t.distance), o = _(t.elevation), s = n === t.id;
				if (!i) {
					let n = 12 + (r > 0 && a - g(e.markers[r - 1].distance) < 20 ? 11 : 0);
					return /* @__PURE__ */ w("g", { children: [
						/* @__PURE__ */ C("title", { children: `${t.name} · ${$(t.distance)} km · ${Math.round(t.elevation)} m${t.category ? " · " + t.category : ""}` }),
						/* @__PURE__ */ C("path", {
							d: `M${a} ${n + 8}V${o}`,
							stroke: s ? Or : Q,
							strokeWidth: ".7",
							opacity: ".5"
						}),
						/* @__PURE__ */ C(Mr, {
							marker: t,
							x: a,
							y: n,
							selected: s,
							small: !0
						})
					] }, t.id);
				}
				let l = r % 8, d = Math.floor(r / 8), f = u / Math.min(8, e.markers.length), p = c + f * (l + .5), m = 15 + d * 92, h = jr(t.name, 16);
				return /* @__PURE__ */ w("g", { children: [
					/* @__PURE__ */ C("title", { children: t.name }),
					/* @__PURE__ */ C("path", {
						d: `M${p} ${m + 17 + h.length * 13 + 13}L${a} ${o}`,
						stroke: s ? Or : "#7c896c",
						strokeWidth: ".9",
						opacity: ".75"
					}),
					/* @__PURE__ */ C(Mr, {
						marker: t,
						x: p,
						y: m,
						selected: s
					}),
					/* @__PURE__ */ C("text", {
						x: p,
						y: m + 29,
						textAnchor: "middle",
						fill: Q,
						fontSize: "12",
						fontWeight: "650",
						children: h.map((e, t) => /* @__PURE__ */ C("tspan", {
							x: p,
							dy: t ? 13 : 0,
							children: e
						}, t))
					}),
					/* @__PURE__ */ w("text", {
						x: p,
						y: m + 30 + h.length * 13,
						textAnchor: "middle",
						fill: Ar,
						fontSize: "10",
						children: [
							Math.round(t.elevation),
							" m · ",
							$(t.distance),
							" km"
						]
					}),
					/* @__PURE__ */ C("circle", {
						cx: a,
						cy: o,
						r: "2.5",
						fill: Q
					})
				] }, t.id);
			}),
			x && /* @__PURE__ */ C("path", {
				d: `M${g(x.distance)} ${f}V${p}`,
				stroke: Or,
				strokeWidth: "1",
				strokeDasharray: "3 3"
			}),
			t && /* @__PURE__ */ w("g", { children: [/* @__PURE__ */ C("path", {
				d: `M${g(t.distance)} ${Math.max(f, _(t.elevation) - 24)}V${p}`,
				stroke: Q,
				strokeWidth: i ? 1.8 : 1.2
			}), /* @__PURE__ */ C("circle", {
				cx: g(t.distance),
				cy: _(t.elevation),
				r: i ? 5 : 3.5,
				fill: kr,
				stroke: Q,
				strokeWidth: "2"
			})] }),
			/* @__PURE__ */ C("path", {
				d: `M${c} ${p}H${s - l}`,
				stroke: Q,
				strokeWidth: "1"
			}),
			b.map((e, t) => /* @__PURE__ */ w("g", { children: [/* @__PURE__ */ C("path", {
				d: `M${g(e)} ${p}v5`,
				stroke: Q
			}), /* @__PURE__ */ C("text", {
				x: g(e),
				y: p + (i ? 23 : 18),
				textAnchor: t === 0 ? "start" : t === b.length - 1 ? "end" : "middle",
				fill: Q,
				fontSize: i ? 12 : 9,
				children: $(e)
			})] }, e)),
			/* @__PURE__ */ C("text", {
				x: s - l,
				y: m - 4,
				textAnchor: "end",
				fill: Ar,
				fontSize: i ? 10 : 8,
				children: "DISTANCE · KM"
			})
		]
	});
}
function Pr({ model: e }) {
	return /* @__PURE__ */ w("div", {
		className: "profile-endpoints",
		children: [/* @__PURE__ */ w("div", { children: [
			/* @__PURE__ */ C("span", { children: "START" }),
			/* @__PURE__ */ C("strong", { children: e.startName }),
			/* @__PURE__ */ w("small", { children: [Math.round(e.samples[0][1]), " m"] })
		] }), /* @__PURE__ */ w("div", { children: [
			/* @__PURE__ */ C("span", { children: "FINISH" }),
			/* @__PURE__ */ C("strong", { children: e.finishName }),
			/* @__PURE__ */ w("small", { children: [Math.round(e.samples.at(-1)[1]), " m"] })
		] })]
	});
}
function Fr({ model: e, selected: t, onSelect: n }) {
	return e.markers.length > 0 && /* @__PURE__ */ C("div", {
		className: "profile-marker-list",
		"aria-label": "Route landmarks",
		children: e.markers.map((e) => /* @__PURE__ */ w("button", {
			type: "button",
			"aria-pressed": t === e.id,
			onClick: () => n(t === e.id ? null : e.id),
			children: [
				/* @__PURE__ */ C("span", {
					className: `profile-marker-icon ${e.type}`,
					children: e.type === "sprint" ? "S" : e.type === "climb" ? e.category || "▲" : "•"
				}),
				/* @__PURE__ */ w("span", { children: [/* @__PURE__ */ C("strong", { children: e.name }), /* @__PURE__ */ w("small", { children: [
					e.type === "climb" ? e.category ? `Category ${e.category} climb` : "Climb" : e.type === "sprint" ? "Sprint" : "Landmark",
					" · ",
					Math.round(e.elevation),
					" m"
				] })] }),
				/* @__PURE__ */ w("b", { children: [$(e.distance), /* @__PURE__ */ C("small", { children: "km" })] })
			]
		}, e.id))
	});
}
function Ir({ feed: e, time: t = 0, className: n, style: i }) {
	let c = a(() => Dr(e), [e]), l = oe(c, a(() => we(e), [e])(Number.isFinite(t) ? t : 0).positions), [u, d] = s(null), [f, p] = s(!1), m = o(null), h = r(), g = c.markers.some((e) => e.id === u) ? u : null;
	function _() {
		p(!0), m.current.showModal();
	}
	let v = /* @__PURE__ */ w("div", {
		className: "profile-facts",
		children: [/* @__PURE__ */ w("span", { children: [$(c.length), /* @__PURE__ */ C("small", { children: " KM" })] }), /* @__PURE__ */ w("span", { children: [Math.round(c.maxElevation), /* @__PURE__ */ C("small", { children: " M MAX" })] })]
	});
	return /* @__PURE__ */ w("section", {
		className: `pelotonia-route-profile route-profile ${n || ""}`,
		style: i,
		"aria-label": "Route elevation profile",
		children: [
			/* @__PURE__ */ w("div", {
				className: "profile-card-heading",
				children: [/* @__PURE__ */ C("span", { children: "ELEVATION PROFILE" }), /* @__PURE__ */ C("button", {
					type: "button",
					onClick: _,
					"aria-label": "Expand route profile",
					children: "Expand ↗"
				})]
			}),
			/* @__PURE__ */ C(Pr, { model: c }),
			/* @__PURE__ */ C(Nr, {
				model: c,
				progress: l,
				selected: g
			}),
			v,
			/* @__PURE__ */ C("p", {
				className: "profile-progress",
				children: l ? /* @__PURE__ */ w(S, { children: [
					/* @__PURE__ */ C("i", {}),
					"Race position ",
					/* @__PURE__ */ w("strong", { children: [$(l.distance), " km"] })
				] }) : "Waiting for race positions"
			}),
			/* @__PURE__ */ C(Fr, {
				model: c,
				selected: g,
				onSelect: d
			}),
			/* @__PURE__ */ w("dialog", {
				ref: m,
				className: "profile-dialog",
				"aria-labelledby": h,
				onClose: () => p(!1),
				onClick: (e) => {
					e.target === e.currentTarget && m.current.close();
				},
				children: [/* @__PURE__ */ w("div", {
					className: "profile-dialog-heading",
					children: [/* @__PURE__ */ w("div", { children: [/* @__PURE__ */ C("span", { children: "PELOTONIA · RACE ROUTE" }), /* @__PURE__ */ C("h2", {
						id: h,
						children: "The stage in profile"
					})] }), /* @__PURE__ */ C("button", {
						type: "button",
						onClick: () => m.current.close(),
						"aria-label": "Close route profile",
						children: "Close ✕"
					})]
				}), f && /* @__PURE__ */ w("div", {
					className: "profile-dialog-body",
					children: [
						/* @__PURE__ */ C(Pr, { model: c }),
						/* @__PURE__ */ C(Nr, {
							model: c,
							progress: l,
							selected: g,
							full: !0
						}),
						v,
						/* @__PURE__ */ C("p", {
							className: "profile-progress",
							children: l ? /* @__PURE__ */ w(S, { children: [
								/* @__PURE__ */ C("i", {}),
								"Race position ",
								/* @__PURE__ */ w("strong", { children: [$(l.distance), " km"] })
							] }) : "Waiting for race positions"
						}),
						/* @__PURE__ */ C(Fr, {
							model: c,
							selected: g,
							onSelect: d
						})
					]
				})]
			})
		]
	});
}
// src/commentary.js
var Lr = {
	"Approaching the hairpin": "Feltet nærmer sig hårnålesvinget. Vi følger rytterne gennem svinget.",
	"Through the switchback": "Rytterne er gennem hårnålesvinget og fortsætter ad ruten.",
	"Onto the upper road": "Løbet fortsætter på den øvre del af vejen."
}, Rr = {
	attack: ["{r} angriber! Et nyt angreb er sat ind.", "{r} sætter et angreb ind! Nu sker der noget på vejen."],
	pull: ["{r} tager en føring. Arbejdet fortsætter i front.", "{r} går frem og fører an."],
	caught: ["{r} er hentet igen. Angrebet er slut for denne gang.", "Så er {r} hentet. Kontakten er genetableret."],
	dropped: ["{r} mister kontakten. Der er nu afstand til gruppen.", "{r} bliver sat og må fortsætte bag gruppen."],
	sprint: ["{r} åbner spurten! Nu gælder det de sidste kræfter.", "Nu går {r} i spurt!"],
	protect: ["{r} arbejder for at beskytte sin holdkammerat."],
	celebration: ["{r} jubler!"],
	finish: ["{r} passerer målstregen."]
};
function zr(e) {
	let t = new Map((e.riders || []).map((e) => [e.id, e]));
	return (e.events || []).map((n, r) => {
		let i = t.get(n.riderId), a = Rr[n.type], o = a && i ? a[r % a.length].replace("{r}", i.name) : e.synthetic && Lr[n.label] || n.label || "En ny hændelse er registreret.";
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
function Br(e, t, n = zr(e)) {
	let r = n.filter((e) => e.time <= t), i = le(e, j(e, t));
	return i && r.push({
		id: "official-winner",
		time: e.results.publishedAt,
		text: `${i.rider.name} vinder løbet! Sejren er bekræftet i det officielle resultat.`,
		riderId: i.rider.id
	}), r.sort((e, t) => e.time - t.time);
}
// src/viewer/Commentary.jsx
var Vr = (e) => `${Math.floor(e / 60)}:${String(Math.floor(e % 60)).padStart(2, "0")}`;
function Hr({ entry: e, feed: t, onFollow: n }) {
	let r = t.riders.find((t) => t.id === e.riderId), i = r ? e.text.indexOf(r.name) : -1;
	return i < 0 ? e.text : /* @__PURE__ */ w(S, { children: [
		e.text.slice(0, i),
		/* @__PURE__ */ C("button", {
			className: "commentary-rider",
			onClick: () => n?.({
				type: "rider",
				id: r.id
			}),
			"aria-label": `Følg ${r.name}`,
			children: r.name
		}),
		e.text.slice(i + r.name.length)
	] });
}
function Ur({ feed: e, time: t, onFollow: n }) {
	let i = Br(e, t, a(() => zr(e), [e])), o = i.at(-1), [c, l] = s(!1), [u, d] = s(!1), f = r();
	return /* @__PURE__ */ w("section", {
		className: "commentary",
		"aria-label": "Løbskommentering",
		children: [
			/* @__PURE__ */ w("div", {
				className: "commentary-toolbar",
				children: [
					/* @__PURE__ */ w("span", {
						className: "commentary-heading",
						children: [/* @__PURE__ */ C("i", { "aria-hidden": "true" }), "LØBSKOMMENTERING"]
					}),
					/* @__PURE__ */ C("span", {
						className: "commentary-source",
						children: e.synthetic ? "DEMO · REGISTREREDE HÆNDELSER" : "REGISTREREDE HÆNDELSER"
					}),
					/* @__PURE__ */ C("button", {
						onClick: () => d(!u),
						"aria-pressed": u,
						children: u ? "Vis tekst" : "Skjul tekst"
					}),
					/* @__PURE__ */ w("button", {
						"aria-expanded": c,
						"aria-controls": f,
						onClick: () => l(!c),
						children: [
							c ? "Luk referat" : "Løbsreferat",
							" ",
							/* @__PURE__ */ C("span", {
								"aria-hidden": "true",
								children: c ? "−" : "+"
							})
						]
					})
				]
			}),
			!u && /* @__PURE__ */ w("div", {
				className: "commentary-current",
				role: "status",
				"aria-live": "polite",
				"aria-atomic": "true",
				children: [/* @__PURE__ */ C("time", { children: Vr(o?.time || 0) }), /* @__PURE__ */ C("p", { children: o ? /* @__PURE__ */ C(Hr, {
					entry: o,
					feed: e,
					onFollow: n
				}) : "Vi afventer den første registrerede løbshændelse." })]
			}),
			c && /* @__PURE__ */ w("div", {
				className: "commentary-history",
				id: f,
				role: "region",
				"aria-label": "Løbsreferat indtil nu",
				tabIndex: 0,
				children: [
					/* @__PURE__ */ C("p", {
						className: "commentary-note",
						children: "Kun hændelser frem til afspilningstidspunktet. Klik på et navn for at følge rytteren."
					}),
					[...i].reverse().map((t) => /* @__PURE__ */ w("div", {
						className: "commentary-entry",
						children: [/* @__PURE__ */ C("time", { children: Vr(t.time) }), /* @__PURE__ */ C("p", { children: /* @__PURE__ */ C(Hr, {
							entry: t,
							feed: e,
							onFollow: n
						}) })]
					}, t.id)),
					!i.length && /* @__PURE__ */ C("p", { children: "Ingen registrerede hændelser endnu." })
				]
			})
		]
	});
}
export { pe as ACTION_STATES, Ur as Commentary, Er as FeedPreflight, me as ORDER_TYPES, Z as RaceLoadError, pr as RaceViewer, Ir as RouteProfile, xe as SCHEMA, Me as VIEWER_VERSION, he as activityLabel, gr as adaptAtlasLineString, mr as adaptClubIdentity, hr as adaptPhysicalFinale, De as appearanceFor, Ee as broadcastTime, zr as buildCommentary, br as collectAssetReferences, Br as commentaryAt, wr as createRaceExportLoader, vr as createRaceSession, we as createSampler, _r as decodeViewerImport, Ve as finishRemaining, Ue as formatFinishDistance, Tr as inspectViewerFeed, He as labelRaceGroups, Be as raceGroups, xr as resolveFeedAssetUrls, j as resultsAt, k as surfaceAt, Te as validateClock, F as validateFeed, A as weatherAt };
