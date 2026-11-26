import "../../mockups/ggj/access-map/geo-data.js";
import "../../mockups/ggj/access-map/sprites.js";
import "../../mockups/ggj/access-map/tiles.js";
import { animateSea } from "./ggj27-access-map-sea.js";
import { createRoutePlans } from "./ggj27-access-map-routes.js";

const section = document.querySelector("#access");
const map = section.querySelector(".map-surface");
const markers = section.querySelector(".map-markers");
const back = section.querySelector(".map-back");
const panel = section.querySelector(".spot-panel");
const spotName = panel.querySelector(".spot-name");
const spotCopy = panel.querySelector(".spot-copy");
const spotRoutes = panel.querySelector(".spot-routes");
const routeTimes = panel.querySelector(".route-times");
const overviewScene = map.querySelector(".scene-overview");
const localScene = map.querySelector(".scene-local");
const routeLayers = {
  overview: overviewScene.querySelector(".route-layer"),
  local: localScene.querySelector(".route-layer"),
};
const { geo, sprites, renderMaps } = window.GGJAccessMap;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const places = {
  hiroshima: {
    name: "JR広島駅",
    icon: "station",
    copy: "新幹線やJR在来線、広島電鉄が発着します。五日市駅へはJR山陽本線で向かえます。",
  },
  busCenter: {
    name: "広島バスセンター",
    icon: "bus",
    copy: "紙屋町のバスターミナル。路線バスや県内外への高速バス、広島空港行きのリムジンバスが発着します。",
  },
  itsukaichi: { name: "五日市（会場）", icon: "flag" },
  campus: {
    name: "広島工業大学",
    icon: "flag",
    copy: "GGJ 2027の会場は、五日市キャンパスの新4号館 4階418号室（HIT Innovation Lab）です。",
  },
  bus: {
    name: "広島工大入口",
    icon: "bus",
    copy: "JR五日市駅南口を発着する路線バスの停留所です。広島工業大学の正門が近くにあります。",
  },
  rakuraku: {
    name: "楽々園電停",
    icon: "tram",
    copy: "広島電鉄 宮島線の電停。広島工業大学の最寄り電停です。",
  },
  honoyu: {
    name: "ほの湯 楽々園",
    icon: "onsen",
    copy: "イオンタウン楽々園そばの温浴施設。露天風呂や休憩スペースがあります。",
  },
  jr: {
    name: "JR五日市駅",
    icon: "station",
    copy: "JR山陽本線の駅。隣接する広電五日市駅や、南口の路線バスに乗り換えられます。",
  },
  kaikatsu: {
    name: "快活CLUB",
    icon: "cafe",
    copy: "JR五日市駅南口そばのネットカフェです。",
  },
  ferry: {
    name: "宮島口・桟橋",
    icon: "ferry",
    copy: "宮島へのフェリーが発着する桟橋。JR宮島口駅と広電宮島口駅が近くにあります。",
  },
  miyajima: {
    name: "宮島（厳島神社）",
    icon: "torii",
    copy: "海に立つ大鳥居と厳島神社で知られる島です。初日の昼やもう1泊して、どうぞお越しください。",
  },
};

const views = {
  overview: {
    terrain: "overview",
    pins: [
      { spot: "hiroshima", position: "below" },
      { spot: "busCenter", position: "left" },
      { spot: "itsukaichi", next: "local" },
      { spot: "miyajima", label: "宮島", position: "right", next: "trip" },
    ],
  },
  local: {
    terrain: "local",
    pins: [
      { spot: "campus", position: "right" },
      { spot: "bus", position: "right" },
      { spot: "rakuraku", position: "left" },
      { spot: "honoyu", position: "right" },
      { spot: "jr", offset: [-12, -20] },
      { spot: "kaikatsu", position: "below", offset: [12, 30] },
    ],
  },
  trip: {
    terrain: "overview",
    pins: [
      { spot: "jr", position: "below" },
      { spot: "ferry", position: "left" },
      { spot: "miyajima", position: "right" },
    ],
  },
};

