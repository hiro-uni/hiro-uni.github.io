const decorations = {
  overview: {
    sunlight: [
      [388, 319],
      [561, 295],
      [754, 301],
      [864, 347],
      [320, 408],
      [513, 383],
      [621, 423],
      [780, 456],
      [432, 487],
    ],
    boats: [
      [475, 306],
      [307, 380],
      [618, 437],
      [808, 330],
      [412, 476],
    ],
    rafts: [
      [340, 342],
      [359, 350],
      [640, 371],
      [659, 378],
      [447, 444],
      [466, 453],
      [485, 462],
    ],
    gulls: [
      [342, 309],
      [425, 398],
      [469, 414],
      [767, 269],
      [823, 297],
    ],
  },
  local: {
    sunlight: [
      [701, 507],
      [673, 535],
      [717, 563],
      [501, 613],
      [633, 598],
    ],
    boats: [
      [690, 523],
      [718, 548],
      [576, 610],
    ],
    rafts: [
      [668, 545],
      [682, 557],
      [696, 569],
    ],
    gulls: [
      [632, 504],
      [694, 488],
      [547, 553],
    ],
  },
};

function ferryPosition(route, time) {
  // One second at each pier and eight seconds for each crossing.
  const cycle = time % 18;
  const outbound = Math.max(0, Math.min(1, (cycle - 1) / 8));
  const inbound = Math.max(0, Math.min(1, (cycle - 10) / 8));
  // Keep the hull in the water just off the pier at each end.
  const position = 0.3 + (outbound - inbound) * 1.48;
  const leg = Math.floor(position);
  const [startX, startY] = route[leg];
  const [endX, endY] = route[leg + 1];
  const progress = position - leg;
  return [
    startX + (endX - startX) * progress,
    startY + (endY - startY) * progress,
  ];
}

function createSeaLayer(canvas, area) {
  const { geo, decodeDem, sprites } = window.GGJAccessMap;
  const { width, height, gridW, gridH } = geo;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const dem = decodeDem(geo[area].demRle, gridW * gridH);
  const onWater = (x, y) =>
    dem[
      Math.floor((y * gridH) / height) * gridW + Math.floor((x * gridW) / width)
    ] === 0;

  const { boats, rafts, gulls, sunlight } = decorations[area];
  const ferryRoute =
    area === "overview" ? geo.overview.routes.ferryMiyajima : null;
  const waves = [];
  for (let y = 18; y < height - 12; y += 37) {
    for (let x = 24 + (y % 23); x < width - 20; x += 89) {
      if (onWater(x - 13, y - 8) && onWater(x, y) && onWater(x + 13, y + 8)) {
        waves.push([x, y, ((x * 11 + y * 7) % 37) / 37]);
      }
    }
  }

  const glints = sunlight.flatMap(([x, y], index) =>
    [
      [x - 14, y - 7, 6],
      [x, y, 12],
      [x + 13, y + 5, 5],
      [x - 7, y + 9, 7],
    ]
      .filter(
        ([left, top, length]) =>
          onWater(left, top) && onWater(left + length, top),
      )
      .map(([left, top, length], fleck) => [
        left,
        top,
        length,
        index * 1.2 + fleck * 0.95,
      ]),
  );

  function drawSprite(name, x, y, scale) {
    const sprite = sprites.getSprite(name);
    ctx.drawImage(
      sprite,
      Math.round(x - (sprite.width * scale) / 2),
      Math.round(y - sprite.height * scale),
      Math.round(sprite.width * scale),
      Math.round(sprite.height * scale),
    );
  }

  return (time) => {
    ctx.clearRect(0, 0, width, height);

    for (const [x, y, offset] of waves) {
      const phase = (time * 0.55 + offset) % 1;
      if (phase > 0.7) continue;
      const left = x + Math.floor(phase * 5);
      ctx.fillStyle = "#126f88a0";
      ctx.fillRect(left - 4, y + 2, 12, 2);
      ctx.fillStyle = phase < 0.36 ? "#a0e5e4bb" : "#62c6d09c";
      ctx.fillRect(left, y - 2, 6, 2);
      ctx.fillRect(left - 3, y, 3, 2);
      ctx.fillRect(left + 6, y, 4, 2);
    }

    for (const [x, y, length, offset] of glints) {
      const shimmer = (1 + Math.sin(time * 2.1 + offset)) / 2;
      ctx.fillStyle = shimmer > 0.55 ? "#c6f8ffdf" : "#87deef91";
      ctx.fillRect(x, y, Math.round(length * (0.55 + shimmer * 0.45)), 2);
    }

    rafts.forEach(([x, y]) => drawSprite("oysterRaft", x, y, 1.35));
    boats.forEach(([x, y], index) => {
      const phase = time * 1.6 + index * 1.4;
      drawSprite(
        index % 2 === 0 ? "sailboatLarge" : "sailboatSmall",
        x + Math.sin(phase / 2) * 4,
        y + Math.cos(phase) * 2,
        1.9,
      );
    });
    if (ferryRoute) {
      const [x, y] = ferryPosition(ferryRoute, time);
      drawSprite("miyajimaFerry", x, y, 1.7);
    }
    gulls.forEach(([x, y], index) => {
      const phase = time + index * 0.9;
      drawSprite(
        Math.sin(phase * 9) > 0 ? "gullLift" : "gullGlide",
        x + Math.sin(phase * 0.75) * 19,
        y + Math.cos(phase * 1.35) * 6,
        1.4,
      );
    });
  };
}

export function animateSea(map, canvases, reducedMotion) {
  const drawOverview = createSeaLayer(canvases.overview, "overview");
  const drawLocal = createSeaLayer(canvases.local, "local");
  let visible = false;
  let timer;

  function draw(time) {
    drawOverview(time);
    drawLocal(time);
  }

  function syncPlayback() {
    window.clearInterval(timer);
    if (reducedMotion.matches) {
      draw(0);
    } else if (visible && !document.hidden) {
      timer = window.setInterval(() => draw(performance.now() / 1000), 80);
    }
  }

  draw(0);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncPlayback();
  }).observe(map);
  reducedMotion.addEventListener("change", syncPlayback);
  document.addEventListener("visibilitychange", syncPlayback);
}
