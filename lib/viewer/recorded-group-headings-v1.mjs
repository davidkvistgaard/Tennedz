import {labelRaceGroups, raceGroups} from '@pelotonia/race-viewer';

export const RECORDED_GROUP_HEADINGS_VERSION = 'recorded-group-headings-1';

// Recorded time gaps order the headings. Shared checkpoint kilometres do not
// establish a front-to-back order between groups.
export function recordedGroupHeadingsV1(positions, gaps, groupRoles) {
  const roleRank = {leaders: 0, chase: 1, peloton: 2, dropped: 3};
  const ordered = raceGroups(positions).sort((a, b) =>
    (gaps?.[a.id] ?? Infinity) - (gaps?.[b.id] ?? Infinity) ||
    (roleRank[groupRoles?.[a.id]] ?? 4) -
    (roleRank[groupRoles?.[b.id]] ?? 4) ||
    a.id.localeCompare(b.id));
  return labelRaceGroups(ordered, groupRoles);
}
