# Game export loading · 0.55

The game owns endpoints, authentication and its broadcast subscription. No account, game service or database is connected by this package.

```ts
// Server/exporter: no browser renderer is imported.
import {inspectViewerFeed} from '@pelotonia/race-viewer/data';
const report = inspectViewerFeed(feed);

// Client owner: the game supplies its URL and request options.
import {createRaceSession,createRaceExportLoader} from '@pelotonia/race-viewer';
const session=createRaceSession({
  load:createRaceExportLoader({
    urlForRace:id=>new URL(`/your-api/races/${encodeURIComponent(id)}/export`,location.origin).href,
    timeoutMs:15000,
    maxBytes:64*1024*1024,
    requestInit:{credentials:'same-origin'}
  }),
  onListenerError:error=>console.error('Spectator subscriber failed',error)
});
await session.open(raceId);
```

An export response is `{feed,clock,revision,serverOffsetMs?}`. `feed` must have an explicitly supported viewer schema or physical-export version. The requested race ID and clock duration must match. HTTP errors, invalid JSON, excess size and malformed payloads have classified `RaceLoadError.code` values; response bodies and URLs are not copied into error messages. `TIMEOUT` and `ABORTED` distinguish deadlines and caller cancellation. Native network failures retain the underlying fetch error. A timeout of zero disables the deadline. The loader performs GET only; other transports can implement the ordinary session `load` callback.

Documented asset fields are resolved against the final response URL, including redirects. Absolute and root-relative URLs retain normal URL semantics. GLB-internal dependencies are resolved by the model loader relative to the GLB. `resolveAssets:false` leaves source references unchanged; use it only if the host deliberately supplies another asset-resolution context. URL resolution clones the feed and changes no route geometry, rider samples, IDs or jersey SVG paths. `collectAssetReferences` and preflight inventory declared references, not dependencies embedded inside GLBs.

Host broadcast updates use increasing safe-integer revisions. `session.setConnection({raceId,status:'reconnecting'})` reports channel status without freezing, accelerating or otherwise changing the last authoritative timeline. Accepted clock updates preserve connection status until the host explicitly changes it. `session.retry()` retries the requested race; it never starts an automatic retry loop. `close` clears the selection and invalidates pending loads. `dispose` is terminal. In a reusable React owner whose effect is replayed in Strict Mode, use `close` on cleanup as shown in the harness; permanently dispose only when that session instance will not be reused.

The React `FeedPreflight` component can be used in import/admin UI. It validates data and reports coverage and declared files without fetching assets. Valid data is not proof of asset availability. For renderer readiness, continue using `whenAssetsReady` and `getAssetStatus`.

`examples/next/SessionAcceptanceHarness.tsx` uses only synthetic local `/exports/A/export.json` and `/exports/B/export.json`, with a deliberately injected 503 for the failure/retry case. `examples/make-session-fixtures.mjs` regenerates those exports; it calculates no race outcomes. The host must replace demo routes and fixtures with its existing game data and transport.
