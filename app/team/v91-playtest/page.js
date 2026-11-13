import {notFound} from 'next/navigation';
import Playtest from './Playtest';
import './playtest.css';

export const dynamic='force-dynamic';
export default function V91PlaytestPage(){
  if(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true')notFound();
  return <Playtest/>;
}
