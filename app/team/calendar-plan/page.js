import TeamShell from "../../components/TeamShell";
import PlanCalendar from "./PlanCalendar";
import outline from "../../../data/calendar/2027-outline.json";
import "./plan.css";

export default function CalendarPlanPage(){
  return <TeamShell title="2027 calendar plan"><div className="calendar-plan-page">
    <PlanCalendar outline={outline}/>
  </div></TeamShell>;
}
