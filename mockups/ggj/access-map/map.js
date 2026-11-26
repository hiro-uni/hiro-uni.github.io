/* Interactive map controller using real OSM/GSI projected coordinates & dual 960x640 SNES canvases */
(() => {
  const ns = (window.GGJAccessMap = window.GGJAccessMap || {});
  const universityAccess = "https://www.it-hiroshima.ac.jp/access/itsukaichi/";
  const campusMap =
    "https://www.it-hiroshima.ac.jp/campuslife/docs/bf_map20250624.pdf";
  const googleCampus = "https://maps.app.goo.gl/nL7KeJcypyKS8SRK9";
  const ferryAccess = "https://www.miyajima.or.jp/sp/access.html";

  // Render the pixel-art terrain canvases first
  if (typeof ns.renderMaps === "function") {
    ns.renderMaps();
  }

  const { geo, sprites } = ns;
  const W = geo.width;
  const H = geo.height;

  // Populate bottom access card pixel-art badges
  document.querySelectorAll(".pixel-badge[data-icon]").forEach((el) => {
    const iconName = el.dataset.icon;
    const img = document.createElement("img");
    img.alt = "";
    img.src = sprites.getIconDataUrl(iconName, 2);
    el.append(img);
  });

  const places = {
    hiroshima: {
      name: "広島駅",
      icon: "station",
      kind: "stop",
      category: "JR・広島電鉄",
      coords: { overview: geo.spots.hiroshima.overview },
      labelPos: { overview: "bottom" },
      copy: "JR山陽本線（岩国方面）で約17分、五日市駅へ。会場へは五日市駅で広電または路線バスに乗り換えられます。",
      link: [universityAccess, "大学公式の交通案内"],
    },
    itsukaichi: {
      name: "五日市エリア（会場）",
      icon: "flag",
      kind: "venue",
      category: "GGJ 2027 会場周辺",
      coords: { overview: geo.spots.itsukaichi.overview },
      labelPos: { overview: "top" },
      copy: "広島駅から西へ。五日市マップに切り替えて、広島工業大学キャンパスや最寄り駅・立ち寄り先を詳しく確認できます。",
      next: ["local", "五日市エリアを詳しく見る →"],
    },
    campus: {
      name: "広島工業大学",
      icon: "flag",
      kind: "venue",
      category: "GGJ会場・五日市キャンパス",
      coords: { local: geo.spots.campus.local },
      labelPos: { local: "top" },
      pinOffset: { local: [0, 12] },
      copy: "新4号館 4階418号室（HIT Innovation Lab）。正門から「三宅の森 Nexus21」前を通って西側へ進みます。",
      detail: "広島県広島市佐伯区三宅2丁目1-1",
      link: [googleCampus, "Google マップ"],
      secondary: [campusMap, "大学公式の構内図（PDF）"],
    },
    jr: {
      name: "五日市駅",
      icon: "station",
      kind: "stop",
      category: "JR山陽本線・広電五日市駅",
      coords: {
        local: geo.spots.jr.local,
        trip: geo.spots.jr.overview,
      },
      labelPos: { local: "top", trip: "top" },
      pinOffset: { local: [-12, -14] },
      copy: "南口から「広島工大入口」方面の路線バスが発着します。隣接する広電五日市駅から楽々園駅へも移動できます。",
      link: [universityAccess, "大学公式の交通案内"],
    },
    rakuraku: {
      name: "楽々園駅",
      icon: "tram",
      kind: "stop",
      category: "広電宮島線",
      coords: { local: geo.spots.rakuraku.local },
      labelPos: { local: "left" },
      copy: "キャンパスまで北西へ徒歩約15分。五日市駅・宮島口方面からの路面電車が停車します。",
      link: [
        "https://www.hiroden.co.jp/train/route-guide/stop-guide/m29.html",
        "広電の駅案内",
      ],
    },
    bus: {
      name: "広島工大入口",
      icon: "bus",
      kind: "stop",
      category: "路線バス停（県道41号）",
      coords: { local: geo.spots.bus.local },
      labelPos: { local: "right" },
      pinOffset: { local: [8, 0] },
      copy: "五日市駅南口発の路線バスが停車します。バス停から大学正門までは西へ徒歩約3分。",
      link: [universityAccess, "大学公式の交通案内"],
    },
    honoyu: {
      name: "ほの湯 楽々園",
      icon: "onsen",
      kind: "rest",
      category: "塩屋天然温泉ほの湯楽々園",
      coords: { local: geo.spots.honoyu.local },
      labelPos: { local: "right" },
      pinOffset: { local: [0, 8] },
      copy: "楽々園駅から徒歩約5分、イオンタウン楽々園そばの温浴施設。露天風呂や休憩スペースがあります。",
      link: ["https://www.honoyu.jp/rakurakuen/", "ほの湯の公式サイト"],
    },
    kaikatsu: {
      name: "快活CLUB",
      icon: "cafe",
      kind: "rest",
      category: "快活CLUB 五日市駅前店",
      coords: { local: geo.spots.kaikatsu.local },
      labelPos: { local: "bottom-left" },
      pinOffset: { local: [12, 30] },
      copy: "JR五日市駅南口から徒歩3分。吉見園1-27 アヴィーユビル5階にあり、休憩や仮眠に便利です。",
      link: [
        "https://www.kaikatsu.jp/shop/detail/20637.html",
        "店舗情報・設備",
      ],
    },
    ferry: {
      name: "宮島口・桟橋",
      icon: "ferry",
      kind: "stop",
      category: "フェリー乗り場",
      coords: { trip: geo.spots.ferry.overview },
      labelPos: { trip: "top-left" },
      copy: "JR宮島口駅・広電宮島口からすぐの宮島口大桟橋。宮島までの乗船時間は約10分です。",
      link: [ferryAccess, "宮島観光協会の交通案内"],
    },
    miyajima: {
      name: "宮島（厳島神社）",
      icon: "torii",
      kind: "trip",
      category: "+1 DAY · 日帰り観光",
      coords: {
        overview: geo.spots.miyajima.overview,
        trip: geo.spots.miyajima.overview,
      },
      labelPos: { overview: "right", trip: "right" },
      pinOffset: { trip: [18, 6] },
      copy: "GGJの前後に1日足して、大鳥居・厳島神社や表参道商店街へ。宮島口からフェリーで約10分。",
      detail: "JR五日市駅 → JR宮島口駅 → フェリー → 宮島",
      link: [ferryAccess, "宮島観光協会の交通案内"],
    },
  };

  // Camera framing per view: overview & trip use terrain-overview (960x640);
  // local switches cleanly to dedicated 960x640 Itsukaichi map at scale 1.
  const views = {
    overview: {
      map: "overview",
      scale: 1,
      center: [W / 2, H / 2],
      pins: ["hiroshima", "itsukaichi", "miyajima"],
      selection: "itsukaichi",
    },
    local: {
      map: "local",
      scale: 1,
      center: [W / 2, H / 2],
      pins: ["campus", "bus", "rakuraku", "honoyu", "jr", "kaikatsu"],
      selection: "campus",
    },
    trip: {
      map: "overview",
      scale: 1.72,
      center: [285, 345],
      pins: ["jr", "ferry", "miyajima"],
      selection: "miyajima",
    },
  };

  const mapEl = document.querySelector("#map");
  const overviewCanvas = document.querySelector(".terrain-overview");
  const localCanvas = document.querySelector(".terrain-local");
  const routeCanvas = document.querySelector(".route");
  const routeCtx = routeCanvas.getContext("2d");
  const legendEl = document.querySelector("#route-legend");
  const markerLayer = document.querySelector("#map-markers");
  const stageButtons = [...document.querySelectorAll("[data-stage]")];
  const preview = document.querySelector("#place-art");
  const previewContext = preview.getContext("2d");
  const details = document.querySelector("#place-details");
  const actions = document.querySelector("#place-actions");

  let currentView = "overview";
  let currentPlace = "itsukaichi";

  const markers = Object.fromEntries(
    Object.entries(places).map(([id, place]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-marker";
      button.dataset.place = id;
      dotKind(button, place.kind);

      const label = document.createElement("span");
      label.className = "marker-label";
      label.textContent = place.name;

      const dot = document.createElement("span");
      dot.className = "marker-dot";
      dot.setAttribute("aria-hidden", "true");
      const iconImg = document.createElement("img");
      iconImg.alt = "";
      iconImg.src = sprites.getIconDataUrl(place.icon, 2);
      dot.append(iconImg);

      button.append(label, dot);
      button.addEventListener("click", (event) => {
        if (
          id === "itsukaichi" ||
          (id === "miyajima" && currentView === "overview")
        ) {
          showView(id === "itsukaichi" ? "local" : "trip");
          if (event.detail === 0) markers[currentPlace].focus();
          return;
        }
        selectPlace(id);
      });
      markerLayer.append(button);
      return [id, button];
    }),
  );

  function dotKind(btn, kind) {
    btn.dataset.kind = kind;
  }

  function offset(centerNorm, scale) {
    return Math.min(0, Math.max(1 - scale, 0.5 - centerNorm * scale));
  }

  function drawStyledPath(pts, outerColor, innerColor, dash) {
    if (!pts || pts.length < 2) return;
    routeCtx.save();
    routeCtx.lineCap = "round";
    routeCtx.lineJoin = "round";
    routeCtx.setLineDash(dash || [8, 8]);
    routeCtx.beginPath();
    routeCtx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      routeCtx.lineTo(pts[i][0], pts[i][1]);
    }
    routeCtx.strokeStyle = outerColor;
    routeCtx.lineWidth = 7;
    routeCtx.stroke();
    routeCtx.strokeStyle = innerColor;
    routeCtx.lineWidth = 3.5;
    routeCtx.stroke();
    routeCtx.restore();
  }

  function renderRoutesFor(view, placeId) {
    routeCtx.clearRect(0, 0, W, H);
    legendEl.replaceChildren();
    legendEl.hidden = true;

    const legendItems = [];

    if (view === "trip") {
      drawStyledPath(
        geo.overview.routes.jrMiyajima,
        "#10265b",
        "#59b5ff",
        [7, 7],
      );
      drawStyledPath(
        geo.overview.routes.ferryMiyajima,
        "#10265b",
        "#ffd447",
        [8, 6],
      );
      legendItems.push(["#59b5ff", "JR山陽本線（五日市→宮島口）"]);
      legendItems.push(["#ffd447", "フェリー航路（約10分）"]);
    } else if (view === "local") {
      const r = geo.local.routes;
      if (placeId === "campus" || placeId === "rakuraku") {
        drawStyledPath(r.walkRakuraku, "#10265b", "#ffd447", [7, 6]);
        legendItems.push(["#ffd447", "徒歩ルート（楽々園駅→大学 約15分）"]);
      }
      if (placeId === "campus" || placeId === "bus" || placeId === "jr") {
        drawStyledPath(r.busItsukaichi, "#10265b", "#59b5ff", [10, 6]);
        legendItems.push(["#59b5ff", "路線バス（五日市駅南口→広島工大入口）"]);
      }
      if (placeId === "jr") {
        drawStyledPath(r.tramItsukaichi, "#10265b", "#77e07f", [6, 6]);
        legendItems.push(["#77e07f", "広電宮島線（五日市→楽々園）"]);
      }
      if (placeId === "honoyu") {
        drawStyledPath(r.walkHonoyu, "#10265b", "#ff8d6b", [6, 5]);
        legendItems.push(["#ff8d6b", "楽々園駅からほの湯へ（徒歩約5分）"]);
      }
      if (placeId === "kaikatsu") {
        drawStyledPath(r.walkKaikatsu, "#10265b", "#ff8d6b", [6, 5]);
        legendItems.push(["#ff8d6b", "五日市駅南口から徒歩約3分"]);
      }
    }

    if (legendItems.length > 0) {
      for (const [color, text] of legendItems) {
        const item = document.createElement("span");
        item.className = "legend-item";
        const sw = document.createElement("span");
        sw.className = "legend-swatch";
        sw.style.background = color;
        item.append(sw, text);
        legendEl.append(item);
      }
      legendEl.hidden = false;
    }
  }

  function showView(view) {
    currentView = view;
    const { scale, center, pins, selection } = views[view];
    const x = offset(center[0] / W, scale);
    const y = offset(center[1] / H, scale);

    mapEl.dataset.view = view;
    mapEl.style.setProperty("--map-x", `${x * 100}%`);
    mapEl.style.setProperty("--map-y", `${y * 100}%`);
    mapEl.style.setProperty("--scale", scale);

    stageButtons.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.stage === view),
      ),
    );

    Object.entries(markers).forEach(([id, marker]) => {
      const visible = pins.includes(id);
      marker.hidden = !visible;
      if (!visible) return;

      const place = places[id];
      const [baseX, baseY] = place.coords[view] || place.coords.overview;
      const [dx, dy] = (place.pinOffset && place.pinOffset[view]) || [0, 0];
      const pinX = baseX + dx;
      const pinY = baseY + dy;
      marker.style.setProperty("--pin-x", `${(x + (pinX / W) * scale) * 100}%`);
      marker.style.setProperty("--pin-y", `${(y + (pinY / H) * scale) * 100}%`);
      const pos = (place.labelPos && place.labelPos[view]) || "top";
      marker.dataset.labelPos = pos;
    });

    selectPlace(selection);
  }

  function action(label, href, primary) {
    const element = document.createElement(href ? "a" : "button");
    element.className = primary ? "action action-primary" : "action";
    element.textContent = label;
    if (href) {
      element.href = href;
      element.target = "_blank";
      element.rel = "noopener noreferrer";
    } else {
      element.type = "button";
    }
    actions.append(element);
    return element;
  }

  function selectPlace(id) {
    currentPlace = id;
    const place = places[id];
    Object.entries(markers).forEach(([key, marker]) =>
      marker.setAttribute("aria-pressed", String(key === id)),
    );

    document.querySelector("#place-name").textContent = place.name;
    document.querySelector("#place-category").textContent = place.category;
    document.querySelector("#place-announcement").textContent =
      `${place.name}の案内を表示しました`;

    const iconHolder = document.querySelector("#place-icon");
    const iconImg = document.createElement("img");
    iconImg.alt = "";
    iconImg.src = sprites.getIconDataUrl(place.icon, 2);
    iconHolder.replaceChildren(iconImg);

    const activeCanvas = currentView === "local" ? localCanvas : overviewCanvas;
    const [px, py] =
      place.coords[currentView] || place.coords.overview || place.coords.local;

    const cropW = preview.width;
    const cropH = preview.height;
    const cropX = Math.max(0, Math.min(W - cropW, Math.round(px - cropW / 2)));
    const cropY = Math.max(0, Math.min(H - cropH, Math.round(py - cropH / 2)));

    previewContext.imageSmoothingEnabled = false;
    previewContext.clearRect(0, 0, preview.width, preview.height);
    previewContext.drawImage(
      activeCanvas,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      preview.width,
      preview.height,
    );

    renderRoutesFor(currentView, id);

    details.replaceChildren();
    actions.replaceChildren();

    const copy = document.createElement("p");
    copy.textContent = place.copy;
    details.append(copy);

    if (place.detail) {
      const note = document.createElement("p");
      note.textContent = place.detail;
      if (id === "miyajima") note.className = "trip-steps";
      details.append(note);
    }

    if (place.next) {
      const button = action(place.next[1], null, true);
      button.addEventListener("click", () => {
        showView(place.next[0]);
        markers[currentPlace].focus({ preventScroll: true });
      });
    }
    if (place.link) action(`${place.link[1]} ↗`, place.link[0], true);
    if (place.secondary)
      action(`${place.secondary[1]} ↗`, place.secondary[0], false);

    if (id === "itsukaichi") {
      action("+1 DAY 宮島へ →", null, false).addEventListener("click", () => {
        showView("trip");
        markers[currentPlace].focus({ preventScroll: true });
      });
    }
  }

  stageButtons.forEach((button) =>
    button.addEventListener("click", () => showView(button.dataset.stage)),
  );
  showView("overview");
})();
