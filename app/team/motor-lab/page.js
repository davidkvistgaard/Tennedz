import LegacyMotorLab from './LegacyMotorLab';
import Playtest from '../v91-playtest/Playtest';
import '../v91-playtest/playtest.css';

export const dynamic='force-dynamic';

export default function MotorLabPage(){
  const enabled=process.env.PELOTONIA_V91_PLAYTEST_ENABLED==='true'&&
    process.env.PELOTONIA_V93_COASTED_PLAYTEST_ENABLED==='true';
  return enabled?<Playtest guided/>:<LegacyMotorLab/>;
}
