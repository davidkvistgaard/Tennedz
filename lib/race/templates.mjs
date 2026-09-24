// Original fictional routes. These are not licensed real-world race courses.
export const routeTemplates = [
  {
    id: "coast",
    name: "The Coast Road",
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
      { km: 55, kind: "EXPOSED", label: "Exposed coast" },
      { km: 135, kind: "FINALE", label: "Sprint finale" },
    ],
  },
  {
    id: "hills",
    name: "The Green Hills",
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
      { km: 85, kind: "CLIMB", label: "Forest hill" },
      { km: 142, kind: "CLIMB", label: "The long climb" },
      { km: 160, kind: "CLIMB", label: "Final climb" },
    ],
  },
  {
    id: "mountains",
    name: "A Day in the Mountains",
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
      { km: 42, kind: "CLIMB", label: "First mountain pass" },
      { km: 93, kind: "CLIMB", label: "The high pass" },
      { km: 155, kind: "FINISH", label: "Summit finish" },
    ],
  },
  {
    id: "cobbles",
    name: "The Cobbled Circuit",
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
      { km: 70, kind: "COBBLES", label: "The old road" },
      { km: 135, kind: "COBBLES", label: "Farm road" },
      { km: 170, kind: "COBBLES", label: "Final cobbles" },
    ],
  },
];

export function calendarRequest(input, now = Date.now()) {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  if (name.length < 3 || name.length > 90 || /[\u0000-\u001f\u007f]/.test(name))
    throw new Error("The race name must be between 3 and 90 characters.");
  const template = routeTemplates.find((t) => t.id === input.template_id);
  if (!template) throw new Error("Choose one of the available routes.");
  if (!["M", "F", "BOTH"].includes(input.gender))
    throw new Error("Choose men, women, or both as separate races.");
  const deadline = Date.parse(input.deadline);
  if (
    !Number.isFinite(deadline) ||
    deadline < now + 15 * 60000 ||
    deadline > now + 90 * 86400000
  )
    throw new Error(
      "The deadline must be between 15 minutes and 90 days from now.",
    );
  return {
    name,
    template_id: template.id,
    gender: input.gender,
    deadline: new Date(deadline).toISOString(),
    stage: structuredClone(template),
  };
}
