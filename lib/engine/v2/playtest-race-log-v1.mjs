// Copy only committed inputs and recorded commentary. Keep the full input
// object so a pasted log can reconstruct a race after the UI changes.
export function formatMotorLabRaceLog(race,commentary,requestedChoices=null){
  const settings=race.settings;
  const nominations=(race.managerDecisions??[]).map(row=>({
    teamId:row.teamId,finisherId:row.finisherId,
    leadOutRiderId:row.leadOutRiderId??null}));
  const finishNote=race.lineTimes?.length?
    `${race.lineTimes.length} conditional rider crossings are recorded.`:
    'No supported individual line crossing is available.';
  const opening=`${settings.effort} effort · ${settings.attack} attack · `+
    `${settings.chase} chase`;
  return [
    `Pelotonia Motor Lab race log — ${settings.distanceKm} km `+
      `${settings.terrain} · seed ${settings.seed}`,
    '',
    'Race setup',
    `Distance: ${settings.distanceKm} km`,
    `Route: ${settings.terrain}`,
    `Field: ${settings.teamCount} teams · ${settings.gender==='F'?'women':'men'}`,
    `Starting fatigue: ${settings.fatigue}`,
    `Seed: ${settings.seed}`,
    `Motor: ${race.version} · tuning ${race.tuningVersion}`,
    `Your opening orders: ${opening}`,
    `Rival option selected: ${requestedChoices?.settings?.defaultRivalPlan??
      'not available'}`,
    `Rival plan committed after any draw: ${settings.defaultRivalPlan}`,
    '',
    'Selected options at run time (JSON)',
    JSON.stringify(requestedChoices,null,2),
    '',
    'Full committed engine settings (JSON)',
    JSON.stringify(settings,null,2),
    '',
    'Effective orders for every team (JSON)',
    JSON.stringify(race.managerOrders??[],null,2),
    '',
    'Finisher nominations (JSON)',
    JSON.stringify(nominations,null,2),
    '',
    'Recorded race',
    ...commentary.map(moment=>`Km ${moment.km}: ${moment.text}`),
    '',
    `Finish · ${settings.distanceKm} km: The final kilometre has a `+
      `separate paid-road recording. ${finishNote} `+
      'Official results and awards are withheld.',
  ].join('\n');
}
