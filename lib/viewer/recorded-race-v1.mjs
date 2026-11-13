import men from '../../data/viewer/physical-40km-men-v1.json';
import women from '../../data/viewer/physical-40km-women-v1.json';

// Immutable export of a paid Motor Lab test race from source commit 21d1fbf8.
// A game run must supply its own authoritative viewer feed before it can use
// this renderer; the sample is never substituted for an official race.
export function recordedViewerRaceV1(category){
  if(category==='men')return men;
  if(category==='women')return women;
  throw new Error('Unknown recorded field category.');
}
