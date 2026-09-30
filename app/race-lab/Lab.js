"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_CONFIG, VERSION } from "../../lib/race-lab/config.mjs";
import { flatScenario, STRATEGIES } from "../../lib/race-lab/scenario.mjs";
import { simulateLab } from "../../lib/race-lab/simulate.mjs";
import { batchInput, trial, summarize } from "../../lib/race-lab/batch.mjs";
import { runKilometreLab } from "../../lib/engine/v2/lab.mjs";
import { readRecordedKilometre } from "../../lib/engine/v2/recording.mjs";
import { orderAt } from "../../lib/engine/v2/orders.mjs";
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
    [breakResponse, setBreakResponse] = useState("hold_plan"),
    [forwardResponse, setForwardResponse] = useState("protect_forward"),
    [breakWork, setBreakWork] = useState("cooperate"),
    [breakFinale, setBreakFinale] = useState("hold_group"),
    [helperAttackPolicy, setHelperAttackPolicy] = useState("open"),
    [breakAttackAtKm, setBreakAttackAtKm] = useState(0),
    [phaseAtKm, setPhaseAtKm] = useState(0),
    [phaseEffort, setPhaseEffort] = useState(""),
    [phaseChase, setPhaseChase] = useState(""),
    [phaseBreakWork, setPhaseBreakWork] = useState(""),
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
      const scenario=flatScenario(strategy);
      scenario.teams[0].breakResponse=breakResponse;
      scenario.teams[0].forwardResponse=forwardResponse;
      scenario.teams[0].breakWork=breakWork;
      scenario.teams[0].breakFinale=breakFinale;
      scenario.teams[0].helperAttackPolicy=helperAttackPolicy;
      scenario.teams[0].breakAttackAtKm=breakAttackAtKm;
      scenario.teams[0].phaseAtKm=phaseAtKm;
      scenario.teams[0].phaseEffort=phaseEffort;
      scenario.teams[0].phaseChase=phaseChase;
      scenario.teams[0].phaseBreakWork=phaseBreakWork;
      const result=runKilometreLab({scenario,seed:`${seed}:v2`});
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
  const amberCommitted=kilometreRace?.committedInputs.teams.find(team=>team.id==='team-0');
  const amberCurrentOrder=currentKm&&amberCommitted?
    orderAt(amberCommitted.orders,currentKm.km-1):null;
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
          <label>
            Amber’s break response · kilometre prototype only
            <select aria-label="Amber’s break response" value={breakResponse}
              onChange={e=>setBreakResponse(e.target.value)}>
              <option value="hold_plan">Hold the scheduled plan</option>
              <option value="chase_if_threatened">Road captain chases a threatening break</option>
            </select>
          </label>
          <label>
            Amber's rider-ahead fallback - kilometre prototype only
            <select aria-label="Amber's rider-ahead fallback" value={forwardResponse}
              onChange={e=>setForwardResponse(e.target.value)}>
              <option value="protect_forward">Keep protecting our rider ahead</option>
              <option value="chase_if_fading">Chase if our rider ahead fades near the bunch</option>
            </select>
          </label>
          <label>
            Amber’s break work · kilometre prototype only
            <select aria-label="Amber’s break work" value={breakWork}
              onChange={e=>setBreakWork(e.target.value)}>
              <option value="cooperate">Take turns at the front</option>
              <option value="sit_on">Sit on and save energy</option>
            </select>
          </label>
          <label>
            Amber's break finale - kilometre prototype only
            <select aria-label="Amber's break finale" value={breakFinale}
              onChange={e=>setBreakFinale(e.target.value)}>
              <option value="hold_group">Stay with the group</option>
              <option value="attack_if_outsprinted">Attack at finale checkpoints if out-sprinted</option>
            </select>
          </label>
          <label>
            Amber's helper freedom - kilometre prototype only
            <select aria-label="Amber's helper freedom" value={helperAttackPolicy}
              onChange={e=>setHelperAttackPolicy(e.target.value)}>
              <option value="open">Helpers may take their own chances</option>
              <option value="hold_for_captain">Keep helpers for the captain</option>
              <option value="release_if_dropped">Release helpers if the captain is dropped</option>
            </select>
          </label>
          <label>
            Amber’s captain attacks from the break · kilometre prototype only
            <select aria-label="Amber’s break attack" value={breakAttackAtKm}
              onChange={e=>setBreakAttackAtKm(Number(e.target.value))}>
              <option value={0}>No planned split</option>
              <option value={40}>After kilometre 40</option>
              <option value={80}>After kilometre 80</option>
              <option value={120}>After kilometre 120</option>
            </select>
          </label>
          <label>
            Amber's order-change marker · kilometre prototype only
            <select aria-label="Amber's order-change marker" value={phaseAtKm}
              onChange={e=>setPhaseAtKm(Number(e.target.value))}>
              <option value={0}>No scheduled change</option>
              <option value={40}>After kilometre 40</option>
              <option value={55}>After exposed-coast keypoint (55 km)</option>
              <option value={80}>After kilometre 80</option>
              <option value={120}>After kilometre 120</option>
            </select>
          </label>
          <label>
            Amber's later effort · kilometre prototype only
            <select aria-label="Amber's later effort" value={phaseEffort}
              disabled={phaseAtKm===0}
              onChange={e=>setPhaseEffort(e.target.value)}>
              <option value="">Keep the original effort</option>
              <option value="conserve">Conserve energy</option>
              <option value="steady">Steady effort</option>
              <option value="hard">Hard effort</option>
            </select>
          </label>
          <label>
            Amber's later chase · kilometre prototype only
            <select aria-label="Amber's later chase" value={phaseChase}
              disabled={phaseAtKm===0}
              onChange={e=>setPhaseChase(e.target.value)}>
              <option value="">Keep the original chase order</option>
              <option value="ignore">Ignore the break</option>
              <option value="selective">Chase selectively</option>
              <option value="all">Commit every available helper</option>
            </select>
          </label>
          <label>
            Amber's later break work - kilometre prototype only
            <select aria-label="Amber's later break work" value={phaseBreakWork}
              disabled={phaseAtKm===0}
              onChange={e=>setPhaseBreakWork(e.target.value)}>
              <option value="">Keep the original break work</option>
              <option value="cooperate">Take turns at the front</option>
              <option value="sit_on">Sit on without pulling</option>
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
          {amberCurrentOrder&&<p className="small">Scheduled Amber orders: {amberCurrentOrder.effort} effort · {amberCurrentOrder.chase} chase · {amberCurrentOrder.breakWork.replaceAll('_',' ')} in the break · {amberCurrentOrder.attack} attacks. Changes take effect after their marker.</p>}
          <div className="lab-scroll"><table><caption>Team state after this kilometre</caption><thead><tr><th>Team</th><th>Mean energy</th><th>Mean riding ability</th><th>Active leader</th></tr></thead><tbody>{currentKm.teamEnergy.map(team=>{
            const name=kilometreRace.scenario.teams.find(t=>t.id===team.teamId)?.name??team.teamId;
            const leaderId=currentKm.activeLeaders.find(l=>l.teamId===team.teamId)?.riderId;
            const leader=kilometreRace.scenario.teams.find(t=>t.id===team.teamId)?.riders.find(r=>r.id===leaderId)?.name??leaderId;
            return <tr key={team.teamId}><th>{name}</th><td>{team.mean.toFixed(1)}</td><td>{currentKm.teamPace.find(p=>p.teamId===team.teamId)?.meanAbility.toFixed(1)}</td><td>{leader}</td></tr>;
          })}</tbody></table></div>
          <p>{currentKm.breakawayRiderIds.length} rider{currentKm.breakawayRiderIds.length===1?'':'s'} in the break · {currentKm.attackers.length} attack{currentKm.attackers.length===1?'':'s'} attempted · {currentKm.joinedBreakawayRiderIds.length} joined the break · {currentKm.chasers.length} chasing team{currentKm.chasers.length===1?'':'s'} · {currentKm.shelterEvents.length} protected leader{currentKm.shelterEvents.length===1?'':'s'} · {currentKm.recoveredRiderIds.length} rider{currentKm.recoveredRiderIds.length===1?'':'s'} recovering{currentKm.decisions.length?` · ${currentKm.decisions.length} tactical decision${currentKm.decisions.length===1?'':'s'}`:''}</p>
          {currentKm.roadGroups.length>1&&<p className="small">Road groups: {currentKm.roadGroups.map(group=>`${group.riderIds.length} rider${group.riderIds.length===1?'':'s'} at +${group.gapSeconds.toFixed(1)} s`).join(' · ')} ahead of the peloton.</p>}
          {currentKm.roadGroups.length>0&&<details className="lab-road-groups">
            <summary>Inspect road groups and riders</summary>
            {currentKm.roadGroups.map((group,index)=><div key={group.id}>
              <strong>Group {index+1} · +{group.gapSeconds.toFixed(1)} s</strong>
              <ul>{group.riderIds.map(id=>{
                const rider=kilometreRace.committedInputs.teams.flatMap(team=>team.riders)
                  .find(candidate=>candidate.id===id);
                const energy=currentKm.riderGroups.find(state=>state.id===id)?.energy;
                return <li key={id}>{rider?.name??id} · {currentKm.pullRiderIds.includes(id)?
                  'Pulling this km':'Not pulling this km'} · {energy?.toFixed(1)??'?'} energy</li>;
              })}</ul>
            </div>)}
          </details>}
          {currentKm.formedChaseGroupId&&<p className="small">New chase group from the peloton: {currentKm.roadGroups.at(-1).riderIds.length} rider{currentKm.roadGroups.at(-1).riderIds.length===1?'':'s'} escaped behind the leading break.</p>}
          {currentKm.bridgedBreakRiderIds.length>0&&<p className="small">Bridge completed: {currentKm.bridgedBreakRiderIds.length} rider{currentKm.bridgedBreakRiderIds.length===1?'':'s'} caught the nearest break group after closing its remaining gap.</p>}
          {currentKm.splitAttacks?.map(attack=><p className="small" key={`break-attack-${attack.riderId}`}>{attack.source==='automatic'?'Automatic finale attack':'Planned attack'} from the break: {attack.riderId} · {attack.status.replaceAll('_',' ')}{attack.status==='split'?` · gained ${attack.attackSeconds.toFixed(1)} s on their group`:''}.</p>)}
          {currentKm.blockedBreakAttacks.length>0&&<p className="small">Unexecuted break attacks: {currentKm.blockedBreakAttacks.map(event=>`${event.riderId} (${event.reason.replaceAll('_',' ')})`).join(' · ')}.</p>}
          {currentKm.releasedHelperAttackRiderIds.length>0&&<p className="small">Helpers released after their captain was dropped: {currentKm.releasedHelperAttackRiderIds.join(', ')}.</p>}
          {currentKm.mergedRoadGroupIds.length>0&&<p className="small">Road groups came together.</p>}
          {currentKm.finaleRoadGroupCatches.length>0&&<p className="small">Finale catch: {currentKm.finaleRoadGroupCatches.length} rider{currentKm.finaleRoadGroupCatches.length===1?'':'s'} caught by a faster road group, while riders ahead stayed clear.</p>}
          {currentKm.decisions.length>0&&<p className="small">Precommitted decisions: {currentKm.decisions.map(decision=>`${kilometreRace.scenario.teams.find(team=>team.id===decision.teamId)?.name??decision.teamId} ${decision.kind.replaceAll('_',' ')}`).join(' · ')}.</p>}
          {currentKm.activeBreakResponseTeamIds.length>0&&<p className="small">Precommitted break chase active: {currentKm.activeBreakResponseTeamIds.map(id=>kilometreRace.scenario.teams.find(team=>team.id===id)?.name??id).join(', ')}.</p>}
          {currentKm.releasedForwardTeamIds.length>0&&<p className="small">Fading rider ahead: {currentKm.releasedForwardTeamIds.map(id=>kilometreRace.scenario.teams.find(team=>team.id===id)?.name??id).join(', ')} switched to chasing for their remaining riders.</p>}
          {currentKm.supportEvents.length>0&&<p className="small">Captain support: {currentKm.supportEvents.map(event=>`${kilometreRace.scenario.teams.find(team=>team.id===event.teamId)?.name??event.teamId} sent ${event.helperId} back to help ${event.leaderId}`).join(' · ')}.</p>}
          {currentKm.heldChaseTeamIds.length>0&&<p className="small">Waiting to chase: {currentKm.heldChaseTeamIds.map(id=>kilometreRace.scenario.teams.find(team=>team.id===id)?.name??id).join(', ')} let a manageable gap stand for now.</p>}
          {currentKm.passiveGapDelta!==0&&<p className="small">Riding pace alone: the break {currentKm.passiveGapDelta>0?'gained':'lost'} {Math.abs(currentKm.passiveGapDelta).toFixed(2)} seconds this kilometre.</p>}
          {currentKm.breakawayRiderIds.length>0&&<p className="small">Recorded break work: {currentKm.pullRiderIds.length} rider{currentKm.pullRiderIds.length===1?'':'s'} took pulls this kilometre.</p>}
          {currentKm.caughtBreakawayRiderIds.length>0&&<p className="small">{currentKm.finishLineCatch?'Caught in the finishing sprint':'Break caught'}: {currentKm.caughtBreakawayRiderIds.length} rider{currentKm.caughtBreakawayRiderIds.length===1?'':'s'} brought back.</p>}
          {currentKm.failedBridgeRiderIds.length>0&&<p className="small">Distant break: {currentKm.failedBridgeRiderIds.length} new attack{currentKm.failedBridgeRiderIds.length===1?'':'s'} could not bridge across the gap; the riders spent energy without joining it.</p>}
          {currentKm.blockedAttacks.length>0&&<p className="small">Blocked planned attacks: {currentKm.blockedAttacks.map(blocked=>`${kilometreRace.scenario.teams.find(team=>team.id===blocked.teamId)?.name??blocked.teamId} (${blocked.reason.replaceAll('_',' ')})`).join(' · ')}</p>}
          {currentKm.fatiguedAttackRiderIds.length>0&&<p className="small">Repeated efforts: {currentKm.fatiguedAttackRiderIds.length} attack{currentKm.fatiguedAttackRiderIds.length===1?'':'s'} lost sharpness after earlier moves.</p>}
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
