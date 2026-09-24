// Original fictional routes. These are not licensed real-world race courses.
export const routeTemplates = [
  {
    id: "coast",
    name: "Kystvejen",
    country_code: "DK",
    distance_km: 140,
    tags: ["FLAT"],
    profile_points: [
      [0, 15],
      [20, 30],
      [40, 10],
      [60, 45],
      [80, 20],
      [100, 35],
      [120, 10],
      [140, 15],
    ],
    keypoints: [
      { km: 55, kind: "EXPOSED", label: "Åben kyst" },
      { km: 135, kind: "FINALE", label: "Spurtfinalen" },
    ],
  },
  {
    id: "hills",
    name: "De grønne bakker",
    country_code: "BE",
    distance_km: 165,
    tags: ["HILLS"],
    profile_points: [
      [0, 110],
      [25, 140],
      [35, 310],
      [45, 120],
      [60, 350],
      [70, 100],
      [85, 380],
      [100, 130],
      [115, 320],
      [130, 90],
      [142, 340],
      [153, 100],
      [160, 285],
      [165, 240],
    ],
    keypoints: [
      { km: 85, kind: "CLIMB", label: "Skovbakken" },
      { km: 142, kind: "CLIMB", label: "Den lange bakke" },
      { km: 160, kind: "CLIMB", label: "Sidste stigning" },
    ],
  },
  {
    id: "mountains",
    name: "Bjergenes dag",
    country_code: "IT",
    distance_km: 155,
    tags: ["MOUNTAIN"],
    profile_points: [
      [0, 320],
      [20, 400],
      [35, 1150],
      [42, 1540],
      [58, 550],
      [75, 620],
      [93, 1780],
      [105, 790],
      [125, 650],
      [135, 1150],
      [145, 1750],
      [155, 2150],
    ],
    keypoints: [
      { km: 42, kind: "CLIMB", label: "Første pas" },
      { km: 93, kind: "CLIMB", label: "Det høje pas" },
      { km: 155, kind: "FINISH", label: "Mål på toppen" },
    ],
  },
  {
    id: "cobbles",
    name: "Brostensrunden",
    country_code: "FR",
    distance_km: 180,
    tags: ["COBBLES"],
    profile_points: [
      [0, 45],
      [30, 70],
      [50, 35],
      [70, 95],
      [90, 55],
      [110, 85],
      [135, 30],
      [155, 60],
      [170, 40],
      [180, 45],
    ],
    keypoints: [
      { km: 70, kind: "COBBLES", label: "Den gamle chaussé" },
      { km: 135, kind: "COBBLES", label: "Markvejen" },
      { km: 170, kind: "COBBLES", label: "Sidste brosten" },
    ],
  },
];

export function calendarRequest(input, now = Date.now()) {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  if (name.length < 3 || name.length > 90 || /[\u0000-\u001f\u007f]/.test(name))
    throw new Error("Løbsnavnet skal være mellem 3 og 90 tegn.");
  const template = routeTemplates.find((t) => t.id === input.template_id);
  if (!template) throw new Error("Vælg en af de tilgængelige ruter.");
  if (!["M", "F", "BOTH"].includes(input.gender))
    throw new Error("Vælg mænd, kvinder eller begge som separate løb.");
  const deadline = Date.parse(input.deadline);
  if (
    !Number.isFinite(deadline) ||
    deadline < now + 15 * 60000 ||
    deadline > now + 90 * 86400000
  )
    throw new Error(
      "Deadline skal være mindst 15 minutter og højst 90 dage fremme.",
    );
  return {
    name,
    template_id: template.id,
    gender: input.gender,
    deadline: new Date(deadline).toISOString(),
    stage: structuredClone(template),
  };
}
