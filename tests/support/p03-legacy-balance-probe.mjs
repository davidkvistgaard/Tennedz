// Read-only, deterministic baseline for the simulator currently used by P03.
// Run: node tests/support/p03-legacy-balance-probe.mjs
import { buildRace } from '../../lib/race/cycle.mjs';

const skills = ['sprint', 'flat', 'hills', 'mountain', 'cobbles',
  'timetrial', 'endurance', 'strength', 'wind'];

function snapshot(level) {
  return {
    event: {
      id: 'balance-probe', seed: 'fixed', kind: 'one_day', gender: 'M',
      deadline: '2026-01-01', country_code: 'FR',
      weather_locked: { temp_c: 18, wind_kph: 5, precipitation_mm: 0,
        condition: 'clear', wind_dir: 'W' },
    },
    game_date: '2026-01-01',
    stage: { distance_km: 140, tags: ['FLAT'] },
    teams: ['a', 'b'].map(id => ({
      id, name: id,
      riders: Array.from({ length: 8 }, (_, index) => ({
        id: `${id}${index}`, name: `${id}${index}`, gender: 'M',
        ...Object.fromEntries(skills.map(skill => [skill, level])),
        form: 70, fatigue: 10,
      })),
      entry: {
        selected_riders: Array.from({ length: 8 }, (_, index) => `${id}${index}`),
        captain_id: `${id}0`,
      },
    })),
  };
}

const readings = [30, 40, 50, 60, 80, 100].map(skill => {
  const results = buildRace(snapshot(skill)).divisions[0].results;
  return {
    skill,
    winnerTimeSeconds: +results[0].time_sec.toFixed(3),
    fieldSpreadSeconds: +(results.at(-1).time_sec - results[0].time_sec).toFixed(3),
  };
});

console.log(JSON.stringify({
  simulator: 'P03 legacy one-day',
  route: '140 km flat',
  seed: 'fixed',
  readings,
}, null, 2));
