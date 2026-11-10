'use client';
import dynamic from 'next/dynamic';
import {useCallback, useEffect, useRef, useState} from 'react';
import {scenicPresentationV1} from
  '../../../../lib/viewer/scenic-presentation-v1.mjs';

const ViewerScene = dynamic(() => import(
  '../viewer-preview/ViewerPreviewScene'), {ssr: false,
  loading: () => <p role="status">Loading the race renderer…</p>});

export default function MotorLabLiveClient({initialInput}) {
  const [plan, setPlan] = useState(initialInput?.plan ?? 'break');
  const [routeId, setRouteId] = useState(initialInput?.routeId ?? 'ridge');
  const [seed, setSeed] = useState(initialInput?.seed ?? 1);
  const [orders, setOrders] = useState(initialInput?.orders ?? {});
  const autoStarted = useRef(false);
  const [run, setRun] = useState(null);
  const [sync, setSync] = useState(null);
  const [classification, setClassification] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const start = useCallback(async (event) => {
    event?.preventDefault();
    setBusy(true); setError(''); setRun(null); setSync(null);
    setClassification(null);
    try {
      const sent = Date.now();
      const response = await fetch('/api/motor-lab/viewer-run', {
        method: 'POST', cache: 'no-store',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({plan, routeId, seed: Number(seed), orders}),
      });
      const payload = await response.json();
      const received = Date.now();
      if (!response.ok || !payload.ok)
        throw new Error(payload.error ?? 'Could not generate the test race.');
      setRun({feed: scenicPresentationV1(payload.feed),
        coverage: payload.coverage,
        version: payload.version,
        input: {plan, routeId, seed: Number(seed), orders}});
      setSync({clock: payload.clock,
        serverOffsetMs: payload.serverNowMs - (sent + received) / 2});
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }, [plan, routeId, seed, orders]);
  useEffect(() => {
    if (!initialInput || autoStarted.current) return;
    autoStarted.current = true;
    start();
  }, [initialInput, start]);
  useEffect(() => {
    if (!run) return undefined;
    let active = true;
    const update = async () => {
      try {
        const sent = Date.now();
        const response = await fetch(
          `/api/motor-lab/checkpoint-clock?raceId=${
            encodeURIComponent(run.feed.raceId)}`, {cache: 'no-store'});
        const payload = await response.json();
        const received = Date.now();
        if (!response.ok || payload.raceId !== run.feed.raceId ||
            payload.clock?.duration !== run.feed.duration)
          throw new Error('Shared playback clock is unavailable.');
        if (active) {
          setSync({clock: payload.clock,
            serverOffsetMs: payload.serverNowMs - (sent + received) / 2});
          setError('');
        }
      } catch (cause) { if (active) setError(cause.message); }
    };
    const timer = setInterval(update, 5000);
    return () => {active = false; clearInterval(timer);};
  }, [run]);
  useEffect(() => {
    if (!run || !sync?.clock.paused || classification) return undefined;
    let active = true;
    (async () => {
      const response = await fetch('/api/motor-lab/checkpoint-result', {
        method: 'POST', cache: 'no-store',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...run.input, raceId: run.feed.raceId}),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok ||
          payload.raceId !== run.feed.raceId)
        throw new Error(payload.error ?? 'Provisional classification unavailable.');
      if (active) setClassification(payload.results);
    })().catch(cause => {if (active) setError(cause.message);});
    return () => {active = false;};
  }, [run, sync?.clock.paused, classification]);
  useEffect(() => {
    if (sync && !sync.clock.paused) setClassification(null);
  }, [sync]);
  return <main className="motor-viewer-preview">
    <div className="motor-viewer-intro motor-viewer-live-intro">
      <h1>Generated Motor Lab checkpoint replay</h1>
      <p>Run a complete experimental simulation, then watch every recorded
        rider checkpoint in the new viewer. Playback time is presentation
        time: the motor has not measured an elapsed race clock. Group gaps
        remain recorded seconds, not rider metres.</p>
      <form onSubmit={start} aria-label="Generate Motor Lab test race">
        <label>Plan <select value={plan} onChange={event =>
          setPlan(event.target.value)}>
          <option value="sprint">Protect the sprinter</option>
          <option value="break">Send the captain in the break</option>
          <option value="balanced">Balanced racing</option>
          <option value="conserve">Save energy</option>
        </select></label>
        <label>Route <select value={routeId} onChange={event =>
          setRouteId(event.target.value)}>
          <option value="coast">Coast Road</option>
          <option value="ridge">Ridge Road</option>
        </select></label>
        <label>Scenario number <input type="number" min="0" max="9999"
          required value={seed} onChange={event =>
            setSeed(event.target.value)}/></label>
        <details><summary>Team orders</summary>
          <p>These orders are sent to the Motor Lab simulation before it runs.
            The viewer only displays the resulting recording.</p>
          <label>Chase contribution <select
            value={orders.chaseContribution ?? 'follow_plan'}
            onChange={event => setOrders(current => ({...current,
              chaseContribution: event.target.value}))}>
            <option value="follow_plan">Follow plan</option>
            <option value="ignore">Do not chase</option>
            <option value="all">All available helpers chase</option>
          </select></label>
          <label>Attack posture <select
            value={orders.attackPosture ?? 'follow_plan'}
            onChange={event => setOrders(current => ({...current,
              attackPosture: event.target.value}))}>
            <option value="follow_plan">Follow plan</option>
            <option value="none">No bunch attacks</option>
            <option value="selective">Selective attacks</option>
            <option value="repeated">Repeated attacks</option>
          </select></label>
          <label>Break response <select
            value={orders.breakResponse ?? 'hold_plan'}
            onChange={event => setOrders(current => ({...current,
              breakResponse: event.target.value}))}>
            <option value="hold_plan">Hold plan</option>
            <option value="chase_if_threatened">Chase if threatened</option>
          </select></label>
          <label>Break work <select
            value={orders.breakWork ?? 'cooperate'}
            onChange={event => setOrders(current => ({...current,
              breakWork: event.target.value}))}>
            <option value="cooperate">Cooperate</option>
            <option value="sit_on">Sit on</option>
            <option value="drive">Drive</option>
          </select></label>
          <label>Captain’s break attack <select
            value={orders.breakAttackMarker ?? 'none'}
            onChange={event => setOrders(current => ({...current,
              breakAttackMarker: event.target.value}))}>
            <option value="none">No scheduled break attack</option>
            <option value="40">After km 40</option>
            <option value="80">After km 80</option>
            <option value="120">After km 120</option>
          </select></label>
          <label>Captain support <select
            value={orders.captainSupport ?? 'hold_position'}
            onChange={event => setOrders(current => ({...current,
              captainSupport: event.target.value}))}>
            <option value="hold_position">Hold position</option>
            <option value="drop_back_if_dropped">Drop back if dropped</option>
          </select></label>
          <label>Late effort <select
            value={orders.lateEffort ?? 'follow_plan'}
            onChange={event => setOrders(current => ({...current,
              lateEffort: event.target.value}))}>
            <option value="follow_plan">Follow plan</option>
            <option value="conserve">Conserve</option>
            <option value="steady">Steady</option>
            <option value="hard">Hard</option>
          </select></label>
        </details>
        <button type="submit" disabled={busy}>{busy?
          'Generating…':'Generate and watch'}</button>
      </form>
      <p>Experimental men’s field · 32 fictional Motor Lab riders.
        This is not a saved game race or official result.</p>
      {run?<p role="status">{run.coverage.recordedRiderKilometres}
        {' '}rider checkpoints loaded from a full 160 km simulation.
        The camera is local; playback time is shared.</p>:null}
      {run?<a href={`/team/motor-lab/live?plan=${
        encodeURIComponent(run.input.plan)}&route=${
        encodeURIComponent(run.input.routeId)}&seed=${run.input.seed}&orders=${
        encodeURIComponent(JSON.stringify(run.input.orders))}`}>
        Open this shared replay ↗</a>:null}
      {error?<p role="alert">{error}</p>:null}
    </div>
    {run && sync?<ViewerScene key={run.feed.raceId} {...run}
      mode="lab" provisionalResults={classification} {...sync}/>:null}
    <footer><a href="/team/motor-lab">Motor Lab viewer</a> ·
      {' '}<a href="/team/motor-lab/engine">Motor Lab engine</a></footer>
  </main>;
}
