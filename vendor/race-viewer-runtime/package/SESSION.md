# Game-owned race session · 0.45

The optional `createRaceSession` store handles loading and ordered broadcast updates. It does not fetch by itself, store credentials, subscribe to a service or calculate a race. The game supplies those operations.

```ts
const session = createRaceSession({
  load: async (raceId, {signal}) => {
    const response = await fetch(`/your-game-api/races/${encodeURIComponent(raceId)}/viewer`, {signal});
    if (!response.ok) throw new Error('Race export unavailable');
    return response.json(); // {feed, clock, revision, serverOffsetMs?}
  }
});
await session.open(raceId);
// In the game's own broadcast subscription:
session.updateClock({raceId, revision: 12, clock: serverClock});
// On leaving the broadcast owner scope:
session.dispose();
```

The URL above is an integration example, not an endpoint created in this project. The game must map its existing export to the viewer contract. `feed.raceId` must match the requested ID, and clock duration must match feed duration. Revision is a nonnegative, safe integer, scoped to this race session and strictly increasing for clock messages. Duplicate and older revisions are ignored. Server-authorized rewind is allowed with a newer revision. After a server stream reset, reopen with a fresh snapshot/revision. No wall-clock freshness is inferred.

Only the newest load request may commit. Superseded requests receive an abort signal; their response is ignored even if the loader ignores abort. A failed or invalid replacement keeps the previous active feed and clock visible while exposing an error. Retry with `open`. Closing or disposing invalidates pending responses. Disposal is terminal. A pending switch can still receive valid clock updates for the currently visible race.

`getSnapshot` has stable object identity until a transition and works with React `useSyncExternalStore`; subscribers should not throw. State, active metadata and copied clock objects are frozen. Feed data remains the producer's immutable reference: do not mutate it after submission. Clock updates retain that reference and do not revalidate/rebuild the terrain or rider feed. Each spectator's camera stays outside this shared store.

`examples/next/RaceSessionScene.tsx` shows a client component with an independent camera per mounted spectator. RaceSessionClient.tsx supplies its client-only Next.js boundary. Create the session in a client owner; functions in a session cannot be serialized as props from a server component. The game owns the session lifetime; unmounting one spectator must not dispose the shared session. The example resets a spectator on a different race ID, retains it during clock updates and leaves the last valid race visible during a failed switch. There is no real game connection in this standalone prototype.
