const localOptions = [
  {
    mode: "rail",
    label: "JR + 広電＋徒歩",
    legs: "広電で楽々園電停へ 約4分 → 徒歩 約15分",
    minutes: 34,
  },
  {
    mode: "bus",
    label: "JR + 路線バス＋徒歩",
    legs: "路線バスで広島工大入口へ 約6分 → 徒歩 約3分",
    minutes: 9,
  },
];

function project(lat, lon, { bounds }, { width, height }) {
  const { lonMin, lonMax, latMin, latMax } = bounds;
  return [
    ((lon - lonMin) / (lonMax - lonMin)) * width,
    ((latMax - lat) / (latMax - latMin)) * height,
  ];
}

export function createRoutePlans(geo, busCenterPoint) {
  const { spots, local, overview } = geo;
  const { tramItsukaichi, busItsukaichi, walkRakuraku } = local.routes;
  const projectOverview = ([lat, lon]) => project(lat, lon, overview, geo);
  const localToOverview = ([x, y]) => {
    const { latMin, latMax, lonMin, lonMax } = local.bounds;
    return projectOverview([
      latMax - (y / geo.height) * (latMax - latMin),
      lonMin + (x / geo.width) * (lonMax - lonMin),
    ]);
  };

  // These overview lines follow the station and junction waypoints at map scale.
  const jrApproach = [
    spots.hiroshima.overview,
    ...[
      [34.4034, 132.4685],
      [34.4081, 132.4608], // 新白島
      [34.41, 132.456],
      [34.4096, 132.4505], // 横川
      [34.409, 132.444],
      [34.4042, 132.4343],
      [34.3978, 132.428], // 西広島
      [34.3925, 132.4215],
      [34.3846, 132.4071],
      [34.3782, 132.3998],
      [34.3757, 132.392], // 新井口
      [34.372, 132.3827],
    ].map(projectOverview),
    spots.jr.overview,
  ];
  const paperTown = projectOverview([34.3945, 132.4555]); // 紙屋町西
  const tramApproach = [
    paperTown,
    ...[
      [34.3954, 132.4495], // 原爆ドーム前
      [34.3974, 132.4433], // 十日市町
      [34.3935, 132.4412], // 土橋
      [34.3925, 132.4347], // 観音町
      [34.3944, 132.4307], // 福島町
      [34.3971, 132.428], // 広電西広島
      [34.3888, 132.4161], // 東高須
      [34.3815, 132.4039], // 古江
      [34.3743, 132.3912], // 商工センター入口
      [34.3698, 132.3794], // 修大協創中高前
    ].map(projectOverview),
    spots.hiroden_itsukaichi.overview,
  ];

  const busSegment = { mode: "bus", points: busItsukaichi, step: 0 };
  const tramSegment = { mode: "rail", points: tramItsukaichi, step: 0 };
  const walkToBusStop = {
    mode: "walk",
    points: walkRakuraku.slice(0, 4),
    step: 1,
  };
  const walkToCampus = {
    mode: "walk",
    points: walkRakuraku.slice(3, 6),
    step: 2,
  };
  const localSegments = [busSegment, tramSegment, walkToBusStop, walkToCampus];
  const [tramOption, busOption] = localOptions;
  const extendOnOverview = (startAt) =>
    localSegments.map((segment) => ({
      ...segment,
      points: segment.points.map(localToOverview),
      step: segment.step + startAt,
    }));

  return {
    local: {
      jr: { options: localOptions, segments: localSegments },
      rakuraku: {
        options: [tramOption],
        segments: [tramSegment, walkToBusStop, walkToCampus],
      },
      bus: {
        options: [busOption],
        segments: [busSegment, { ...walkToCampus, step: 1 }],
      },
    },
    overview: {
      hiroshima: {
        options: localOptions.map((option) => ({
          ...option,
          minutes: option.minutes + 15,
          legs: `JRで五日市駅へ 約15分 → ${option.legs}`,
        })),
        segments: [
          { mode: "rail", points: jrApproach, step: 0 },
          ...extendOnOverview(1),
        ],
      },
      busCenter: {
        options: [
          {
            mode: "rail",
            label: "広電＋徒歩",
            legs: "広電で楽々園へ 約40分 → 徒歩 約15分",
            minutes: 55,
          },
          {
            mode: "bus",
            label: "広電＋路線バス＋徒歩",
            legs: "広電で五日市へ 約36分 → バス 約6分 → 徒歩 約3分",
            minutes: 45,
          },
        ],
        segments: [
          { mode: "walk", points: [busCenterPoint, paperTown], step: 0 },
          { mode: "rail", points: tramApproach, step: 1 },
          ...extendOnOverview(2),
        ],
      },
    },
  };
}
