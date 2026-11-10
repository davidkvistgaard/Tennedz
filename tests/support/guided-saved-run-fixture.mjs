import {simulateStage} from '../../lib/engine/simulateStage.js';
import {withRecordedAppearanceV1} from
  '../../lib/viewer/recorded-appearance-v1.mjs';

export const guidedSavedRunIds = {
  men: '11111111-1111-4111-8111-111111111161',
  women: '11111111-1111-4111-8111-111111111162',
  womenFinished: '11111111-1111-4111-8111-111111111163',
};

export function createGuidedSavedRunFixture(category, createdAt = new Date()) {
  const gender = category === 'women' ? 'F' : 'M';
  const stage = {name: `Saved ${category} fixture race`, distance_km: 48,
    tags: ['HILLS'], profile_points: [[0, 20], [24, 180], [48, 30]]};
  const teams = Array.from({length: 4}, (_, team) => ({
    id: `team-${team === 0 ? 'alice' : `saved-${team}`}`,
    name: `Saved Team ${team}`,
    riders: Array.from({length: 8}, (_, index) => ({
      id: `${category}-saved-${team}-${index}`,
      name: `${category} Rider ${team}-${index}`, gender,
      sprint: 45 + index, flat: 50, hills: 50, mountain: 50,
      cobbles: 50, endurance: 55, strength: 50, wind: 50,
      form: 60, fatigue: 0,
    })),
  }));
  const race = simulateStage({stage, teamsWithRiders: teams,
    seed: `guided-saved-${category}`});
  const replay = withRecordedAppearanceV1({divisions: [{replay: race.replay}]})
    .divisions[0].replay;
  return {event_id: guidedSavedRunIds[category], division_index: 1,
    engine_version: 1, stage_snapshot: stage, feed: race.feed, replay,
    created_at: createdAt.toISOString()};
}
