import { validateTeamKit } from '../riders/club-kit.mjs';

export const RECORDED_APPEARANCE_VERSION = 1;

/**
 * Freeze the game's selected jerseys alongside a completed replay. Appearance
 * is presentation data: this copies the race output and never changes a frame,
 * order, group, gap, event or result. Missing selections use the game's own
 * deterministic default for that team.
 */
export function withRecordedAppearanceV1(output, identityRows = []) {
  const selected = new Map(identityRows.map(row =>
    [row.team_id, { palette: row.palette, pattern: row.pattern }]));
  return { ...output, divisions: output.divisions.map(division => {
    if (!division.replay || division.replay.version !== 1)
      return division;
    const teams = Object.fromEntries([...new Set(division.replay.roster.map(
      rider => rider.team_id))].map(teamId =>
      [teamId, validateTeamKit(selected.get(teamId), teamId)]));
    return { ...division, replay: { ...division.replay,
      appearance: { version: RECORDED_APPEARANCE_VERSION, teams } } };
  }) };
}
