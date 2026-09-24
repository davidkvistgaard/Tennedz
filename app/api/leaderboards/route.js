import { NextResponse } from "next/server";
import { protectedRoute } from "../../../lib/auth/server";
import { AuthError } from "../../../lib/auth/policy.mjs";
export const GET=protectedRoute(async(req,ctx,auth)=>{
  const gender=new URL(req.url).searchParams.get("gender") || "M";
  if(!["M","F"].includes(gender)) throw new AuthError("INVALID_GENDER","Choose men or women.",400);
  const {data,error}=await auth.db.rpc("recovery_rankings",{p_gender:gender});
  if(error) throw new AuthError("RANKING_UNAVAILABLE","Could not load the rankings.",503);
  return NextResponse.json(data);
});
