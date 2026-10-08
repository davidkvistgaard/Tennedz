"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_CONFIG, VERSION } from "../../lib/race-lab/config.mjs";
import { flatScenario, STRATEGIES } from "../../lib/race-lab/scenario.mjs";
import { simulateLab } from "../../lib/race-lab/simulate.mjs";
import { batchInput, trial, summarize } from "../../lib/race-lab/batch.mjs";
const pct = (n) => `${(100 * n).toFixed(1)}%`;
function download(name, data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Lab() {
  const [seed, setSeed] = useState("pelotonia"),
    [strategy, setStrategy] = useState("sprint"),
    [config, setConfig] = useState(DEFAULT_CONFIG),
    [count, setCount] = useState(100);
  const [race, setRace] = useState(null),
    [report, setReport] = useState(null),
    [frame, setFrame] = useState(0),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(
      "Ready. All riders here are fictional test fixtures.",
    ),
    [error, setError] = useState("");
  const runId = useRef(0);
  useEffect(
    () => () => {
      runId.current++;
    },
    [],
  );
  function single() {
    try {
      setError("");
      const result = simulateLab({
        scenario: flatScenario(strategy),
        seed: `${seed}:0`,
        config,
      });
      setRace(result);
      setFrame(0);
      setStatus("Race calculated. Inspect the recorded stages below.");
    } catch (e) {
      setError(e.message);
    }
  }
  async function compare() {
    const id = ++runId.current;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const input = batchInput({ seed, count, config }),
        rows = [];
      for (let i = 0; i < input.count; i++) {
        if (id !== runId.current) return;
        rows.push(trial(input, i));
        if (i % 4 === 0) {
          setStatus(`Comparing plans: ${i + 1} / ${input.count} paired seeds`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      if (id === runId.current) {
        setReport(summarize(input, rows));
        setStatus(
          `Completed ${input.count * 4} races across ${input.count} paired seeds.`,
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      if (id === runId.current) setBusy(false);
    }
  }
  const current = race?.frames[frame];
  return (
    <main className="lab">
      <header>
        <p className="lab-eyebrow">PELOTONIA · DEVELOPMENT STUDIO</p>
        <h1>Race Lab</h1>
        <p>Read the race. Change one thing. Run it again.</p>
        <span className="lab-badge">
          Experimental flat-road engine · {VERSION}
        </span>
      </header>
      <aside className="lab-notice">
        Isolated fixtures only. No accounts, coins, database writes or
        production races. Results retain the settings of their last run; editing
        controls does not recalculate them. This is a design laboratory, not the
        live race viewer.
      </aside>
      <section className="lab-card">
        <h2>The experiment</h2>
        <p>
          Four equal-strength squads race 160 km by default. Change Amber’s
          plan; Birch protects its sprinter, Cedar attacks with its captain, and
          Dune races balanced. All orders are set before calculation.
        </p>
        <fieldset disabled={busy} className="lab-controls">
          <legend>Scenario and balance</legend>
          <label>
            Seed
            <input
              aria-label="Seed"
              value={seed}
              maxLength={120}
              onChange={(e) => setSeed(e.target.value)}
            />
          </label>
          <label>
            Amber’s plan
            <select
              aria-label="Amber’s plan"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              {Object.entries(STRATEGIES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Paired seeds
            <select
              aria-label="Paired seeds"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {[20, 100, 500].map((n) => (
                <option key={n} value={n}>
                  {n} seeds · {n * 4} races
                </option>
              ))}
            </select>
          </label>
          {[
            ["chaseStrength", "Chase strength", 0, 3, 0.05],
            ["cooperation", "Break cooperation", 0, 1, 0.05],
            ["energyCost", "Energy cost", 0.5, 2, 0.05],
          ].map(([key, label, min, max, step]) => (
            <label key={key}>
              {label}
              <input
                aria-label={label}
                type="number"
                min={min}
                max={max}
                step={step}
                value={config[key]}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    [key]: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
          <button onClick={single} className="lab-primary">
            Calculate one race
          </button>
          <button onClick={compare}>Compare all four plans</button>
          <button onClick={() => { setConfig(DEFAULT_CONFIG); setError(""); }}>
            Reset balance
          </button>
        </fieldset>
        {busy && (
          <button
            onClick={() => {
              runId.current++;
              setBusy(false);
              setStatus("Comparison cancelled. No partial report retained.");
            }}
          >
            Cancel comparison
          </button>
        )}
        <p role="status">{status}</p>
        {error && <p role="alert">{error}</p>}
      </section>
      {report && (
        <section className="lab-card">
          <h2>Strategy comparison</h2>
          <p>
            {report.count} shared seeds · {report.seed} · Chase{" "}
            {report.config.chaseStrength} · Cooperation{" "}
            {report.config.cooperation} · Energy cost {report.config.energyCost}
          </p>
          <p>
            Only Amber’s plan changes. Lower captain position is better.
            Intervals describe sampling uncertainty within this model, not
            real-world accuracy.
          </p>
          <div className="lab-scroll">
            <table>
              <caption>Amber’s results against the same opponents</caption>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Captain wins</th>
                  <th>95% interval</th>
                  <th>Mean captain position</th>
                  <th>Change vs sprint</th>
                  <th>Team energy left</th>
                  <th>Any break survives</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.strategy}>
                    <th>{STRATEGIES[r.strategy]}</th>
                    <td>{pct(r.captainWinRate)}</td>
                    <td>{r.winInterval95.map(pct).join(" – ")}</td>
                    <td>{r.averageCaptainPosition.toFixed(2)}</td>
                    <td>{r.pairedPositionDelta.toFixed(2)}</td>
                    <td>{r.averageEnergy.toFixed(1)}</td>
                    <td>{pct(r.breakSurvivalRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() =>
              download("pelotonia-race-lab-comparison.json", report)
            }
          >
            Export comparison
          </button>
          <p className="small">
            A strong result in this fixed scenario does not establish a
            universally best strategy. Test different seeds, balance settings
            and, later, more routes and opponents.
          </p>
        </section>
      )}
      {race && current && (
        <section className="lab-card">
          <h2>Race inspection</h2>
          <p>
            Recorded seed: <strong>{race.seed}</strong> · Amber:{" "}
            {STRATEGIES[race.scenario.teams[0].strategy]} ·{" "}
            {race.config.distanceKm} km
          </p>
          <div className="lab-metrics">
            <strong>{current.km} km ridden</strong>
            <strong>{current.gapSeconds.toFixed(1)} s break gap</strong>
            <strong>{current.breakIds.length} riders ahead</strong>
          </div>
          <svg
            viewBox="0 0 800 150"
            role="img"
            aria-label="Recorded breakaway gap over race distance"
          >
            <line x1="10" y1="135" x2="790" y2="135" stroke="#bdc7b0" />
            <polyline
              fill="none"
              stroke="#bb6a36"
              strokeWidth="3"
              points={race.frames
                .map(
                  (f) =>
                    `${10 + (780 * f.km) / race.config.distanceKm},${135 - (120 * f.gapSeconds) / Math.max(1, ...race.frames.map((x) => x.gapSeconds))}`,
                )
                .join(" ")}
            />
            <line
              x1={10 + (780 * current.km) / race.config.distanceKm}
              x2={10 + (780 * current.km) / race.config.distanceKm}
              y1="10"
              y2="135"
              stroke="#214f3c"
            />
          </svg>
          <label>
            Recorded stage
            <input
              aria-label="Recorded stage"
              type="range"
              min="0"
              max={race.frames.length - 1}
              value={frame}
              onChange={(e) => setFrame(Number(e.target.value))}
            />
          </label>
          <p className="small">
            The graph and result table show the complete calculated race. The
            slider only inspects recorded state.
          </p>
          <div className="lab-actions">
            {current.actions.map((a) => (
              <article key={a.teamId}>
                <h3>
                  {race.scenario.teams.find((t) => t.id === a.teamId).name}
                </h3>
                <p>{a.reason}</p>
                <p>
                  {a.workers.length} chasing · Mean energy{" "}
                  {(
                    current.riders
                      .filter(
                        (r) =>
                          race.initial.find((x) => x.id === r.id).teamId ===
                          a.teamId,
                      )
                      .reduce((sum, r) => sum + r.energy, 0) / 8
                  ).toFixed(1)}
                </p>
              </article>
            ))}
          </div>
          <ol>
            {race.events
              .filter((e) => e.km <= current.km)
              .map((e, i) => (
                <li key={i}>
                  <strong>{e.km} km</strong> · {e.text}
                </li>
              ))}
          </ol>
          <details>
            <summary>All riders: energy and final position</summary>
            <div className="lab-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Rider</th>
                    <th>Gap</th>
                    <th>Final energy</th>
                    <th>Positioning loss</th>
                  </tr>
                </thead>
                <tbody>
                  {race.results.map((r) => (
                    <tr key={r.id}>
                      <td>{r.position}</td>
                      <th>{r.name}</th>
                      <td>{r.gapSeconds.toFixed(1)} s</td>
                      <td>{r.energy.toFixed(1)}</td>
                      <td>{r.positionLoss.toFixed(2)} score</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <button
            onClick={() =>
              download("pelotonia-race-lab-input.json", {
                version: race.version,
                scenario: race.scenario,
                seed: race.seed,
                config: race.config,
              })
            }
          >
            Export reproducible input
          </button>
          <button
            onClick={() => download("pelotonia-race-lab-race.json", race)}
          >
            Export full race trace
          </button>
        </section>
      )}
      <footer>
        <h2>What this model can tell us</h2>
        <p>
          Helpers rotate by remaining energy. Teams do not chase their own
          break. Cooperation, fatigue and the chase determine the gap; saved
          energy and positioning influence the finish. Every run is calculated
          before inspection.
        </p>
        <p>
          First prototype: flat roads, one early attack opportunity and two
          groups. No wind, crashes, terrain, intermediate attacks or dropped
          riders. Energy and speed formulas are experimental; this is not yet a
          replacement for the production engine.
        </p>
      </footer>
    </main>
  );
}
