// Fixed fictional coverage for the integrated offline race-to-line path.
// Counts describe these sources only; they are not sporting balance targets.
import assert from 'node:assert/strict';
import {runV91IntegratedTestDrive} from './engine-v2-test-drive.mjs';

const routes=[
  {distanceKm:40,fatigue:0},
  {distanceKm:120,fatigue:15},
  {distanceKm:260,fatigue:30}];
const pointContext={tier:3,divisionIndex:1,divisionCount:1};
const profileHeightsM=[100,300,150,400,180,100];
const modes={
  chase:{attack:'none',chase:'all',defaultRivalPlan:'chase',
    managerTactics:[{effort:'conserve',attack:'none',chase:'ignore'},
      {effort:'hard',attack:'none',chase:'all'}]},
  attack:{attack:'repeated',chase:'ignore',defaultRivalPlan:'attack'},
  mixed:{attack:'selective',chase:'selective',defaultRivalPlan:'mixed'},
  named:{attack:'none',chase:'all',defaultRivalPlan:'chase'}};
const rows=[];
for(const route of routes)for(const terrain of ['custom','exposed'])
  for(const gender of ['M','F'])for(const teamCount of [4,20])
    for(const [mode,tactics] of Object.entries(modes)){
      const settings={...route,terrain,profileHeightsM,gender,teamCount,
        seed:'test-drive-acceptance-1',...tactics};
      const output=runV91IntegratedTestDrive({settings,pointContext,
        ...(mode==='named'?{attack:{teamId:'you',riderId:'you-4'}}:{})});
      const status=output.roadStatus??output.status;
      const line=output.finale?.lineTimes??null;
      assert.equal(output.integrationVersion,'v91-integrated-test-drive-1');
      assert.equal(output.pointsStatus,'withheld');
      assert.equal(output.canCommitAwards,false);
      assert.equal(output.input.terrain,terrain);
      assert.equal(output.input.teamCount,teamCount);
      assert.equal(output.managerDecisions.length,teamCount);
      assert.ok(Array.isArray(output.lastKmSource.roadGroups));
      if(mode==='chase'){
        const decisions=new Map(output.managerDecisions.map(row=>
          [row.teamId,row.baseline]));
        assert.equal(decisions.get('rival-1').effort,'conserve');
        assert.equal(decisions.get('rival-1').chase,'ignore');
        assert.equal(decisions.get('rival-2').effort,'hard');
        assert.equal(decisions.get('rival-2').chase,'all');
      }
      if(terrain==='custom')
        assert.deepEqual(output.input.profileHeightsM,profileHeightsM);
      if(line){
        assert.equal(line.length,teamCount*8);
        assert.equal(new Set(line.map(row=>row.riderId)).size,line.length);
        assert.ok(line.every(row=>
          Number.isFinite(row.elapsedSecondsFromLastKmStart)&&
          Number.isFinite(row.energyAtLine)&&row.energyAtLine>=0));
      }else{
        assert.equal(status,'recorded_depleted_bands');
        assert.ok(output.finale.totalUnmetEnergyDemand>0);
      }
      const preview=output.provisionalPointPreview;
      assert.ok(preview);
      if(preview.riders){
        assert.ok(line);
        assert.equal(preview.riders.length,line.length);
        assert.deepEqual(preview.awardRows,[]);
        assert.equal(preview.canCommitAwards,false);
        const crossings=new Map(line.map(row=>[row.riderId,row]));
        for(const row of preview.riders){
          const crossing=crossings.get(row.riderId);
          assert.ok(crossing);
          assert.equal(row.elapsedSecondsFromLastKmStart,
            crossing.elapsedSecondsFromLastKmStart);
          assert.equal(row.energyAtLine,crossing.energyAtLine);
        }
      }else{
        assert.equal(preview.status,'unavailable');
        assert.ok(preview.reason);
      }
      rows.push({distanceKm:route.distanceKm,terrain,gender,teamCount,
        mode,status,individualLine:line!==null,
        pointPreview:preview.status??'read_only'});
    }

const paired={distanceKm:40,terrain:'custom',teamCount:4,gender:'F',
  fatigue:0,seed:'custom-pair-1',attack:'none',chase:'all',
  defaultRivalPlan:'chase',managerTactics:[
    {effort:'conserve',attack:'none',chase:'ignore'}]};
const flat=runV91IntegratedTestDrive({settings:{...paired,
  profileHeightsM:[100,100,100,100,100,100]}},{full:true});
const hills=runV91IntegratedTestDrive({settings:{...paired,
  profileHeightsM:[100,500,100,500,100,100]}},{full:true});
assert.deepEqual(flat.recording.recording.committedInputs.teams.map(team=>
  team.riders),hills.recording.recording.committedInputs.teams.map(team=>
  team.riders));
const ownEnergy=run=>run.recording.recording.frames.at(-2).teamEnergy
  .find(row=>row.teamId==='you').mean;
const ownCrossing=run=>run.summary.finale.lineTimes.find(row=>
  row.riderId==='you-7').elapsedSecondsFromLastKmStart;
assert.notEqual(ownEnergy(flat),ownEnergy(hills));
assert.notEqual(ownCrossing(flat),ownCrossing(hills));

const counts=Object.fromEntries([...new Set(rows.map(row=>row.status))]
  .sort().map(status=>[status,rows.filter(row=>row.status===status).length]));
console.log(JSON.stringify({version:'v91-integrated-terrain-audit-1',
  seed:'test-drive-acceptance-1',scenarios:rows.length,counts,
  pairedCustomRoute:{seed:paired.seed,sameRoster:true,
    flatOwnSourceEnergy:ownEnergy(flat),
    hillyOwnSourceEnergy:ownEnergy(hills),
    flatOwnCrossingSeconds:ownCrossing(flat),
    hillyOwnCrossingSeconds:ownCrossing(hills)},rows},null,2));
