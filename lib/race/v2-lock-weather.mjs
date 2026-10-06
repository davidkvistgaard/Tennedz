import {generateLockedWeather} from '../weather/weatherModel.js';

// Derive the single weather object to pass into the private v2 lock RPC.
// Once the RPC stores it, playback and results use that stored copy only.
export function weatherForV2TacticsLock(snapshot){
  const {event,game_date:gameDate}=snapshot??{};
  if(event?.kind!=='one_day'||typeof event.id!=='string'||
    !/^\d{4}-\d{2}-\d{2}$/.test(gameDate??'')||
    !Number.isFinite(Date.parse(event.deadline)))
    throw new Error('The v2 tactics lock needs a scheduled race and game date.');
  const weather=event.weather_locked??generateLockedWeather({
    event_id:event.id,country_code:event.country_code,
    game_date_iso:gameDate,deadline_iso:event.deadline,
  });
  if(!weather||typeof weather!=='object'||Array.isArray(weather)||
    !Number.isFinite(weather.temp_c)||weather.temp_c< -50||weather.temp_c>60||
    !Number.isFinite(weather.wind_kph)||weather.wind_kph<0||weather.wind_kph>200||
    !Number.isFinite(weather.precipitation_mm)||
    weather.precipitation_mm<0||weather.precipitation_mm>500||
    typeof weather.source!=='string'||!weather.source)
    throw new Error('The v2 tactics lock needs valid fixed weather.');
  return structuredClone(weather);
}
