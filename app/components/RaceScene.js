"use client";
import Image from "next/image";
import {memo} from 'react';
import { formatGap } from "../../lib/race/replay.mjs";

function Cyclist({ x, y, color, mine, captain }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {mine && (
        <ellipse cx="0" cy="17" rx="19" ry="5" fill="#e1b957" opacity=".6" />
      )}
      <g stroke="#354b40" fill="none" strokeWidth="2">
        <circle cx="-12" cy="10" r="9" fill="#f0e7d5" />
        <circle cx="14" cy="10" r="9" fill="#f0e7d5" />
        <path d="M-12 10L-3-3L5 10H-12L0 2L14 10L8-9H14" />
      </g>
      <path
        d="M-3-10L5-3L0 9"
        stroke="#edc8a5"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M-8-10L1-18L10-14"
        stroke={color}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M9-13L14-5L10-3" stroke="#edc8a5" strokeWidth="3" fill="none" />
      <circle cx="13" cy="-20" r="4" fill="#c68f64" />
      <path d="M9-21q3-8 8 0Z" fill={mine ? "#deb34c" : color} />
      {captain && (
        <text
          x="0"
          y="-33"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill="#6f5113"
        >
          ★
        </text>
      )}
    </g>
  );
}

function RaceScene({
  frame,
  roster,
  teamId,
  focusId,
  weather,
  finished,
}) {
  const colors = [
    "#27694e",
    "#b97959",
    "#739597",
    "#8c7a9d",
    "#c5a65c",
    "#697b56",
  ];
  const groups = frame.groups,
    largest = Math.max(...groups.map((g) => g.riders.length));
  const show = groups.slice(0, 6);
  const focus = groups.find((g) => g.riders.includes(focusId));
  if (focus && !show.includes(focus)) show[5] = focus;
  const maxGap = Math.max(30, ...show.map((g) => g.gap));
  // Keep labels readable even when finish gaps differ by fractions of a second.
  // Exact gaps remain in the labels; the scene is deliberately schematic.
  const positions = new Map();
  let previous = 950;
  show.forEach((group, i) => {
    const ideal = 850 - Math.sqrt(group.gap / maxGap) * 650;
    const x = Math.max(
      150 + (show.length - 1 - i) * 125,
      Math.min(ideal, previous - 125),
    );
    positions.set(group, x);
    previous = x;
  });
  return (
    <div className="race-scene">
      <div className="race-scene-canvas">
      <Image src="/images/race-countryside-v1.png" alt="" fill sizes="(max-width: 760px) 100vw, 1000px" className="race-scene-art" priority/>
      <svg
        viewBox="0 0 1000 340"
        role="img"
        aria-label={`${groups.length} race groups at kilometre ${frame.km}. Positions represent the recorded time gaps.`}
      >
        <path
          d="M0 214Q200 196 443 218T1000 205V291Q730 305 475 287T0 294Z"
          fill="#ede7d5"
        />
        <path
          d="M0 226Q200 208 443 230T1000 217V277Q730 291 475 273T0 280Z"
          fill="#777b6b"
        />
        <path
          d="M0 251Q200 233 443 255T1000 242"
          fill="none"
          stroke="#e7debf"
          strokeWidth="2"
          strokeDasharray="16 22"
        />
        {show
          .slice()
          .reverse()
          .map((group) => {
            const x = positions.get(group);
            const members = group.riders.map((id) =>
              roster.find((r) => r.id === id),
            );
            const own = members.filter((r) => r.team_id === teamId),
              others = members.filter((r) => r.team_id !== teamId);
            const visible = [...own, ...others].slice(0, 12);
            const selected = group.riders.includes(focusId);
            return (
              <g
                key={group.riders[0]}
                opacity={!focusId || selected ? 1 : 0.68}
              >
                <g transform={`translate(${x - 54} 161)`}>
                  <rect
                    width="108"
                    height="37"
                    rx="12"
                    fill={selected ? "#204f3e" : "#fffaf0"}
                    stroke={selected ? "#edca78" : "#d4d4bd"}
                    strokeWidth="1.5"
                  />
                  <text
                    x="54"
                    y="15"
                    fontSize="11"
                    textAnchor="middle"
                    fill={selected ? "#fffaf0" : "#294d3b"}
                    fontWeight="700"
                  >
                    {group.gap < 0.5
                      ? groups.length === 1
                        ? "Peloton together"
                        : "Leaders"
                      : formatGap(group.gap)}
                  </text>
                  <text
                    x="54"
                    y="28"
                    fontSize="10"
                    textAnchor="middle"
                    fill={selected ? "#d6e2cb" : "#687769"}
                  >
                    {group.riders.length} riders
                    {own.length ? ` · ${own.length} yours` : ""}
                  </text>
                </g>
                {visible.map((r, i) => (
                  <Cyclist
                    key={r.id}
                    x={x - (i % 4) * 22}
                    y={226 + Math.floor(i / 4) * 13}
                    color={
                      r.team_id === teamId
                        ? "#226449"
                        : colors[
                            roster.findIndex((x) => x.team_id === r.team_id) %
                              colors.length
                          ]
                    }
                    mine={r.team_id === teamId}
                    captain={r.captain && r.team_id === teamId}
                  />
                ))}
              </g>
            );
          })}
        {Number(weather?.precipitation_mm) > 0 &&
          Array.from({ length: 22 }, (_, i) => (
            <path
              key={i}
              d={`M${i * 47} ${20 + ((i * 17) % 115)}l-6 14`}
              stroke="#889f99"
              opacity=".38"
              strokeWidth="1.5"
            />
          ))}
      </svg>
      </div>
      <div className="scene-caption">
        <span>{finished ? "Crossing the line" : "Race view"}</span>
        <span>Group overview · {largest} in the largest group</span>
      </div>
    </div>
  );
}

export default memo(RaceScene);
