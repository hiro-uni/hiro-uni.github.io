/* Multi-pass Super Famicom (16-bit SNES) terrain, river, road, city, and landmark renderer */
(() => {
  const ns = (window.GGJAccessMap = window.GGJAccessMap || {});

  function hash2(x, y, seed = 0) {
    let h =
      ((x * 374761393) ^ (y * 668265263) ^ (seed * 7919) ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function bayer2(x, y) {
    return ((x & 1) * 2 + (y & 1) * 3) & 3; // 0..3
  }

  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Cohesive SNES 16-bit world-map colors
  const COL = {
    seaDeep: hexRgb("#158298"),
    seaMid: hexRgb("#1d9ab0"),
    seaShelf: hexRgb("#2fb2c2"),
    seaShallow: hexRgb("#5ccbd6"),
    seaFoam: hexRgb("#d6f7f2"),
    coastInk: hexRgb("#154354"),

    sandLight: hexRgb("#f2dfb2"),
    sandDark: hexRgb("#d9be83"),
    urbanBase: hexRgb("#d5dea0"),
    urbanDense: hexRgb("#e3ddc4"),
    urbanShade: hexRgb("#c4cf90"),

    green0: hexRgb("#95d855"), // sunlit lime crest
    green1: hexRgb("#6ebe41"), // bright hillside
    green2: hexRgb("#469a3d"), // mid lush green
    green3: hexRgb("#2a7537"), // forest shadow
    green4: hexRgb("#195130"), // deep ridge valley
    crease: hexRgb("#153d29"),

    cliffLight: hexRgb("#c8bc9d"),
    cliffMid: hexRgb("#92866d"),
    cliffDark: hexRgb("#5b5346"),
  };

  function setPx(data, w, x, y, rgb) {
    const idx = (y * w + x) * 4;
    data[idx] = rgb[0];
    data[idx + 1] = rgb[1];
    data[idx + 2] = rgb[2];
    data[idx + 3] = 255;
  }

  function drawPolylines(ctx, lines, width, color, dash) {
    if (!lines || !lines.length) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    for (const line of lines) {
      if (line.length < 2) continue;
      ctx.moveTo(line[0][0], line[0][1]);
      for (let i = 1; i < line.length; i++) {
        ctx.lineTo(line[i][0], line[i][1]);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function fillPolys(ctx, polys, fill, stroke, lineWidth = 1) {
    if (!polys || !polys.length) return;
    ctx.save();
    ctx.beginPath();
    for (const poly of polys) {
      if (poly.length < 3) continue;
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i][0], poly[i][1]);
      }
      ctx.closePath();
    }
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  function computeWaterDistance(dem, gw, gh, maxDist = 14) {
    const dist = new Uint8Array(gw * gh);
    const q = new Int32Array(gw * gh);
    let head = 0;
    let tail = 0;
    for (let i = 0; i < gw * gh; i++) {
      if (dem[i] > 0) {
        dist[i] = 0;
        q[tail++] = i;
      } else {
        dist[i] = 255;
      }
    }
    while (head < tail) {
      const idx = q[head++];
      const d = dist[idx];
      if (d >= maxDist) continue;
      const x = idx % gw;
      const y = (idx - x) / gw;
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x + 1 < gw ? idx + 1 : -1,
        y > 0 ? idx - gw : -1,
        y + 1 < gh ? idx + gw : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && dist[n] > d + 1) {
          dist[n] = d + 1;
          q[tail++] = n;
        }
      }
    }
    return dist;
  }

  function renderPixelTerrain(canvas, dem, gw, gh, mode) {
    // Render terrain at half resolution (480x320, 2px crisp pixel blocks) so
    // coastline outlines, hillshade, rocky cliffs, and dithering look authentically 16-bit!
    const tw = 480;
    const th = 320;
    const off = document.createElement("canvas");
    off.width = tw;
    off.height = th;
    const octx = off.getContext("2d");
    const img = octx.createImageData(tw, th);
    const data = img.data;

    const landDist = computeWaterDistance(dem, gw, gh, 16);

    function sampleDem(fx, fy) {
      const x = Math.max(0, Math.min(gw - 1, Math.round(fx)));
      const y = Math.max(0, Math.min(gh - 1, Math.round(fy)));
      return dem[y * gw + x];
    }

    function sampleLandDist(fx, fy) {
      const x = Math.max(0, Math.min(gw - 1, Math.round(fx)));
      const y = Math.max(0, Math.min(gh - 1, Math.round(fy)));
      return landDist[y * gw + x];
    }

    // Elevation hillshade using wider stencil so 240x160 grid gradients form bold SNES mountain ridges!
    function smoothElev(fx, fy) {
      const x0 = Math.max(0, Math.min(gw - 2, Math.floor(fx)));
      const y0 = Math.max(0, Math.min(gh - 2, Math.floor(fy)));
      const tx = fx - x0;
      const ty = fy - y0;
      const e00 = dem[y0 * gw + x0];
      const e10 = dem[y0 * gw + x0 + 1];
      const e01 = dem[(y0 + 1) * gw + x0];
      const e11 = dem[(y0 + 1) * gw + x0 + 1];
      if (!e00 || !e10 || !e01 || !e11) {
        return sampleDem(fx, fy);
      }
      return (
        (e00 * (1 - tx) + e10 * tx) * (1 - ty) +
        (e01 * (1 - tx) + e11 * tx) * ty
      );
    }

    for (let y = 0; y < th; y++) {
      const fy = ((y + 0.5) * gh) / th - 0.5;
      for (let x = 0; x < tw; x++) {
        const fx = ((x + 0.5) * gw) / tw - 0.5;
        const elev = sampleDem(fx, fy);
        const dither = bayer2(x, y);

        if (elev === 0) {
          // Sea & shallow bathymetry bands
          const d = sampleLandDist(fx, fy);
          const n = hash2(x, y, 7);
          const touchesLand =
            sampleDem(fx - 0.5, fy) > 0 ||
            sampleDem(fx + 0.5, fy) > 0 ||
            sampleDem(fx, fy - 0.5) > 0 ||
            sampleDem(fx, fy + 0.5) > 0;
          let rgb;
          if (touchesLand) {
            rgb = COL.coastInk;
          } else if (d <= 1 && n < 0.72) {
            rgb = COL.seaFoam;
          } else if (d <= 2 || (d === 3 && dither < 2)) {
            rgb = COL.seaShallow;
          } else if (d <= 5 || (d === 6 && dither < 2)) {
            rgb = COL.seaShelf;
          } else if (d <= 10 || (d === 11 && dither < 2)) {
            rgb = COL.seaMid;
          } else {
            rgb = COL.seaDeep;
          }
          setPx(data, tw, x, y, rgb);
          continue;
        }

        // Land: check coastline contact
        const nearSea =
          sampleDem(fx - 0.7, fy) === 0 ||
          sampleDem(fx + 0.7, fy) === 0 ||
          sampleDem(fx, fy - 0.7) === 0 ||
          sampleDem(fx, fy + 0.7) === 0;
        const nearSea2 =
          sampleDem(fx - 1.6, fy) === 0 ||
          sampleDem(fx + 1.6, fy) === 0 ||
          sampleDem(fx, fy - 1.6) === 0 ||
          sampleDem(fx, fy + 1.6) === 0;

        // Elevation gradient for NW sunlit SNES hillshade (stronger 2-cell stencil)
        const stepG = mode === "overview" ? 1.4 : 1.8;
        const eL = smoothElev(fx - stepG, fy);
        const eR = smoothElev(fx + stepG, fy);
        const eU = smoothElev(fx, fy - stepG);
        const eD = smoothElev(fx, fy + stepG);
        const gx = eR - eL;
        const gy = eD - eU;
        const slope = Math.hypot(gx, gy);
        const shade = (-gx * 0.75 - gy * 0.66) * 0.55;

        // Flat urban / coastal reclaimed ground
        const flatLimit = mode === "overview" ? 5.2 : 4.2;
        if (elev < flatLimit && slope < 2.2) {
          const isReclaimedHarbor =
            mode === "overview" && x > 260 && x < 470 && y < 185;
          if (nearSea && elev < 3) {
            setPx(
              data,
              tw,
              x,
              y,
              isReclaimedHarbor
                ? [220, 214, 192]
                : dither < 2
                  ? COL.sandLight
                  : COL.sandDark,
            );
          } else if (nearSea2 && elev < 3.4) {
            setPx(
              data,
              tw,
              x,
              y,
              isReclaimedHarbor ? [232, 226, 206] : COL.sandDark,
            );
          } else {
            const isDowntown =
              mode === "overview" && x > 315 && x < 465 && y < 165;
            const base = isDowntown
              ? COL.urbanDense
              : dither === 0
                ? COL.urbanShade
                : COL.urbanBase;
            setPx(data, tw, x, y, base);
          }
          continue;
        }

        // Steep rocky cliffs on islands/headlands
        if (slope > (mode === "overview" ? 15.0 : 12.0) && elev > 5) {
          const rockNoise = hash2(x >> 1, y >> 1, 13);
          if (shade > 0.8) {
            setPx(data, tw, x, y, COL.cliffLight);
          } else if (shade > -1.2 || rockNoise > 0.55) {
            setPx(data, tw, x, y, COL.cliffMid);
          } else {
            setPx(data, tw, x, y, COL.cliffDark);
          }
          continue;
        }

        // 5-band SNES lush mountain ramp with strong sunlight contrast & Bayer dither
        const score = elev * 0.065 + shade * 0.88;
        let rgb;
        if (score > 2.2 || (score > 1.7 && dither < 2)) {
          rgb = COL.green0;
        } else if (score > 1.0 || (score > 0.55 && dither < 2)) {
          rgb = COL.green1;
        } else if (score > -0.25 || (score > -0.65 && dither < 2)) {
          rgb = COL.green2;
        } else if (score > -1.6 || (score > -2.0 && dither < 2)) {
          rgb = COL.green3;
        } else {
          rgb = COL.green4;
        }

        if (shade < -3.0 && dither === 0) {
          rgb = COL.crease;
        }
        setPx(data, tw, x, y, rgb);
      }
    }

    octx.putImageData(img, 0, 0);

    // Draw clustered SNES water shimmer ripples directly onto the 480x320 pixel grid
    for (let by = 4; by < th - 4; by += 6) {
      for (let bx = 6; bx < tw - 14; bx += 14) {
        const n = hash2(bx, by, 21);
        if (n > 0.24) continue;
        const fx = ((bx + 0.5) * gw) / tw - 0.5;
        const fy = ((by + 0.5) * gh) / th - 0.5;
        if (sampleDem(fx, fy) !== 0 || sampleLandDist(fx, fy) < 3) continue;
        const rx = bx + Math.floor(hash2(bx, by, 22) * 8);
        const ry = by + Math.floor(hash2(bx, by, 23) * 3);
        const len = 3 + Math.floor(hash2(bx, by, 24) * 5);
        octx.fillStyle = n < 0.07 ? "#b8f4f2" : "#56c7d2";
        octx.fillRect(rx, ry, len, 1);
        if (n < 0.14) {
          octx.fillStyle = "#3baec0";
          octx.fillRect(rx + 2, ry + 2, Math.max(2, len - 2), 1);
        }
      }
    }

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }

  // Raster occupancy mask (at 1/2 resolution: 480x320) to keep rivers/roads/rails clear of trees/houses
  function createClearMask(w, h) {
    const cw = Math.floor(w / 2);
    const ch = Math.floor(h / 2);
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = cw;
    maskCanvas.height = ch;
    const mctx = maskCanvas.getContext("2d");
    mctx.fillStyle = "#000";
    mctx.fillRect(0, 0, cw, ch);

    function blockPolylines(lines, lineWidth) {
      if (!lines || !lines.length) return;
      mctx.save();
      mctx.strokeStyle = "#fff";
      mctx.lineWidth = lineWidth / 2;
      mctx.lineCap = "round";
      mctx.lineJoin = "round";
      mctx.beginPath();
      for (const line of lines) {
        if (line.length < 2) continue;
        mctx.moveTo(line[0][0] / 2, line[0][1] / 2);
        for (let i = 1; i < line.length; i++) {
          mctx.lineTo(line[i][0] / 2, line[i][1] / 2);
        }
      }
      mctx.stroke();
      mctx.restore();
    }

    function blockBox(x, y, bw, bh) {
      mctx.fillStyle = "#fff";
      mctx.fillRect(
        Math.round((x - bw / 2) / 2),
        Math.round((y - bh / 2) / 2),
        Math.round(bw / 2),
        Math.round(bh / 2),
      );
    }

    function blockPolys(polys) {
      if (!polys || !polys.length) return;
      mctx.save();
      mctx.fillStyle = "#fff";
      mctx.beginPath();
      for (const poly of polys) {
        if (poly.length < 3) continue;
        mctx.moveTo(poly[0][0] / 2, poly[0][1] / 2);
        for (let i = 1; i < poly.length; i++) {
          mctx.lineTo(poly[i][0] / 2, poly[i][1] / 2);
        }
        mctx.closePath();
      }
      mctx.fill();
      mctx.restore();
    }

    let data = null;
    function bake() {
      data = mctx.getImageData(0, 0, cw, ch).data;
    }
    function isBlocked(x, y) {
      if (!data) bake();
      const cx = Math.max(0, Math.min(cw - 1, Math.round(x / 2)));
      const cy = Math.max(0, Math.min(ch - 1, Math.round(y / 2)));
      return data[(cy * cw + cx) * 4] > 60;
    }

    return { blockPolylines, blockBox, blockPolys, isBlocked };
  }

  function paintRailTrack(ctx, lines, sleeperColor, railColor, tieColor) {
    if (!lines || !lines.length) return;
    drawPolylines(ctx, lines, 6, sleeperColor);
    drawPolylines(ctx, lines, 4, railColor);
    drawPolylines(ctx, lines, 3, tieColor, [2, 3]);
  }

  function paintWaterChannels(ctx, polys, streams, isLocal) {
    // 1. Stone embankments & water polygons (Hiroshima Delta, Yahata mouth, Castle moat)
    // Skip any polygon that includes long horizontal/vertical MVT tile-edge cuts
    const cleanPolys = (polys || []).filter((poly) => {
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      let hasTileEdge = false;
      for (let i = 0; i < poly.length; i++) {
        const [x, y] = poly[i];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (i > 0) {
          const [px, py] = poly[i - 1];
          const dx = Math.abs(x - px);
          const dy = Math.abs(y - py);
          if ((dx > 45 && dy < 0.8) || (dy > 45 && dx < 0.8)) {
            hasTileEdge = true;
          }
        }
      }
      return !hasTileEdge && maxX - minX < 180 && maxY - minY < 180;
    });
    fillPolys(ctx, cleanPolys, "#1c97ad", "#e4dcb8", isLocal ? 4 : 2);
    fillPolys(ctx, cleanPolys, "#29acc0", "#174657", 1);

    // 2. River streams (Ota 6 channels, Yahata River, western valley creeks)
    if (streams && streams.length) {
      for (let i = 0; i < streams.length; i++) {
        const line = Array.isArray(streams[i]) ? streams[i] : streams[i].pts;
        const kind = streams[i].kind || (i < 7 ? "river" : "stream");
        const w = isLocal
          ? kind === "river"
            ? 24
            : kind === "canal"
              ? 10
              : 6
          : i < 6
            ? 11
            : i === 6
              ? 7
              : 4;
        drawPolylines(ctx, [line], w + 4, "#e6ddb7"); // stone/sand banks
        drawPolylines(ctx, [line], w + 2, "#174657"); // crisp 1px dark bank edge
        drawPolylines(ctx, [line], w, "#28a9be"); // turquoise river fill
        drawPolylines(ctx, [line], Math.max(2, w - 4), "#4ec6d3", [10, 12]); // shimmer
      }
    }
  }

  function paintRoads(ctx, major, secondary, minor, isLocal) {
    if (isLocal && minor && minor.length) {
      drawPolylines(ctx, minor, 5, "#9c9783");
      drawPolylines(ctx, minor, 3, "#efe8cf");
    }
    if (secondary && secondary.length) {
      drawPolylines(ctx, secondary, isLocal ? 9 : 4.5, "#676e76");
      drawPolylines(ctx, secondary, isLocal ? 6.5 : 2.5, "#f7edd1");
    }
    if (major && major.length) {
      drawPolylines(ctx, major, isLocal ? 12 : 6, "#4d5966");
      drawPolylines(ctx, major, isLocal ? 9 : 4, "#f9e7b5");
      if (isLocal) {
        drawPolylines(ctx, major, 1.5, "#d8a84a", [6, 6]);
      }
    }
  }

  function drawBridgePillars(ctx, maskCanvas, roadLines, w) {
    // Draw crisp stone bridge decks wherever major roads/rails cross water
    // Done cleanly by redrawing bridges over water along major lines
    if (!roadLines || !roadLines.length || !maskCanvas) return;
    // Sample points along major lines and if water mask is active, stamp a clean bridge deck
    const mctx = maskCanvas.getContext("2d");
    const mdata = mctx.getImageData(
      0,
      0,
      maskCanvas.width,
      maskCanvas.height,
    ).data;
    const mw = maskCanvas.width;
    const mh = maskCanvas.height;

    function isWaterAt(x, y) {
      const ix = Math.max(0, Math.min(mw - 1, Math.round(x)));
      const iy = Math.max(0, Math.min(mh - 1, Math.round(y)));
      // Blue channel significantly higher than red channel means water
      const idx = (iy * mw + ix) * 4;
      return mdata[idx + 2] > mdata[idx] + 25;
    }

    ctx.save();
    for (const line of roadLines) {
      for (let i = 1; i < line.length; i++) {
        const [x1, y1] = line[i - 1];
        const [x2, y2] = line[i];
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.max(1, Math.ceil(dist / 4));
        for (let s = 0; s <= steps; s++) {
          const px = x1 + ((x2 - x1) * s) / steps;
          const py = y1 + ((y2 - y1) * s) / steps;
          if (isWaterAt(px, py)) {
            ctx.fillStyle = "#3a4552";
            ctx.fillRect(
              Math.round(px - w / 2 - 2),
              Math.round(py - w / 2 - 2),
              w + 4,
              w + 4,
            );
            ctx.fillStyle = "#e6dec7";
            ctx.fillRect(Math.round(px - w / 2), Math.round(py - w / 2), w, w);
          }
        }
      }
    }
    ctx.restore();
  }

  function addContextLabel(ctx, text, x, y, align = "center") {
    ctx.save();
    ctx.font =
      '800 11px "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "rgba(18, 43, 61, 0.88)";
    ctx.strokeText(text, Math.round(x), Math.round(y));
    ctx.fillStyle = "#f9f6df";
    ctx.fillText(text, Math.round(x), Math.round(y));
    ctx.restore();
  }

  function renderOverview() {
    const canvas = document.querySelector(".terrain-overview");
    if (!canvas || !ns.geo || !ns.sprites) return;
    const { width: W, height: H, gridW: GW, gridH: GH, spots } = ns.geo;
    const ov = ns.geo.overview;
    const dem = ns.decodeDem(ov.demRle, GW * GH);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // Pass 1: SNES Pixel Terrain & Sea Bathymetry
    renderPixelTerrain(canvas, dem, GW, GH, "overview");

    // Pass 2: Rivers & Ota Channels
    paintWaterChannels(ctx, ov.vectors.waterPolys, ov.vectors.streams, false);

    // Snapshot terrain+water before roads/buildings so bridge detection knows true water pixels
    const waterSnap = document.createElement("canvas");
    waterSnap.width = W;
    waterSnap.height = H;
    waterSnap.getContext("2d").drawImage(canvas, 0, 0);

    // Pass 3: Roads, Railways & Bridges
    paintRoads(
      ctx,
      ov.vectors.majorRoads,
      ov.vectors.secondaryRoads,
      null,
      false,
    );
    drawBridgePillars(ctx, waterSnap, ov.vectors.majorRoads, 5);
    paintRailTrack(ctx, ov.vectors.jrLines, "#243444", "#ede5cb", "#6b7988");
    drawBridgePillars(ctx, waterSnap, ov.vectors.jrLines, 5);

    // Mt. Misen hiking trail on Miyajima
    const [mx, my] = spots.miyajima.overview;
    drawPolylines(
      ctx,
      [
        [
          [mx + 14, my - 10],
          [mx + 6, my + 8],
          [mx - 4, my + 24],
          [mx - 18, my + 38],
        ],
      ],
      3,
      "#e8d29c",
      [3, 3],
    );

    // Pass 4: Build clearance mask so foliage/houses respect rivers, rails, highways & landmarks
    const mask = createClearMask(W, H);
    mask.blockPolys(ov.vectors.waterPolys);
    mask.blockPolylines(ov.vectors.streams, 14);
    mask.blockPolylines(ov.vectors.jrLines, 11);
    mask.blockPolylines(ov.vectors.majorRoads, 10);
    // Reserve landmark plazas
    const reserve = [
      [spots.hiroshima_castle.overview, 54, 48],
      [spots.abomb_dome.overview, 34, 34],
      [spots.hiroshima.overview, 56, 34],
      [spots.campus.overview, 46, 34],
      [spots.ferry.overview, 40, 28],
      [spots.miyajima.overview, 56, 46],
      [spots.miyajima_pier.overview, 34, 24],
    ];
    for (const [pt, rw, rh] of reserve) {
      mask.blockBox(pt[0], pt[1], rw, rh);
    }

    // Pass 5: Dense Y-sorted SNES Sprite Forest, Urban Skyline, Sakura & Landmarks
    const queue = [];
    const { getSprite } = ns.sprites;

    function pushSprite(name, x, y, scale = 1, layerBias = 0) {
      const spr = getSprite(name);
      queue.push({
        spr,
        x: Math.round(x - (spr.width * scale) / 2),
        y: Math.round(y - spr.height * scale),
        w: Math.round(spr.width * scale),
        h: Math.round(spr.height * scale),
        sortY: y + layerBias,
      });
    }

    function demAtCanvas(px, py) {
      const gx = Math.max(0, Math.min(GW - 1, Math.floor((px / W) * GW)));
      const gy = Math.max(0, Math.min(GH - 1, Math.floor((py / H) * GH)));
      return dem[gy * GW + gx];
    }

    function gradAtCanvas(px, py) {
      const gx = Math.max(1, Math.min(GW - 2, Math.floor((px / W) * GW)));
      const gy = Math.max(1, Math.min(GH - 2, Math.floor((py / H) * GH)));
      const dx = dem[gy * GW + gx + 1] - dem[gy * GW + gx - 1];
      const dy = dem[(gy + 1) * GW + gx] - dem[(gy - 1) * GW + gx];
      return { dx, dy, slope: Math.hypot(dx, dy) };
    }

    // Dense trees & hills + town houses across land
    const step = 10;
    for (let gy = 8; gy < H - 4; gy += step) {
      for (let gx = 6; gx < W - 6; gx += step) {
        const jx = gx + (hash2(gx, gy, 1) - 0.5) * 7;
        const jy = gy + (hash2(gx, gy, 2) - 0.5) * 6;
        if (jx < 4 || jx >= W - 4 || jy < 4 || jy >= H - 4) continue;

        const elev = demAtCanvas(jx, jy);
        if (elev === 0) continue;
        if (mask.isBlocked(jx, jy)) continue;

        // Avoid edges directly touching water
        if (
          demAtCanvas(jx - 6, jy) === 0 ||
          demAtCanvas(jx + 6, jy) === 0 ||
          demAtCanvas(jx, jy + 5) === 0
        ) {
          continue;
        }

        const r = hash2(gx, gy, 3);
        const r2 = hash2(gx, gy, 4);
        const { dx, dy, slope } = gradAtCanvas(jx, jy);

        // Mountain & forest canopies
        if (elev >= 5.5 || (elev >= 3.5 && slope >= 2)) {
          if (slope > 15 && r < 0.45) {
            pushSprite("cliffRock", jx, jy, 1.0);
            continue;
          }
          // Sunlit NW slopes get bright oaks & pine clusters; shadowed SE get deep conifers
          const sunlit = -dx - dy > 0;
          if (r < 0.032) {
            pushSprite(r2 < 0.5 ? "sakuraLarge" : "sakuraSmall", jx, jy, 1.0);
          } else if (sunlit) {
            const pick =
              r < 0.34
                ? "oakBright"
                : r < 0.62
                  ? "oakMid"
                  : r < 0.85
                    ? "pineCluster"
                    : "pineMed";
            pushSprite(pick, jx, jy, 0.95);
          } else {
            const pick =
              r < 0.38
                ? "pineTall"
                : r < 0.72
                  ? "pineMed"
                  : r < 0.9
                    ? "oakDark"
                    : "pineCluster";
            pushSprite(pick, jx, jy, 0.95);
          }
          continue;
        }

        // Flat urban & coastal plains
        const isDelta = jx > 610 && jy < 350; // Downtown Hiroshima 6-river delta
        const isBayTown =
          (jx > 300 && jx < 610 && jy < 270) ||
          (jx > 150 && jx < 300 && jy > 220 && jy < 430);
        const isMiyajimaTown = jx > 210 && jx < 285 && jy > 425 && jy < 495;

        if (isDelta) {
          // Dense Hiroshima cityscape: office towers, glass towers, apartments, parks
          if (r < 0.06) {
            pushSprite("sakuraSmall", jx, jy, 0.95);
          } else if (r < 0.14) {
            pushSprite("oakBright", jx, jy, 0.9);
          } else if (jx > 670 && jx < 880 && jy > 50 && jy < 220) {
            const pick =
              r < 0.34
                ? "towerA"
                : r < 0.52
                  ? "towerB"
                  : r < 0.72
                    ? "officeGlass"
                    : r < 0.88
                      ? "officeA"
                      : "officeB";
            pushSprite(pick, jx, jy, 1.0);
          } else if (jy > 250) {
            const pick =
              r < 0.45 ? "warehouse" : r < 0.75 ? "mansionWide" : "officeB";
            pushSprite(pick, jx, jy, 0.95);
          } else {
            const pick =
              r < 0.35
                ? "mansionSmall"
                : r < 0.65
                  ? "officeA"
                  : r < 0.85
                    ? "houseBlue"
                    : "houseRed";
            pushSprite(pick, jx, jy, 0.95);
          }
        } else if (isBayTown || isMiyajimaTown) {
          if (r < 0.05) {
            pushSprite("sakuraSmall", jx, jy, 0.95);
          } else if (r < 0.15) {
            pushSprite("oakMid", jx, jy, 0.9);
          } else if (r < 0.32) {
            pushSprite("mansionSmall", jx, jy, 0.9);
          } else if (r < 0.5) {
            pushSprite("houseBlue", jx, jy, 0.9);
          } else if (r < 0.68) {
            pushSprite("houseRed", jx, jy, 0.9);
          } else if (r < 0.84) {
            pushSprite("houseNavy", jx, jy, 0.9);
          } else {
            pushSprite("shopA", jx, jy, 0.9);
          }
        } else {
          // Foothill villages & farmland
          if (r < 0.12) {
            pushSprite("paddyField", jx, jy, 0.95);
          } else if (r < 0.36) {
            pushSprite(r2 < 0.5 ? "houseRed" : "houseBlue", jx, jy, 0.88);
          } else if (r < 0.75) {
            pushSprite(r2 < 0.5 ? "oakBright" : "pineMed", jx, jy, 0.92);
          } else {
            pushSprite("sakuraSmall", jx, jy, 0.9);
          }
        }
      }
    }

    // Extra lush mountain ridges & valley waterfalls
    const waterfalls = [
      [115, 76],
      [252, 54],
      [338, 42],
      [88, 198],
    ];
    for (const [wx, wy] of waterfalls) {
      pushSprite("waterfall", wx, wy, 1.3, 4);
    }

    // Sea life: rocky islets, sailboats, harbor cranes
    const islets = [
      [860, 495],
      [918, 430],
      [530, 560],
      [620, 585],
      [785, 360],
      [512, 428],
    ];
    for (const [ix, iy] of islets) {
      if (demAtCanvas(ix, iy) === 0) pushSprite("seaIslet", ix, iy, 1.2);
    }
    const seaRocks = [
      [445, 515],
      [498, 475],
      [645, 445],
      [892, 548],
      [345, 595],
    ];
    for (const [rx, ry] of seaRocks) {
      if (demAtCanvas(rx, ry) === 0) pushSprite("seaRock", rx, ry, 1.2);
    }

    const sailboats = [
      ["sailboatLarge", 460, 325],
      ["sailboatSmall", 545, 430],
      ["sailboatLarge", 322, 392],
      ["sailboatSmall", 690, 495],
      ["sailboatSmall", 190, 520],
      ["fishingBoat", 390, 290],
      ["fishingBoat", 820, 315],
    ];
    for (const [name, sx, sy] of sailboats) {
      pushSprite(name, sx, sy, 1.25);
    }

    // Port cranes on Hiroshima reclaimed waterfront
    pushSprite("harborCrane", 738, 310, 1.2);
    pushSprite("harborCrane", 835, 290, 1.2);
    pushSprite("harborCrane", 650, 290, 1.2);

    // Hero Landmarks at exact projected OSM coordinates
    const [cx, cy] = spots.hiroshima_castle.overview;
    pushSprite("hiroshimaCastle", cx, cy + 8, 1.35, 10);
    pushSprite("sakuraLarge", cx - 18, cy + 6, 1.1, 11);
    pushSprite("sakuraSmall", cx + 18, cy + 7, 1.1, 11);

    const [ax, ay] = spots.abomb_dome.overview;
    pushSprite("abombDome", ax, ay + 6, 1.3, 10);
    pushSprite("oakBright", ax - 15, ay + 8, 1.0, 11);

    const [hsx, hsy] = spots.hiroshima.overview;
    pushSprite("hiroshimaStation", hsx, hsy + 8, 1.35, 10);
    pushSprite("jrTrain", hsx - 32, hsy + 4, 1.1, 12);

    const [hitX, hitY] = spots.campus.overview;
    pushSprite("hitCampusOverview", hitX, hitY + 8, 1.35, 10);

    const [fx, fy] = spots.ferry.overview;
    pushSprite("ferryTerminal", fx, fy + 6, 1.25, 10);
    pushSprite("miyajimaFerry", fx + 22, fy + 24, 1.25, 14);

    const [toriiX, toriiY] = spots.miyajima.overview;
    pushSprite("miyajimaTorii", toriiX, toriiY + 8, 1.4, 14);
    const [shrineX, shrineY] = spots.itsukushima.overview;
    pushSprite("itsukushimaShrine", shrineX + 10, shrineY + 12, 1.3, 15);
    const [pagX, pagY] = spots.pagoda.overview;
    pushSprite("miyajimaPagoda", pagX + 16, pagY + 6, 1.25, 15);
    pushSprite("sakuraLarge", shrineX - 18, shrineY + 6, 1.1, 14);
    pushSprite("sakuraLarge", shrineX + 26, shrineY + 2, 1.0, 14);

    // Y-sort all sprites for crisp 2.5D overlap
    queue.sort((a, b) => a.sortY - b.sortY);
    for (const item of queue) {
      ctx.drawImage(item.spr, item.x, item.y, item.w, item.h);
    }

    // Pass 6: Subtle Geographic Context Labels (positioned clear of pins & crop edges)
    addContextLabel(ctx, "広島城", cx, cy - 26);
    addContextLabel(ctx, "原爆ドーム", ax - 8, ay + 24);
    addContextLabel(ctx, "太田川デルタ", 755, 224);
    addContextLabel(ctx, "八幡川", 386, 98);
    addContextLabel(
      ctx,
      "似島",
      spots.ninoshima.overview[0],
      spots.ninoshima.overview[1] - 4,
    );
    addContextLabel(ctx, "瀬戸内海（広島湾）", 455, 488);
  }

  function renderLocal() {
    const canvas = document.querySelector(".terrain-local");
    if (!canvas || !ns.geo || !ns.sprites) return;
    const { width: W, height: H, gridW: GW, gridH: GH, spots } = ns.geo;
    const loc = ns.geo.local;
    const dem = ns.decodeDem(loc.demRle, GW * GH);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // Pass 1: High-res DEM5A Terrain & Coastline
    renderPixelTerrain(canvas, dem, GW, GH, "local");

    // Highlight HIT Campus grounds cleanly (green lawn + athletics pitch + paved walkways)
    const [camX, camY] = spots.campus.local;
    const [gateX, gateY] = spots.maingate.local;
    ctx.save();
    ctx.fillStyle = "#c4dca1";
    ctx.strokeStyle = "#8aa869";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(camX - 52, camY - 68, 175, 118, 10);
    ctx.fill();
    ctx.stroke();
    // Campus sports ground north-west of New Bldg 4
    ctx.fillStyle = "#dfbf8a";
    ctx.fillRect(Math.round(camX - 42), Math.round(camY - 58), 58, 42);
    ctx.strokeStyle = "#f2dfb5";
    ctx.strokeRect(Math.round(camX - 40), Math.round(camY - 56), 54, 38);
    // Campus pedestrian plaza from 正門 -> Nexus21 -> 新4号館
    ctx.strokeStyle = "#f3e8c6";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(gateX, gateY);
    ctx.lineTo(spots.nexus21.local[0], spots.nexus21.local[1]);
    ctx.lineTo(camX, camY + 8);
    ctx.stroke();
    ctx.restore();

    // Pass 2: Yahata River & Tributaries from real OSM vectors
    paintWaterChannels(
      ctx,
      loc.vectors.waterPolys,
      loc.vectors.waterLines,
      true,
    );

    // Snapshot water before roads/bridges
    const waterSnap = document.createElement("canvas");
    waterSnap.width = W;
    waterSnap.height = H;
    waterSnap.getContext("2d").drawImage(canvas, 0, 0);

    // Pass 3: Real OSM Road Network, Bridges, JR Sanyo Line & Hiroden Miyajima Line
    paintRoads(
      ctx,
      loc.vectors.majorRoads,
      loc.vectors.secondaryRoads,
      loc.vectors.minorRoads,
      true,
    );
    drawBridgePillars(ctx, waterSnap, loc.vectors.majorRoads, 10);
    drawBridgePillars(ctx, waterSnap, loc.vectors.secondaryRoads, 7);

    // Hiroden Miyajima Line (tram tracks)
    paintRailTrack(ctx, loc.vectors.tramLines, "#2c4c3e", "#d6e5d2", "#477859");
    drawBridgePillars(ctx, waterSnap, loc.vectors.tramLines, 6);
    // JR Sanyo Main Line
    paintRailTrack(ctx, loc.vectors.jrLines, "#202e3e", "#ebe4cc", "#5d6a78");
    drawBridgePillars(ctx, waterSnap, loc.vectors.jrLines, 7);

    // Pass 4: Build clearance mask
    const mask = createClearMask(W, H);
    mask.blockPolys(loc.vectors.waterPolys);
    const streamPts = loc.vectors.waterLines.map((w) => w.pts);
    mask.blockPolylines(streamPts, 22);
    mask.blockPolylines(loc.vectors.majorRoads, 14);
    mask.blockPolylines(loc.vectors.secondaryRoads, 11);
    mask.blockPolylines(loc.vectors.jrLines, 12);
    mask.blockPolylines(loc.vectors.tramLines, 11);
    // Reserve campus & key POI pads
    mask.blockBox(camX + 26, camY - 12, 188, 128);
    mask.blockBox(spots.honoyu.local[0], spots.honoyu.local[1], 52, 42);
    mask.blockBox(spots.aeon.local[0], spots.aeon.local[1], 56, 38);
    mask.blockBox(spots.jr.local[0], spots.jr.local[1], 66, 38);
    mask.blockBox(spots.kaikatsu.local[0], spots.kaikatsu.local[1], 38, 42);
    mask.blockBox(spots.rakuraku.local[0], spots.rakuraku.local[1], 48, 30);

    // Pass 5: Y-sorted Real OSM Building Footprints + Mountain Forests + Campus/Spot Landmarks
    const queue = [];
    const { getSprite } = ns.sprites;

    function pushSprite(name, x, y, scale = 1, layerBias = 0) {
      const spr = getSprite(name);
      queue.push({
        spr,
        x: Math.round(x - (spr.width * scale) / 2),
        y: Math.round(y - spr.height * scale),
        w: Math.round(spr.width * scale),
        h: Math.round(spr.height * scale),
        sortY: y + layerBias,
      });
    }

    function demAtCanvas(px, py) {
      const gx = Math.max(0, Math.min(GW - 1, Math.floor((px / W) * GW)));
      const gy = Math.max(0, Math.min(GH - 1, Math.floor((py / H) * GH)));
      return dem[gy * GW + gx];
    }

    // Stamp real OSM residential/commercial buildings (sampled cleanly to avoid overlapping clusters)
    const occupied = new Set();
    for (const [bx, by, bw, bh] of loc.vectors.urbanBuildings) {
      if (bx < 8 || bx > W - 8 || by < 8 || by > H - 8) continue;
      if (mask.isBlocked(bx, by)) continue;
      if (demAtCanvas(bx, by) === 0) continue;
      const cellKey = `${Math.floor(bx / 13)},${Math.floor(by / 11)}`;
      if (occupied.has(cellKey)) continue;
      occupied.add(cellKey);

      const r = hash2(Math.round(bx), Math.round(by), 31);
      const area = bw * bh;
      let sprName;
      if (area > 420 || bw > 26) {
        sprName = r < 0.55 ? "mansionWide" : "warehouse";
      } else if (area > 190 || bh > 16) {
        sprName = r < 0.5 ? "mansionSmall" : r < 0.8 ? "officeA" : "shopB";
      } else {
        sprName =
          r < 0.28
            ? "houseBlue"
            : r < 0.54
              ? "houseRed"
              : r < 0.78
                ? "houseNavy"
                : r < 0.9
                  ? "houseGreen"
                  : "shopA";
      }
      pushSprite(sprName, bx, by + 4, 1.0);
    }

    // Fill hills/mountains behind HIT campus & natural parks with lush SNES trees + sakura
    for (let gy = 8; gy < H - 4; gy += 9) {
      for (let gx = 6; gx < W - 6; gx += 9) {
        const jx = gx + (hash2(gx, gy, 41) - 0.5) * 6;
        const jy = gy + (hash2(gx, gy, 42) - 0.5) * 5;
        if (jx < 4 || jx >= W - 4 || jy < 4 || jy >= H - 4) continue;
        const elev = demAtCanvas(jx, jy);
        if (elev === 0 || mask.isBlocked(jx, jy)) continue;
        const cellKey = `${Math.floor(jx / 13)},${Math.floor(jy / 11)}`;
        if (occupied.has(cellKey)) continue;

        const r = hash2(gx, gy, 43);
        if (elev >= 4.6) {
          if (r < 0.04) {
            pushSprite("sakuraSmall", jx, jy, 1.05);
          } else if (r < 0.35) {
            pushSprite("pineTall", jx, jy, 1.05);
          } else if (r < 0.68) {
            pushSprite("pineCluster", jx, jy, 1.0);
          } else {
            pushSprite("oakBright", jx, jy, 1.05);
          }
        } else if (r < 0.17) {
          // Neighborhood trees & riverside sakura
          const nearYahata = Math.abs(jx - 615) < 75;
          if (nearYahata && r < 0.08) {
            pushSprite("sakuraSmall", jx, jy, 1.0);
          } else {
            pushSprite(r < 0.09 ? "oakBright" : "pineMed", jx, jy, 0.95);
          }
        }
      }
    }

    // HIT Campus Detailed Ensemble
    const [nexX, nexY] = spots.nexus21.local;
    pushSprite("hitNew4", camX, camY + 8, 1.35, 14);
    pushSprite("hitNexus21", nexX + 4, nexY + 12, 1.35, 14);
    pushSprite("hitGate", gateX, gateY + 6, 1.3, 14);
    pushSprite("officeGlass", camX + 26, camY - 20, 1.1, 10); // 図書館 / 1号館側
    pushSprite("sakuraLarge", camX - 24, camY + 12, 1.1, 15);
    pushSprite("sakuraLarge", gateX - 18, gateY + 8, 1.05, 15);
    pushSprite("sakuraSmall", nexX + 28, nexY + 14, 1.05, 15);

    // Stations & Local Spots
    const [jrX, jrY] = spots.jr.local;
    pushSprite("stationItsukaichi", jrX, jrY + 6, 1.4, 14);
    pushSprite("jrTrain", jrX - 38, jrY + 2, 1.15, 15);

    const [kaX, kaY] = spots.kaikatsu.local;
    pushSprite("kaikatsuBuilding", kaX + 8, kaY + 10, 1.35, 16);

    const [rakX, rakY] = spots.rakuraku.local;
    pushSprite("stationRakurakuen", rakX, rakY + 6, 1.3, 14);
    pushSprite("hirodenTram", rakX + 28, rakY - 2, 1.2, 15);

    const [aeonX, aeonY] = spots.aeon.local;
    pushSprite("aeonMall", aeonX, aeonY + 8, 1.35, 14);

    const [hoX, hoY] = spots.honoyu.local;
    pushSprite("honoyuOnsen", hoX, hoY + 8, 1.45, 15);
    pushSprite("sakuraSmall", hoX - 20, hoY + 8, 1.0, 16);

    const [busX, busY] = spots.bus.local;
    pushSprite("localBus", busX - 10, busY + 10, 1.25, 15);

    // Itsukaichi Harbor boats in southern bay
    pushSprite("fishingBoat", 625, 610, 1.3);
    pushSprite("fishingBoat", 652, 622, 1.3);
    pushSprite("sailboatSmall", 545, 595, 1.3);
    pushSprite("sailboatLarge", 745, 608, 1.3);

    queue.sort((a, b) => a.sortY - b.sortY);
    for (const item of queue) {
      ctx.drawImage(item.spr, item.x, item.y, item.w, item.h);
    }

    // Pass 6: Clear Geographic Context Labels (positioned away from pins and preview crop edges)
    addContextLabel(ctx, "三宅の森 Nexus21", nexX + 10, nexY + 18);
    addContextLabel(ctx, "新4号館 (GGJ会場)", camX + 6, camY - 22);
    addContextLabel(ctx, "正門", gateX, gateY - 12);
    addContextLabel(ctx, "八幡川", 625, 175);
    addContextLabel(ctx, "JR山陽本線", 505, 294);
    addContextLabel(ctx, "広電宮島線", 505, 368);
    addContextLabel(ctx, "国道2号", 450, 412);
    addContextLabel(ctx, "イオンタウン楽々園", aeonX + 54, aeonY + 4);
    addContextLabel(ctx, "五日市漁港", 650, 575);
  }

  ns.renderMaps = function renderMaps() {
    renderOverview();
    renderLocal();
  };
})();
