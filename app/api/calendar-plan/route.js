import {NextResponse} from "next/server";
import {protectedRoute} from "../../../lib/auth/server";
import plan from "../../../data/calendar/2027-plan.json";

async function handler(){
  // The workbook is a planning source, not a published race calendar.
  const isolatedPreview=process.env.VERCEL_ENV==="preview"||
    (process.env.NODE_ENV==="development"&&!process.env.VERCEL_ENV);
  if(!isolatedPreview)
    return NextResponse.json({ok:false,error:"Calendar plan preview is unavailable."},{status:404});
  return NextResponse.json({ok:true,plan},{headers:{"Cache-Control":"private, no-store"}});
}

export const GET=protectedRoute(handler);
