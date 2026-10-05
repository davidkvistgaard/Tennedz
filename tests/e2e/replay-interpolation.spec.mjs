import {test,expect} from "@playwright/test";

test("recorded viewer shows a smooth intermediate gap without early commentary",async({page})=>{
  const eventId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("alice");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  const route={name:"Flat 20",distance:20,points:[[0,0],[20,0]],
    keypoints:[{km:20,kind:"FINISH",label:"Finish"}],specialty:"flat",ascent:0};
  await page.route("**/api/event-run?*",request=>request.fulfill({json:{
    ok:true,team_id:"mine",run:{event_id:eventId,division_index:1,
      stage_snapshot:{name:"Flat 20",distance_km:20,tags:["FLAT"],
        profile_points:[[0,0],[20,0]]},
      replay:{version:1,route,weather:{temp_c:18,wind_kph:4,precipitation_mm:0},
        roster:[{id:"a",name:"Alice Captain",team_id:"mine",captain:true},
          {id:"b",name:"Bob Rider",team_id:"rival",captain:false}],
        frames:[
          {km:0,elapsed_sec:0,terrain:"flat",groups:[
            {gap:0,riders:["a"]},{gap:10,riders:["b"]}]},
          {km:20,elapsed_sec:1000,terrain:"flat",groups:[
            {gap:0,riders:["a"]},{gap:30,riders:["b"]}]},
        ],
        events:[{id:"moment-0",km:10,kind:"attack",text:"Attack at kilometre 10",rider_ids:["a"]}],
        finish:[{rider_id:"a",position:1,time_sec:1000,team_id:"mine"},
          {rider_id:"b",position:2,time_sec:1030,team_id:"rival"}],
      },
    },
  }}));
  await page.goto(`/team/view/${eventId}`);
  await expect(page.getByRole("heading",{name:"Flat 20"})).toBeVisible();
  await expect(page.getByText("Attack at kilometre 10")).toHaveCount(0);
  await page.getByRole("button",{name:/Next moment/}).click();
  await expect(page.getByRole("img",{name:/2 race groups at kilometre 10/})).toBeVisible();
  await expect(page.getByText("Attack at kilometre 10")).toBeVisible();
  await expect(page.getByText("+20 s").first()).toBeVisible();
});