// Coordinates follow the map linked by the Hiroshima Bus Center.
const { lonMin, lonMax, latMin, latMax } = geo.overview.bounds;
const busCenterPoint = [
  ((132.4566 - lonMin) / (lonMax - lonMin)) * geo.width,
  ((latMax - 34.3953) / (latMax - latMin)) * geo.height,
];
const routePlans = createRoutePlans(geo, busCenterPoint);

let currentView = "overview";
let selectedSpot;
let transitionTimer;

function pointFor(spot, terrain) {
  return spot === "busCenter" ? busCenterPoint : geo.spots[spot][terrain];
}

function cameraOffset(center, renderedSize, viewportSize, scale) {
  return Math.min(
    0,
    Math.max(
      viewportSize - renderedSize * scale,
      viewportSize / 2 - center * scale,
    ),
  );
}

function positionMap() {
  const width = map.clientWidth;
  const height = map.clientHeight;
  const terrainHeight = Math.max(
    height,
    Math.min((width * geo.height) / geo.width, height * 1.34),
  );
  const unitX = width / geo.width;
  const unitY = terrainHeight / geo.height;
  map.style.setProperty("--terrain-height", `${terrainHeight}px`);

  const focus = {
    overview: [geo.width / 2, 253],
    local: geo.spots.itsukaichi.overview,
    trip: [285, 315],
  }[currentView];
  const scale =
    currentView === "local"
      ? 2.4
      : currentView === "trip"
        ? Math.min(1.72, (2 * height) / terrainHeight)
        : 1;
  const x = cameraOffset(focus[0] * unitX, width, width, scale);
  const y = cameraOffset(focus[1] * unitY, terrainHeight, height, scale);
  const localY = cameraOffset(322 * unitY, terrainHeight, height, 1);
  overviewScene.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  localScene.style.transform = `translateY(${localY}px) scale(${currentView === "local" ? 1 : 0.9})`;

  const { terrain, pins } = views[currentView];
  const isLocal = terrain === "local";
  const markerScale = isLocal ? 1 : scale;
  const markerOffsetX = isLocal ? 0 : x;
  const markerOffsetY = isLocal ? localY : y;
  pins.forEach(({ spot, offset = [0, 0] }, index) => {
    const [pinX, pinY] = pointFor(spot, terrain);
    const marker = markers.children[index];
    marker.style.left = `${markerOffsetX + (pinX + offset[0]) * unitX * markerScale}px`;
    marker.style.top = `${markerOffsetY + (pinY + offset[1]) * unitY * markerScale}px`;
  });
  positionPanel();
}

function positionPanel() {
  if (!selectedSpot) return;
  const { left, right } = markers
    .querySelector(`[data-spot="${selectedSpot}"]`)
    .getBoundingClientRect();
  const bounds = map.getBoundingClientRect();
  panel.dataset.side =
    left - bounds.left > bounds.right - right ? "left" : "right";
}

function selectSpot(spot) {
  selectedSpot = spot;
  panel.hidden = !spot;
  if (spot) {
    spotName.textContent = places[spot].name;
    spotCopy.textContent = places[spot].copy;
  }
  showRoutes(routePlans[currentView]?.[spot]);
  markers.querySelectorAll("button[aria-pressed]").forEach((marker) => {
    marker.setAttribute("aria-pressed", String(marker.dataset.spot === spot));
  });
  positionPanel();
}

function showRoutes(plan) {
  spotRoutes.hidden = !plan;
  routeTimes.replaceChildren();
  Object.values(routeLayers).forEach((layer) => layer.replaceChildren());
  if (!plan) return;

  const layer = routeLayers[views[currentView].terrain];
  for (const { mode, points, step } of plan.segments) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const coordinates = points.map(([x, y]) => `${x},${y}`).join(" L ");
    path.setAttribute("d", `M ${coordinates}`);
    path.setAttribute("pathLength", "1");
    path.dataset.mode = mode;
    path.style.setProperty("--route-delay", `${step * 360}ms`);
    layer.append(path);
  }

  for (const { mode, label, minutes, legs } of plan.options) {
    const item = document.createElement("li");
    const heading = document.createElement("strong");
    item.dataset.mode = mode;
    heading.textContent = `${label} 約${minutes}分`;
    item.append(heading, legs);
    routeTimes.append(item);
  }
}

