import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: state } = await supabase
      .from("game_state")
      .select("*")
      .eq("id", 1)
      .single();

    const currentDate = new Date(state.game_date);
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);

    await supabase
      .from("game_state")
      .update({ game_date: newDate.toISOString().split("T")[0] })
      .eq("id", 1);

    const { data: riders } = await supabase
      .from("riders")
      .select("*");

    for (const r of riders) {
      let fatigue = Math.max(0, r.fatigue - 15);
      let form = r.form;

      if (r.injury_until && new Date(r.injury_until) > newDate) {
        form = Math.max(0, form - 10);
      } else {
        form = Math.max(0, form - 5);
      }

      const age =
        newDate.getFullYear() -
        new Date(r.birth_date).getFullYear();

      const declineFactor =
        age > 30
          ? Math.pow(age - 30, 1.4) * 0.2
          : 0;

      await supabase
        .from("riders")
        .update({
          fatigue,
          form,
          sprint: Math.max(0, r.sprint - declineFactor),
          flat: Math.max(0, r.flat - declineFactor),
          hills: Math.max(0, r.hills - declineFactor),
          mountain: Math.max(0, r.mountain - declineFactor),
          cobbles: Math.max(0, r.cobbles - declineFactor),
          timetrial: Math.max(0, r.timetrial - declineFactor)
        })
        .eq("id", r.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
