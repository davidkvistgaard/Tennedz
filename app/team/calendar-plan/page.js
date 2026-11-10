import TeamShell from "../../components/TeamShell";
import PlanCalendar from "./PlanCalendar";
import calendar from "../../../data/calendar/2027-calendar.json";
import "./plan.css";

export default function CalendarPlanPage(){
  return <TeamShell title="2027 calendar plan"><div className="calendar-plan-page">
    <PlanCalendar races={calendar.races}/>
  </div></TeamShell>;
}
