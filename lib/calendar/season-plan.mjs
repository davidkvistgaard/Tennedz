export const PELOTONIA_SEASONS=[
  {number:1,label:"Pelotonia Year 1",months:"January – April",start:"2027-01-01",end:"2027-04-30"},
  {number:2,label:"Pelotonia Year 2",months:"May – August",start:"2027-05-01",end:"2027-08-31"},
  {number:3,label:"Pelotonia Year 3",months:"September – December",start:"2027-09-01",end:"2027-12-31"},
];

export function seasonForDate(date){
  return PELOTONIA_SEASONS.find(season=>date>=season.start&&date<=season.end)?.number??null;
}

export function openOneDaySlots(races,season){
  const filled=new Set(races.filter(race=>race.format==="one_day")
    .map(race=>`${race.planned_date}:${race.gender}`));
  let open=0;
  for(let time=Date.parse(`${season.start}T12:00:00Z`);
    time<=Date.parse(`${season.end}T12:00:00Z`);time+=86400000){
    const date=new Date(time),weekday=date.getUTCDay();
    if(weekday!==0&&weekday!==3)continue;
    for(const gender of ["M","F"])
      if(!filled.has(`${date.toISOString().slice(0,10)}:${gender}`))open++;
  }
  return open;
}
