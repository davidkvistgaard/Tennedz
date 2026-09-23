import { NextResponse } from "next/server";
import { protectedRoute } from "../../../lib/auth/server";
import { AuthError } from "../../../lib/auth/policy.mjs";
export const GET=protectedRoute(async(req,ctx,auth)=>{
  const [teams,riders]=await Promise.all([
    auth.db.from("teams").select("id,name,rating").order("rating",{ascending:false}).order("id").limit(50),
    auth.db.from("riders").select("id,name,rating").order("rating",{ascending:false}).order("id").limit(50),
  ]);
  if(teams.error || riders.error) throw new AuthError("RANKING_UNAVAILABLE","Ranglisten kunne ikke hentes.",503);
  return NextResponse.json({ok:true,teams:teams.data,riders:riders.data});
});
