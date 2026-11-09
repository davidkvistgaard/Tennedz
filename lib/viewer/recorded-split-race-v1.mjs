import men from '../../data/viewer/physical-120km-men-v1.json';
import women from '../../data/viewer/physical-120km-women-v1.json';

// Immutable Motor Lab V94 export from commit 5352f9eb. These are
// experimental test races and never stand in for an official game run.
export function recordedSplitRaceV1(category){
  if(category==='men')return men;
  if(category==='women')return women;
  throw new Error('Unknown recorded field category.');
}
