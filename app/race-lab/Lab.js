"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_CONFIG, VERSION } from "../../lib/race-lab/config.mjs";
import { flatScenario, STRATEGIES } from "../../lib/race-lab/scenario.mjs";
import { simulateLab } from "../../lib/race-lab/simulate.mjs";
import { batchInput, trial, summarize } from "../../lib/race-lab/batch.mjs";
import { runKilometreLab } from "../../lib/engine/v2/lab.mjs";
import { readRecordedKilometre } from "../../lib/engine/v2/recording.mjs";
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
    [kilometreRace, setKilometreRace] = useState(null),
    [kilometreKm, setKilometreKm] = useState(0),
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
  function runKilometres() {
    try {
      setError("");
      const result=runKilometreLab({scenario:flatScenario(strategy),seed:`${seed}:v2`});
      setKilometreRace(result);
      setKilometreKm(0);
      setStatus("Kilometre prototype calculated. Inspect its recorded tactical trace below.");
    } catch(e) { setError(e.message); }
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
  const currentKm=kilometreRace?readRecordedKilometre(kilometreRace,kilometreKm):null;
  const kmMaxGap=kilometreRace?Math.max(1,...kilometreRace.frames.map(f=>f.gapSeconds)):1;
  const kmGapPoints=kilometreRace?.frames.map(f=>`${10+780*f.km/kilometreRace.route.distanceKm},${135-120*f.gapSeconds/kmMaxGap}`).join(' ');
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
          <button onClick={runKilometres}>Run kilometre prototype</button>
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
      {kilometreRace && currentKm && (
        <section className="lab-card" aria-label="Kilometre engine prototype">
          <h2>Kilometre engine · tactical trace</h2>
          <p>Same four fictional squads. This separate v2 model records changing terrain, weather, energy, attacks and pursuit at every kilometre. Its finish order is experimental and does not replace the original Race Lab results.</p>
          <div className="lab-metrics"><strong>{currentKm.km} / {kilometreRace.route.distanceKm} km</strong><strong>{currentKm.gapSeconds.toFixed(1)} s break gap</strong><strong>{currentKm.terrain} · {currentKm.surface}{currentKm.exposed?' · exposed':''}</strong></div>
          <p className="small">Weather here: {kilometreRace.route.kilometres[kilometreKm].weather.temperatureC}°C · wind {kilometreRace.route.kilometres[kilometreKm].weather.windKph} km/h · rain {kilometreRace.route.kilometres[kilometreKm].weather.rainMm} mm.</p>
          <svg viewBox="0 0 800 150" role="img" aria-label="Recorded breakaway gap in the kilometre prototype">
            <line x1="10" y1="135" x2="790" y2="135" stroke="#bdc7b0" />
            <polyline fill="none" stroke="#bb6a36" strokeWidth="3" points={kmGapPoints} />
            <line x1={10+780*currentKm.km/kilometreRace.route.distanceKm} x2={10+780*currentKm.km/kilometreRace.route.distanceKm} y1="10" y2="135" stroke="#214f3c" />
          </svg>
          <label>Recorded kilometre<input aria-label="Recorded kilometre" type="range" min="0" max={kilometreRace.frames.length-1} value={kilometreKm} onChange={e=>setKilometreKm(Number(e.target.value))}/></label>
          <div className="lab-scroll"><table><caption>Team state after this kilometre</caption><thead><tr><th>Team</th><th>Mean energy</th><th>Mean riding ability</th><th>Active leader</th></tr></thead><tbody>{currentKm.teamEnergy.map(team=>{
            const name=kilometreRace.scenario.teams.find(t=>t.id===team.teamId)?.name??team.teamId;
            const leaderId=currentKm.activeLeaders.find(l=>l.teamId===team.teamId)?.riderId;
            const leader=kilometreRace.scenario.teams.find(t=>t.id===team.teamId)?.riders.find(r=>r.id===leaderId)?.name??leaderId;
            return <tr key={team.teamId}><th>{name}</th><td>{team.mean.toFixed(1)}</td><td>{currentKm.teamPace.find(p=>p.teamId===team.teamId)?.meanAbility.toFixed(1)}</td><td>{leader}</td></tr>;
          })}</tbody></table></div>
          <p>{currentKm.breakawayRiderIds.length} rider{currentKm.breakawayRiderIds.length===1?'':'s'} in the break · {currentKm.attackers.length} new attack{currentKm.attackers.length===1?'':'s'} · {currentKm.chasers.length} chasing team{currentKm.chasers.length===1?'':'s'} · {currentKm.shelterEvents.length} protected leader{currentKm.shelterEvents.length===1?'':'s'} · {currentKm.recoveredRiderIds.length} rider{currentKm.recoveredRiderIds.length===1?'':'s'} recovering{currentKm.decisions.length?` · ${currentKm.decisions.length} backup-plan change`:''}</p>
          <p className="small">The entire trace and finish order were calculated before this slider appeared. The slider only reads saved frames.</p>
          <h3>Experimental finish order</h3>
          <p className="small">For balancing only. These are not live race results or a validated prediction.</p>
          <div className="lab-scroll"><table><caption>Provisional rider results</caption><thead><tr><th>Place</th><th>Rider</th><th>Team</th><th>Gap</th><th>Group</th><th>Energy left</th></tr></thead><tbody>{kilometreRace.provisionalResults.map(rider=>{
            const team=kilometreRace.scenario.teams.find(t=>t.id===rider.teamId);
            return <tr key={rider.riderId}><td>{rider.position}</td><th>{rider.name}</th><td>{team?.name??rider.teamId}</td><td>{rider.position===1?'—':`+${rider.gapSeconds.toFixed(1)} s`}</td><td>{rider.group}</td><td>{rider.energy.toFixed(1)}</td></tr>;
          })}</tbody></table></div>
        </section>
      )}
      <footer>
        <h2>What the original flat model can tell us</h2>
        <p>
          Helpers rotate by remaining energy. Teams do not chase their own
          break. Cooperation, fatigue and the chase determine the gap; saved
          energy and positioning influence the finish. Every run is calculated
          before inspection.
        </p>
        <p>
          The original flat model has one early attack opportunity and two
          groups. It does not model wind, changing terrain, intermediate attacks
          or dropped riders. The kilometre prototype above begins those systems,
          with provisional placing but no production replay yet. Neither model replaces the
          production engine.
        </p>
      </footer>
    </main>
  );
}
