// app/api/admin/create-login/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "../../../../lib/serverAuth";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const secret = req.headers.get("x-admin-secret");
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const teamName = String(body?.team_name || "").trim();
    const teamId = String(body?.team_id || "").trim();
    const loginName = String(body?.login_name || "").trim();
    const password = String(body?.password || "");

    if ((!teamName && !teamId) || !loginName || !password) {
      return NextResponse.json(
        { ok: false, error: "team_name/team_id, login_name og password er påkrævet." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let team = null;

    if (teamId) {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("id", teamId)
        .single();
      if (error) throw error;
      team = data;
    } else {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .ilike("name", teamName)
        .single();
      if (error) throw error;
      team = data;
    }

    if (!team) {
      return NextResponse.json({ ok: false, error: "Hold ikke fundet." }, { status: 404 });
    }

    const passwordHash = hashPassword(password);

    const { data: existing } = await supabase
      .from("login_accounts")
      .select("id")
      .eq("team_id", team.id)
      .maybeSingle();

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("login_accounts")
        .update({
          login_name: loginName,
          password_hash: passwordHash,
        })
        .eq("id", existing.id);

      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase
        .from("login_accounts")
        .insert({
          team_id: team.id,
          login_name: loginName,
          password_hash: passwordHash,
        });

      if (insErr) throw insErr;
    }

    return NextResponse.json({
      ok: true,
      team,
      login_name: loginName,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
