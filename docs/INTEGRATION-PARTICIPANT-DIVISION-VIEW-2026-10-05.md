# Private participant division reveal

`GET /api/event/reveal?event_id=...` is an authenticated, participant-only view for opted-in two-phase races. It first checks that the requesting team entered the event. Before a persisted reveal it returns the registration or reveal-pending phase without opponents. After reveal it returns only that team's division index, total division count, and each opponent's public team name, frozen earned points and seed rank. It reads only reveal rows and team names; opponent riders, lineups, orders and the private tactics input are absent from the response.

The phase is calculated from the event's two deadlines **and** existence of the persisted division reveal and tactics lock. Incomplete, duplicate, non-contiguous or unbalanced reveal rows fail closed. A 45-team unit fixture checks that a team in division 2 sees exactly its 15 teams and no private fields, while state and corruption tests cover pending reveal and tactics lock.

This endpoint is preview-only code and is not linked from the current game UI. It needs an isolated browser journey with an opted-in event and authenticated participants before it becomes part of the playable two-phase flow. No production data or deployment changed.
