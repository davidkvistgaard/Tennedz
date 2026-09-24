// Translate known database messages at the application boundary; no database migration required.
const messages = {
  "Holdtilknytningen er ikke entydig.": "Team ownership is ambiguous. Contact the administrator.",
  "Løbet findes ikke.": "Race not found.",
  "Kun endagsløb er åbnet.": "Only one-day races are currently available.",
  "Tilmeldingsfristen er passeret, eller løbet er lukket.": "The entry deadline has passed or the race is closed.",
  "Vælg otte forskellige ryttere og en kaptajn blandt dem.": "Select eight different riders and choose one as captain.",
  "Spilledato mangler.": "The game date is unavailable.",
  "Rytterne skal tilhøre dit hold, passe til løbets køn og være skadesfri.": "Riders must belong to your team, match the race category, and be injury-free.",
  "Ugyldigt startgebyr.": "Invalid entry fee.",
  "Det tidligere startgebyr skal afklares af administratoren.": "The previous entry fee needs to be checked by the administrator.",
  "Dit hold har ikke nok coins til startgebyret.": "Your team does not have enough coins for the entry fee.",
  "Løbet kan ikke afvikles som et nyt endagsløb.": "This race cannot be run as a new one-day race.",
  "Deadline er ikke nået.": "The deadline has not passed yet.",
  "Eksisterende løbsdata kræver manuel afklaring; intet overskrives.": "Existing race data needs review; nothing will be overwritten.",
  "Løbet mangler en ruteprofil.": "The race is missing a route profile.",
  "Der skal være mindst to tilmeldte hold.": "At least two teams must enter the race.",
  "Dette løb overstiger den afprøvede grænse på 400 hold.": "This race exceeds the tested limit of 400 teams.",
  "Løbsgrundlaget ændrede sig. Prøv igen.": "The race inputs changed. Please try again.",
  "Resultatet mangler divisioner.": "The result is missing divisions.",
  "Ufuldstændigt divisionsresultat.": "Incomplete division result.",
  "Ugyldigt holdresultat.": "Invalid team result.",
  "Ugyldigt rytterresultat.": "Invalid rider result.",
  "Ugyldig rytteropdatering.": "Invalid rider update.",
  "Der mangler hold i resultatet.": "Teams are missing from the result.",
  "Der mangler ryttere i resultatet.": "Riders are missing from the result.",
  "Vælg mænd eller kvinder.": "Choose men or women.",
  "Denne oprettelse er allerede brugt med andre oplysninger.": "This creation request was already used with different details.",
  "Oprettelsen mangler oplysninger.": "The creation request is missing details.",
  "Ugyldig rute, kategori eller deadline.": "Invalid route, category, or deadline."
};
export function raceErrorMessage(message) {
  return messages[message] || "The race request could not be completed. Please refresh and try again.";
}
