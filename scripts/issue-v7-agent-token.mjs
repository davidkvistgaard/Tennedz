import {agentPhysicalEntryTokenV1} from
  '../lib/race/agent-physical-entry-v1.mjs';

const eventId=process.env.PELOTONIA_PHYSICAL_ENTRY_EVENT_ID;
const teamId=process.argv[2];
if(!eventId||!teamId||process.argv.length!==3){
  process.stderr.write('Supply the configured event and one team ID.\n');
  process.exitCode=1;
}else{
  process.stdout.write(`${agentPhysicalEntryTokenV1(
    process.env.PELOTONIA_AGENT_ENTRY_SIGNING_KEY,
    eventId,teamId)}\n`);
}