function createMarker({ spot, label, position = "above", next }) {
  const { name, icon } = places[spot];
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "map-marker";
  marker.dataset.spot = spot;
  marker.dataset.position = position;
  const caption = document.createElement("span");
  caption.className = "marker-label";
  caption.textContent = label ?? name;
  const pin = document.createElement("span");
  pin.className = "marker-pin";
  const image = document.createElement("img");
  image.alt = "";
  image.src = sprites.getIconDataUrl(icon, 2);
  pin.append(image);
  marker.append(caption, pin);

  if (next) {
    marker.setAttribute("aria-label", `${caption.textContent}の地図を表示`);
  } else {
    marker.setAttribute("aria-controls", panel.id);
    marker.setAttribute("aria-pressed", "false");
  }
  if (routePlans[currentView]?.[spot]) {
    marker.addEventListener("focus", () => {
      if (selectedSpot !== spot && marker.matches(":focus-visible"))
        selectSpot(spot);
    });
  }
  marker.addEventListener("click", (event) => {
    if (next) {
      showView(next);
      if (event.detail === 0) back.focus({ preventScroll: true });
    } else if (
      event.detail === 0 &&
      selectedSpot === spot &&
      routePlans[currentView]?.[spot]
    ) {
      selectSpot(spot);
    } else {
      selectSpot(selectedSpot === spot ? undefined : spot);
    }
  });
  return marker;
}

function showView(view) {
  const changed = view !== currentView;
  const animate = changed && !reducedMotion.matches;
  clearTimeout(transitionTimer);
  map.toggleAttribute("data-animating", animate);
  currentView = view;
  map.dataset.view = view;
  back.hidden = view === "overview";
  markers.replaceChildren(...views[view].pins.map(createMarker));
  selectSpot({ local: "campus", trip: "miyajima" }[view]);
  positionMap();

  if (animate) {
    markers.getAnimations().forEach((animation) => animation.cancel());
    markers.animate([{ opacity: 0 }, { opacity: 1 }], {
      delay: 240,
      duration: 360,
      easing: "ease-out",
      fill: "backwards",
    });
    transitionTimer = window.setTimeout(
      () => map.removeAttribute("data-animating"),
      640,
    );
  }
}

back.addEventListener("click", (event) => {
  const previous = currentView === "local" ? "itsukaichi" : "miyajima";
  showView("overview");
  if (event.detail === 0)
    markers.querySelector(`[data-spot="${previous}"]`).focus();
});

function closePanel() {
  const marker = markers.querySelector(`[data-spot="${selectedSpot}"]`);
  marker?.focus({ preventScroll: true });
  selectSpot();
}

panel.querySelector(".spot-close").addEventListener("click", closePanel);
section.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel.hidden) {
    event.stopPropagation();
    closePanel();
  }
});

map.addEventListener("click", (event) => {
  if (currentView !== "overview" || event.target.closest("button, a")) return;
  const radius = Math.min(96, Math.max(36, map.clientWidth * 0.09));
  const nearby = views.overview.pins.find(({ spot, next }) => {
    if (!next) return false;
    const pin = markers.querySelector(`[data-spot="${spot}"] .marker-pin`);
    const { left, top, width, height } = pin.getBoundingClientRect();
    const dx = event.clientX - (left + width / 2);
    const dy = event.clientY - (top + height / 2);
    return Math.hypot(dx, dy) <= radius;
  });
  if (nearby) showView(nearby.next);
});

renderMaps({ includeBoats: false });
showView("overview");
new ResizeObserver(positionMap).observe(map);
animateSea(
  map,
  {
    overview: overviewScene.querySelector(".sea-layer"),
    local: localScene.querySelector(".sea-layer"),
  },
  reducedMotion,
);
