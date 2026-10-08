import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { raceErrorMessage } from '../../lib/race/messages.mjs';
import { commentaryText } from '../../lib/race/commentary.mjs';

test('every existing database race message has an English application translation', () => {
  const folder = new URL('../../supabase/migrations/', import.meta.url);
  const messages = new Set(readdirSync(folder).flatMap(name => [...readFileSync(new URL(name, folder), 'utf8').matchAll(/message\s*=\s*'([^']*)'/g)].map(m => m[1])));
  assert.ok(messages.size > 20);
  for (const message of messages) {
    const translated = raceErrorMessage(message);
    assert.notEqual(translated, message);
    assert.doesNotMatch(translated, /could not be completed/);
    assert.doesNotMatch(translated, /[æøå]/i);
  }
  assert.equal(raceErrorMessage('internal database details'), 'The race request could not be completed. Please refresh and try again.');
});

test('recorded commentary displays English without modifying rider names or stored text', () => {
  const stored = { text: 'Mål! Søren Møller (Nordlys) tager sejren.' };
  assert.equal(commentaryText(stored.text), 'Finish! Søren Møller (Nordlys) takes the win.');
  assert.equal(stored.text, 'Mål! Søren Møller (Nordlys) tager sejren.');
  assert.equal(commentaryText('Søren Møller går i udbrud!'), 'Søren Møller attack and break away!');
  assert.equal(commentaryText('3 km igen — finalen afgøres på brostenene.'), '3 km to go — the finale will be decided on the cobbles.');
  assert.equal(commentaryText('4 ryttere mister kontakten i vinden. Feltet er delt.'), '4 riders lose contact in the wind. The peloton is split.');
  assert.equal(commentaryText('Vejr: rain · 8°C · vind 24 km/t (W) · nedbør 2 mm.'), 'Weather: rain · 8°C · wind 24 km/h (W) · precipitation 2 mm.');
  assert.equal(commentaryText('A quiet day — everyone seems to be saving energy for the finale.'), 'A quiet day — everyone seems to be saving energy for the finale.');
  assert.equal(commentaryText('A custom historic report'), 'A custom historic report');
});
