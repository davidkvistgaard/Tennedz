import { notFound } from "next/navigation";
import Lab from "./Lab";
import "./lab.css";
export const dynamic = "force-dynamic";
export default function RaceLab() {
  if (process.env.RACE_LAB_ENABLED !== "true") notFound();
  return <Lab />;
}
