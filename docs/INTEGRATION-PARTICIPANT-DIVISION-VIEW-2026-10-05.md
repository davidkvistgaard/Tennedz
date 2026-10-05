# Private participant division reveal

`GET /api/event/reveal?event_id=...` is an authenticated, participant-only view for opted-in two-phase races. It first checks that the requesting team entered the event. Before a persisted reveal it returns the registration or reveal-pending phase without opponents. After reveal it returns only that team's division index, total division count, and each opponent's public team name, frozen earned points and seed rank. It reads only reveal rows and team names; opponent riders, lineups, orders and the private tactics input are absent from the response.

The phase is calculated from the event's two deadlines **and** existence of the persisted division reveal and tactics lock. Incomplete, duplicate, non-contiguous or unbalanced reveal rows fail closed. A 45-team unit fixture checks that a team in division 2 sees exactly its 15 teams and no private fields, while state and corruption tests cover pending reveal and tactics lock.

The preview race setup now reads this endpoint for an entered team in an opted-in two-phase event. It shows that team's division and the frozen ranking points, and permits lineup and order edits through the separate tactics endpoint only during the preparation window. The calendar distinguishes closed registration from an entered team's tactics window. Legacy races keep their existing setup path. The UI hides the old direct race-start link for opted-in events because their result runner is not wired yet.

A local browser test uses authenticated fixture accounts and mocked event/reveal responses to verify the division, tactics POST, and absence of the old race-start link. This does not verify a persistent 45-team event in a browser or the end-to-end result flow. Production data and deployment remain unchanged.
