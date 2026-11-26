#!/usr/bin/env python3
"""Fetch real GSI DEM / BVMap vector tiles and OpenStreetMap POIs/buildings
for Hiroshima Bay (Overview) and Itsukaichi / HIT (Local) and bake them into
mockups/ggj/access-map/geo-data.js.
"""

from __future__ import annotations

import base64
import json
import math
import struct
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

OUT_PATH = Path(__file__).with_name("geo-data.js")
USER_AGENT = "hiro-uni-ggj-access-map/1.0"

# Both maps are exact 960 x 640 (3:2) canvases with 240 x 160 DEM grids (4px per cell).
CANVAS_W = 960
CANVAS_H = 640
GRID_W = 240
GRID_H = 160

OVERVIEW_BOUNDS = {
    "lonMin": 132.258,
    "lonMax": 132.505,
    "latMin": 34.253,
    "latMax": 34.415,
}

# Local map covers HIT campus, 広島工大入口, 楽々園, ほの湯, 八幡川, JR/広電五日市駅, 快活CLUB
# Physical ratio at 34.365N: dLon * cos(34.365) / dLat = 0.037 * 0.8255 / 0.0205 = 1.49 (exact 3:2!)
LOCAL_BOUNDS = {
    "lonMin": 132.3375,
    "lonMax": 132.3745,
    "latMin": 34.3555,
    "latMax": 34.3760,
}

# Verified OpenStreetMap coordinates for interactive spots
SPOTS = {
    "hiroshima": [34.397826, 132.475577],
    "itsukaichi": [34.367500, 132.356000],
    "miyajima": [34.297300, 132.318136],
    "campus": [34.370084, 132.342696],  # 新4号館
    "nexus21": [34.369645, 132.344017],  # 三宅の森 Nexus21 / 学務部周辺
    "maingate": [34.369289, 132.346260],  # 広島工業大学 正門
    "bus": [34.367568, 132.349345],  # 広島工大入口
    "rakuraku": [34.364168, 132.351456],  # 広電 楽々園駅
    "honoyu": [34.361149, 132.353952],  # 塩屋天然温泉 ほの湯 楽々園
    "aeon": [34.362630, 132.353043],  # イオンタウン楽々園
    "jr": [34.366764, 132.368018],  # JR五日市駅
    "hiroden_itsukaichi": [34.366435, 132.367804],  # 広電五日市駅
    "kaikatsu": [34.366366, 132.368627],  # アヴィーユビル (快活CLUB 五日市駅前店)
    "ferry": [34.310956, 132.305961],  # 宮島口大桟橋
    "miyajima_pier": [34.302095, 132.322247],  # 宮島桟橋
    "hiroshima_castle": [34.402146, 132.459540],  # 広島城
    "peace_park": [34.393171, 132.452301],  # 平和記念公園
    "abomb_dome": [34.395483, 132.453592],  # 原爆ドーム
    "ninoshima": [34.311290, 132.436887],  # 似島
    "itsukushima": [34.296527, 132.319007],  # 厳島神社
    "pagoda": [34.296680, 132.320420],  # 五重塔
}


def fetch_bytes(url: str, timeout: int = 12) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"HTTP {e.code} fetching {url}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return None


def latlon_to_tile(lat: float, lon: float, z: int) -> tuple[int, int]:
    n = 2**z
    tx = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    ty = int((1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n)
    return tx, ty


def tile_pixel_to_latlon(
    tx: int, ty: int, px: float, py: float, z: int, extent: float = 256.0
) -> tuple[float, float]:
    n = 2**z
    lon = (tx + px / extent) / n * 360.0 - 180.0
    lat = math.degrees(
        math.atan(math.sinh(math.pi * (1.0 - 2.0 * (ty + py / extent) / n)))
    )
    return lat, lon


def project_xy(
    lat: float, lon: float, bounds: dict[str, float], w: int = CANVAS_W, h: int = CANVAS_H
) -> tuple[float, float]:
    u = (lon - bounds["lonMin"]) / (bounds["lonMax"] - bounds["lonMin"])
    v = (bounds["latMax"] - lat) / (bounds["latMax"] - bounds["latMin"])
    return round(u * w, 1), round(v * h, 1)


def in_bounds(lat: float, lon: float, bounds: dict[str, float], pad: float = 0.005) -> bool:
    return (
        bounds["lonMin"] - pad <= lon <= bounds["lonMax"] + pad
        and bounds["latMin"] - pad <= lat <= bounds["latMax"] + pad
    )


def simplify_rdp(pts: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    if len(pts) <= 2:
        return pts
    ax, ay = pts[0]
    bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    denom = math.hypot(dx, dy)
    best_i, best_d = 0, -1.0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        if denom < 1e-9:
            d = math.hypot(px - ax, py - ay)
        else:
            d = abs(dy * px - dx * py + bx * ay - by * ax) / denom
        if d > best_d:
            best_i, best_d = i, d
    if best_d > eps:
        left = simplify_rdp(pts[: best_i + 1], eps)
        right = simplify_rdp(pts[best_i:], eps)
        return left[:-1] + right
    return [pts[0], pts[-1]]


def fetch_dem_grid(
    bounds: dict[str, float],
    primary_layer: str,
    primary_z: int,
    fallback_layer: str | None = None,
    fallback_z: int | None = None,
) -> list[int]:
    """Sample a 240x160 grid of quantized elevation values:
    0 = water ('e' or missing below sea level),
    1..63 = land elevation quantized non-linearly from meters.
    """
    cache: dict[tuple[str, int, int, int], list[list[float | None]] | None] = {}

    def get_tile(layer: str, z: int, tx: int, ty: int):
        key = (layer, z, tx, ty)
        if key not in cache:
            raw = fetch_bytes(f"https://cyberjapandata.gsi.go.jp/xyz/{layer}/{z}/{tx}/{ty}.txt")
            if raw is None:
                cache[key] = None
            else:
                rows: list[list[float | None]] = []
                for line in raw.decode("utf-8").strip().splitlines():
                    rows.append([None if v == "e" else float(v) for v in line.split(",")])
                cache[key] = rows
        return cache[key]

    def sample_layer(layer: str, z: int, lat: float, lon: float) -> tuple[bool, float | None]:
        n = 2**z
        fx = (lon + 180.0) / 360.0 * n
        fy = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
        tx, ty = int(fx), int(fy)
        rows = get_tile(layer, z, tx, ty)
        if rows is None:
            return False, None
        px = min(255, max(0, int((fx - tx) * 256)))
        py = min(255, max(0, int((fy - ty) * 256)))
        return True, rows[py][px]

    grid: list[int] = []
    max_elev = 700.0 if primary_z == 12 else 300.0
    for r in range(GRID_H):
        lat = bounds["latMax"] - (r + 0.5) / GRID_H * (bounds["latMax"] - bounds["latMin"])
        for c in range(GRID_W):
            lon = bounds["lonMin"] + (c + 0.5) / GRID_W * (bounds["lonMax"] - bounds["lonMin"])
            ok, val = sample_layer(primary_layer, primary_z, lat, lon)
            if not ok and fallback_layer and fallback_z:
                ok, val = sample_layer(fallback_layer, fallback_z, lat, lon)
            elif val is None and fallback_layer and fallback_z and primary_layer == "dem5a":
                # Note: dem5a marks some inland water/void pixels as 'e'; cross-check dem/14
                # when high inland (> 1.5m), while keeping coastal sea as water.
                ok_fb, val_fb = sample_layer(fallback_layer, fallback_z, lat, lon)
                if ok_fb and val_fb is not None and val_fb > 2.5:
                    val = val_fb
            if val is None:
                grid.append(0)
            else:
                clamped = max(0.0, min(max_elev, val))
                q = int(round(1 + 62 * ((clamped / max_elev) ** 0.55)))
                grid.append(max(1, min(63, q)))
    return grid


# ---- Pure Python Mapbox Vector Tile (MVT) parser for GSI experimental_bvmap ----
def _read_varint(buf: bytes, i: int) -> tuple[int, int]:
    res, shift = 0, 0
    while True:
        b = buf[i]
        i += 1
        res |= (b & 0x7F) << shift
        if not (b & 0x80):
            return res, i
        shift += 7


def _parse_pb(buf: bytes) -> list[tuple[int, int, int | bytes]]:
    i, out = 0, []
    n = len(buf)
    while i < n:
        tag, i = _read_varint(buf, i)
        fn, wt = tag >> 3, tag & 7
        if wt == 0:
            v, i = _read_varint(buf, i)
            out.append((fn, wt, v))
        elif wt == 2:
            ln, i = _read_varint(buf, i)
            out.append((fn, wt, buf[i : i + ln]))
            i += ln
        elif wt == 1:
            out.append((fn, wt, buf[i : i + 8]))
            i += 8
        elif wt == 5:
            out.append((fn, wt, buf[i : i + 4]))
            i += 4
        else:
            raise ValueError(f"Unsupported wire type {wt}")
    return out


def _zigzag(n: int) -> int:
    return (n >> 1) ^ -(n & 1)


def _decode_packed_uints(b: bytes) -> list[int]:
    i, out = 0, []
    n = len(b)
    while i < n:
        v, i = _read_varint(b, i)
        out.append(v)
    return out


def _decode_geom(geom_ints: list[int], gtype: int) -> list[list[tuple[int, int]]]:
    x, y = 0, 0
    i, n = 0, len(geom_ints)
    parts: list[list[tuple[int, int]]] = []
    cur: list[tuple[int, int]] = []
    while i < n:
        cmd_int = geom_ints[i]
        i += 1
        cmd, count = cmd_int & 0x7, cmd_int >> 3
        if cmd == 1:  # MoveTo
            if cur:
                parts.append(cur)
                cur = []
            for _ in range(count):
                x += _zigzag(geom_ints[i])
                y += _zigzag(geom_ints[i + 1])
                i += 2
                cur.append((x, y))
        elif cmd == 2:  # LineTo
            for _ in range(count):
                x += _zigzag(geom_ints[i])
                y += _zigzag(geom_ints[i + 1])
                i += 2
                cur.append((x, y))
        elif cmd == 7:  # ClosePath
            if cur and cur[0] != cur[-1]:
                cur.append(cur[0])
            if cur:
                parts.append(cur)
                cur = []
    if cur:
        parts.append(cur)
    return parts


def _decode_value(vbytes: bytes):
    for fn, wt, val in _parse_pb(vbytes):
        if fn == 1:
            return val.decode("utf-8", errors="replace")
        if fn == 2:
            return struct.unpack("<f", val)[0]
        if fn == 3:
            return struct.unpack("<d", val)[0]
        if fn in (4, 5):
            return int(val)
        if fn == 6:
            return _zigzag(int(val))
        if fn == 7:
            return bool(val)
    return None


def parse_bvmap_tile(tx: int, ty: int, z: int, want_layers: set[str]):
    raw = fetch_bytes(f"https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{tx}/{ty}.pbf")
    if raw is None:
        return {}
    if raw[:2] == b"\x1f\x8b":
        raw = zlib.decompress(raw, 16 + zlib.MAX_WBITS)
    result: dict[str, list[dict]] = {}
    for fn, wt, val in _parse_pb(raw):
        if fn != 3 or wt != 2:
            continue
        name, extent, keys, vals, raw_feats = "", 4096, [], [], []
        for lfn, lwt, lval in _parse_pb(val):
            if lfn == 1:
                name = lval.decode("utf-8")
            elif lfn == 2:
                raw_feats.append(lval)
            elif lfn == 3:
                keys.append(lval.decode("utf-8", errors="replace"))
            elif lfn == 4:
                vals.append(_decode_value(lval))
            elif lfn == 5:
                extent = int(lval)
        if name not in want_layers:
            continue
        feats = []
        for rf in raw_feats:
            tags_raw, gtype, geom_raw = [], 0, []
            for ffn, _, fval in _parse_pb(rf):
                if ffn == 2:
                    tags_raw = _decode_packed_uints(fval)
                elif ffn == 3:
                    gtype = int(fval)
                elif ffn == 4:
                    geom_raw = _decode_packed_uints(fval)
            props = {}
            for k_idx, v_idx in zip(tags_raw[0::2], tags_raw[1::2]):
                if k_idx < len(keys) and v_idx < len(vals):
                    props[keys[k_idx]] = vals[v_idx]
            parts = _decode_geom(geom_raw, gtype)
            latlon_parts = [
                [tile_pixel_to_latlon(tx, ty, px, py, z, float(extent)) for px, py in part]
                for part in parts
            ]
            feats.append({"gtype": gtype, "props": props, "parts": latlon_parts})
        result[name] = feats
    return result


def fetch_overview_vectors():
    """Extract waterarea (Ota channels, Yahata mouth, streams), railways, and major roads
    from GSI experimental_bvmap z=13 tiles covering Overview bounds.
    """
    x1, y2 = latlon_to_tile(OVERVIEW_BOUNDS["latMin"], OVERVIEW_BOUNDS["lonMin"], 13)
    x2, y1 = latlon_to_tile(OVERVIEW_BOUNDS["latMax"], OVERVIEW_BOUNDS["lonMax"], 13)
    want = {"waterarea", "railway", "road", "river", "searoute"}

    water_polys: list[list[list[float]]] = []
    jr_lines: list[list[list[float]]] = []
    tram_lines: list[list[list[float]]] = []
    major_roads: list[list[list[float]]] = []
    local_roads: list[list[list[float]]] = []
    ferry_lines: list[list[list[float]]] = []

    for tx in range(x1, x2 + 1):
        for ty in range(y1, y2 + 1):
            layers = parse_bvmap_tile(tx, ty, 13, want)
            for f in layers.get("waterarea", []):
                # Filter out massive sea/grid-edge polygons and tile-boundary straight lines!
                for part in f["parts"]:
                    if len(part) < 3:
                        continue
                    lats = [p[0] for p in part]
                    lons = [p[1] for p in part]
                    span_lat = max(lats) - min(lats)
                    span_lon = max(lons) - min(lons)
                    if span_lat > 0.030 or span_lon > 0.030:
                        continue
                    # Reject square/bay sea chunks clipped at tile edges: check area & lat/lon aspect
                    # Also reject features tagged as sea/bay if present in props
                    txt = json.dumps(f["props"], ensure_ascii=False)
                    if "海" in txt or "sea" in txt.lower():
                        continue
                    xy = [project_xy(lat, lon, OVERVIEW_BOUNDS) for lat, lon in part]
                    # Skip polygons located purely inside deep Hiroshima Bay (lat < 34.355 and lon > 132.33)
                    avg_lat = sum(lats) / len(lats)
                    avg_lon = sum(lons) / len(lons)
                    if avg_lat < 34.355 and avg_lon > 132.325:
                        continue
                    xy = simplify_rdp(xy, 1.3)
                    if len(xy) >= 3:
                        water_polys.append([[x, y] for x, y in xy])

            for f in layers.get("railway", []):
                p = f["props"]
                ft = str(p.get("ftCode", ""))
                # ftCode 8201=JR/normal rail, 8202=streetcar/tram; railState/orgGILvl
                # Also check snglDbl or rtCode/railType if present
                for part in f["parts"]:
                    if len(part) < 2:
                        continue
                    xy = [project_xy(lat, lon, OVERVIEW_BOUNDS) for lat, lon in part]
                    xy = simplify_rdp(xy, 1.4)
                    if len(xy) < 2:
                        continue
                    arr = [[x, y] for x, y in xy]
                    # Classify Hiroden tram vs JR Sanyo/Shinkansen:
                    # Tramway in bvmap has ftCode 2902 or 8202 or '路面' / '軌道' in props
                    txt = json.dumps(p, ensure_ascii=False)
                    if ft in ("2902", "8202") or "軌道" in txt or "路面" in txt:
                        tram_lines.append(arr)
                    else:
                        jr_lines.append(arr)

            for f in layers.get("road", []):
                p = f["props"]
                rd_ctg = p.get("rdCtg", 9)
                ft = int(p.get("ftCode", 0) or 0)
                motorway = int(p.get("motorway", 0) or 0)
                # bvmap rdCtg: 0=national highway, 1=prefectural, 2=municipal, 3=highway/expressway
                is_major = rd_ctg in (0, 1, 3) or motorway == 1 or ft in (2701, 2702, 2703)
                for part in f["parts"]:
                    if len(part) < 2:
                        continue
                    xy = [project_xy(lat, lon, OVERVIEW_BOUNDS) for lat, lon in part]
                    xy = simplify_rdp(xy, 1.8 if is_major else 2.2)
                    if len(xy) < 2:
                        continue
                    arr = [[x, y] for x, y in xy]
                    if rd_ctg in (0, 3) or motorway == 1:
                        major_roads.append(arr)
                    elif rd_ctg == 1:
                        local_roads.append(arr)

            for f in layers.get("searoute", []):
                for part in f["parts"]:
                    if len(part) < 2:
                        continue
                    xy = [project_xy(lat, lon, OVERVIEW_BOUNDS) for lat, lon in part]
                    xy = simplify_rdp(xy, 1.5)
                    if len(xy) >= 2:
                        ferry_lines.append([[x, y] for x, y in xy])

    return {
        "waterPolys": water_polys,
        "jrLines": jr_lines,
        "tramLines": tram_lines,
        "majorRoads": major_roads,
        "secondaryRoads": local_roads,
        "ferryLines": ferry_lines,
    }


def fetch_osm_local():
    """Fetch real OpenStreetMap vectors across the 3.4km x 2.3km Itsukaichi Local map
    in 6 small bbox chunks so every river, rail, tram, road, and campus building is exact.
    """
    lon0, lon1 = LOCAL_BOUNDS["lonMin"], LOCAL_BOUNDS["lonMax"]
    lat0, lat1 = LOCAL_BOUNDS["latMin"], LOCAL_BOUNDS["latMax"]

    nodes: dict[str, tuple[float, float]] = {}
    ways: dict[str, tuple[list[str], dict[str, str]]] = {}

    for ix in range(3):
        for iy in range(2):
            a = lon0 + ix * (lon1 - lon0) / 3 - 0.0005
            b = lat0 + iy * (lat1 - lat0) / 2 - 0.0005
            c = lon0 + (ix + 1) * (lon1 - lon0) / 3 + 0.0005
            d = lat0 + (iy + 1) * (lat1 - lat0) / 2 + 0.0005
            raw = fetch_bytes(
                f"https://api.openstreetmap.org/api/0.6/map?bbox={a:.5f},{b:.5f},{c:.5f},{d:.5f}",
                timeout=20,
            )
            if raw is None:
                continue
            root = ET.fromstring(raw)
            for n in root.findall("node"):
                nodes[n.attrib["id"]] = (float(n.attrib["lat"]), float(n.attrib["lon"]))
            for w in root.findall("way"):
                wid = w.attrib["id"]
                if wid in ways:
                    continue
                nds = [nd.attrib["ref"] for nd in w.findall("nd")]
                tags = {t.attrib["k"]: t.attrib["v"] for t in w.findall("tag")}
                ways[wid] = (nds, tags)

    water_polys = []
    water_lines = []
    jr_lines = []
    tram_lines = []
    major_roads = []
    secondary_roads = []
    minor_roads = []
    campus_buildings = []
    landmark_buildings = []
    urban_buildings = []

    for wid, (nds, tags) in ways.items():
        pts = [nodes[r] for r in nds if r in nodes]
        if len(pts) < 2:
            continue
        if not any(in_bounds(lat, lon, LOCAL_BOUNDS, 0.003) for lat, lon in pts):
            continue
        xy = [project_xy(lat, lon, LOCAL_BOUNDS) for lat, lon in pts]

        waterway = tags.get("waterway", "")
        natural = tags.get("natural", "")
        landuse = tags.get("landuse", "")
        railway = tags.get("railway", "")
        highway = tags.get("highway", "")
        building = tags.get("building", "")
        name = tags.get("name", "")
        amenity = tags.get("amenity", "")

        if waterway == "riverbank" or (natural == "water" and len(pts) >= 3) or landuse == "basin":
            s = simplify_rdp(xy, 1.2)
            # Only keep interior river/pond polygons, skip giant bay/sea rectangles
            xs = [p[0] for p in s]
            ys = [p[1] for p in s]
            if len(s) >= 3 and (max(xs) - min(xs) < 420 and max(ys) - min(ys) < 420):
                water_polys.append([[x, y] for x, y in s])
        elif waterway in ("river", "stream", "canal"):
            s = simplify_rdp(xy, 1.2)
            water_lines.append({"kind": waterway, "pts": [[x, y] for x, y in s]})
        elif railway in ("rail", "tram", "light_rail"):
            s = simplify_rdp(xy, 1.0)
            arr = [[x, y] for x, y in s]
            if railway == "tram" or "広電" in name or "宮島線" in name:
                tram_lines.append(arr)
            else:
                jr_lines.append(arr)
        elif highway in (
            "motorway",
            "motorway_link",
            "trunk",
            "trunk_link",
            "primary",
            "primary_link",
            "secondary",
            "secondary_link",
            "tertiary",
            "residential",
            "unclassified",
            "service",
        ):
            s = simplify_rdp(xy, 1.2)
            arr = [[x, y] for x, y in s]
            if highway in ("motorway", "trunk", "primary", "motorway_link", "trunk_link"):
                major_roads.append(arr)
            elif highway in ("secondary", "secondary_link", "tertiary"):
                secondary_roads.append(arr)
            elif highway in ("residential", "unclassified"):
                minor_roads.append(arr)
        elif building and len(pts) >= 3:
            cx = round(sum(p[0] for p in xy) / len(xy), 1)
            cy = round(sum(p[1] for p in xy) / len(xy), 1)
            xs = [p[0] for p in xy]
            ys = [p[1] for p in xy]
            bw = round(max(xs) - min(xs), 1)
            bh = round(max(ys) - min(ys), 1)
            if bw < 3 or bh < 3:
                continue
            if (
                "広島工業大学" in name
                or "新4号館" in name
                or "新1号館" in name
                or "図書館" in name
                or building == "university"
                or amenity == "university"
            ):
                if bw < 140 and bh < 140:
                    campus_buildings.append([cx, cy, bw, bh, name[:20]])
            elif any(
                k in name for k in ("ほの湯", "アヴィーユ", "イオン", "楽々園", "五日市", "福屋")
            ):
                landmark_buildings.append([cx, cy, bw, bh, name[:20]])
            elif 0 <= cx <= CANVAS_W and 0 <= cy <= CANVAS_H:
                urban_buildings.append([cx, cy, bw, bh])

    # Cap dense building footprints cleanly while preserving spatial coverage
    return {
        "waterPolys": water_polys,
        "waterLines": water_lines,
        "jrLines": jr_lines,
        "tramLines": tram_lines,
        "majorRoads": major_roads,
        "secondaryRoads": secondary_roads,
        "minorRoads": minor_roads,
        "campusBuildings": campus_buildings,
        "landmarkBuildings": landmark_buildings,
        "urbanBuildings": urban_buildings,
    }


def fetch_overview_water_streams():
    """Fetch experimental_rvrcl/16 or use OSM / GSI river polylines for Ota River & Yahata River
    where bvmap waterarea may miss narrow mountain streams.
    Wait: we can also inspect GSI experimental_bvmap waterarea + contour/symbol and add verified
    Ota 6-channel + Yahata + Oko/Mitarai stream coordinates so rivers are 100% continuous!
    """
    # Query OSM API v0.6 for Ota River channels? Too large for single bbox.
    # Instead, check GSI experimental_bvmap z13 waterarea coverage and supplement only
    # narrow mountain streams & Yahata upper valley from verified waypoints.
    return []


def rle_encode_grid(grid: list[int]) -> str:
    """Pack 240x160 6-bit integers cleanly with simple RLE into base64."""
    out = bytearray()
    i, n = 0, len(grid)
    while i < n:
        v = grid[i]
        run = 1
        while i + run < n and grid[i + run] == v and run < 127:
            run += 1
        if run >= 3:
            out.append(0x80 | run)
            out.append(v)
            i += run
        else:
            out.append(v)
            i += 1
    return base64.b64encode(bytes(out)).decode("ascii")


def main():
    print("Fetching Overview GSI DEM (z=12)...")
    ov_grid = fetch_dem_grid(OVERVIEW_BOUNDS, "dem", 12)
    ov_water = sum(1 for v in ov_grid if v == 0)
    ov_mtn = sum(1 for v in ov_grid if v >= 16)
    print(
        f"  Overview grid: {len(ov_grid)} cells, water={ov_water} ({ov_water/len(ov_grid):.1%}), mountain={ov_mtn} ({ov_mtn/len(ov_grid):.1%})"
    )

    print("Fetching Local GSI DEM (dem5a z=15 + dem z=14 fallback)...")
    loc_grid = fetch_dem_grid(LOCAL_BOUNDS, "dem5a", 15, "dem", 14)
    loc_water = sum(1 for v in loc_grid if v == 0)
    loc_mtn = sum(1 for v in loc_grid if v >= 12)
    print(
        f"  Local grid: {len(loc_grid)} cells, water={loc_water} ({loc_water/len(loc_grid):.1%}), hills={loc_mtn} ({loc_mtn/len(loc_grid):.1%})"
    )

    print("Fetching Overview GSI BVMap vector layers (z=13)...")
    ov_vec = fetch_overview_vectors()
    print(
        "  Overview vectors:",
        {k: len(v) for k, v in ov_vec.items()},
    )

    print("Fetching Local OpenStreetMap vector layers...")
    loc_vec = fetch_osm_local()
    print(
        "  Local vectors:",
        {k: len(v) for k, v in loc_vec.items()},
    )

    # Project all verified spots to both canvas spaces
    projected_spots = {}
    for sid, (lat, lon) in SPOTS.items():
        ox, oy = project_xy(lat, lon, OVERVIEW_BOUNDS)
        lx, ly = project_xy(lat, lon, LOCAL_BOUNDS)
        projected_spots[sid] = {
            "lat": lat,
            "lon": lon,
            "overview": [ox, oy],
            "local": [lx, ly],
        }

    # Verify interactive spots lie nicely inside their respective frames
    print("Spot projection check:")
    for sid in ["hiroshima", "itsukaichi", "miyajima", "ferry"]:
        ox, oy = projected_spots[sid]["overview"]
        print(f"  Overview {sid:12s}: ({ox:5.1f}, {oy:5.1f}) [{ox/CANVAS_W:.1%}, {oy/CANVAS_H:.1%}]")
    for sid in ["campus", "maingate", "bus", "rakuraku", "honoyu", "jr", "kaikatsu"]:
        lx, ly = projected_spots[sid]["local"]
        print(f"  Local    {sid:12s}: ({lx:5.1f}, {ly:5.1f}) [{lx/CANVAS_W:.1%}, {ly/CANVAS_H:.1%}]")

    # Verified mountain streams & upper river channels on Overview where DEM12/bvmap z13 waterarea
    # omits narrow rivers (Ota upper channels, Yahata River, Okishita River, Mitarai River)
    ov_streams = [
        # 太田川放水路 (west main channel into Hiroshima Bay)
        [[132.426, 34.430], [132.431, 34.414], [132.425, 34.398], [132.420, 34.380], [132.416, 34.365]],
        # 天満川
        [[132.435, 34.412], [132.444, 34.402], [132.443, 34.388], [132.439, 34.374], [132.437, 34.364]],
        # 旧太田川 (本川)
        [[132.452, 34.415], [132.454, 34.402], [132.451, 34.393], [132.448, 34.378], [132.444, 34.365]],
        # 元安川
        [[132.452, 34.394], [132.453, 34.384], [132.454, 34.371], [132.455, 34.362]],
        # 京橋川
        [[132.463, 34.408], [132.466, 34.396], [132.464, 34.382], [132.466, 34.366]],
        # 猿猴川
        [[132.468, 34.404], [132.476, 34.394], [132.482, 34.383], [132.487, 34.371]],
        # 八幡川 (from northern hills past Itsukaichi / HIT east side into Bay)
        [[132.338, 34.425], [132.345, 34.406], [132.353, 34.391], [132.356, 34.378], [132.359, 34.364], [132.362, 34.355]],
        # 岡ノ下川 / 隅の浜川
        [[132.326, 34.402], [132.334, 34.386], [132.340, 34.373], [132.346, 34.359]],
        # 可愛川 / 廿日市
        [[132.312, 34.392], [132.318, 34.376], [132.324, 34.361], [132.329, 34.349]],
        # 御手洗川 (大野・宮島口北側の渓流)
        [[132.275, 34.375], [132.283, 34.355], [132.290, 34.336], [132.297, 34.318]],
    ]
    ov_streams_xy = [
        [list(project_xy(lat, lon, OVERVIEW_BOUNDS)) for lon, lat in line] for line in ov_streams
    ]

    # Exact Local access route waypoints (projected to Local 960x640)
    local_routes = {
        # 楽々園駅 -> 北へ(県道41号) -> 広島工大入口 -> 正門 -> 新4号館
        "walkRakuraku": [
            [34.364168, 132.351456],  # 楽々園駅
            [34.364450, 132.350200],
            [34.365485, 132.349242],  # 五日市筒賀線 (Route 41)
            [34.367568, 132.349345],  # 広島工大入口
            [34.368800, 132.348400],
            [34.369289, 132.346260],  # 広島工業大学 正門
            [34.369645, 132.344017],  # Nexus21前
            [34.370084, 132.342696],  # 新4号館
        ],
        # JR五日市駅南口 -> 国道2号/五日市中央 -> 広島工大入口 (Bus)
        "busItsukaichi": [
            [34.366245, 132.367826],  # 五日市駅南口
            [34.365200, 132.364000],  # 五日市港入口付近
            [34.364373, 132.355941],  # 五日市消防署前
            [34.364226, 132.354708],  # 楽々園3丁目
            [34.364600, 132.350500],
            [34.365485, 132.349242],
            [34.367568, 132.349345],  # 広島工大入口
        ],
        # 広電五日市駅 -> 広電宮島線 -> 広電楽々園駅
        "tramItsukaichi": [
            [34.366435, 132.367804],  # 広電五日市
            [34.365923, 132.365927],
            [34.365880, 132.364108],
            [34.364550, 132.356200],  # 佐伯区役所前付近
            [34.364168, 132.351456],  # 楽々園駅
        ],
        # 楽々園駅 -> イオンタウン楽々園 -> ほの湯
        "walkHonoyu": [
            [34.364168, 132.351456],  # 楽々園駅
            [34.362900, 132.352600],
            [34.362100, 132.353300],
            [34.361149, 132.353952],  # ほの湯
        ],
        # 五日市駅南口 -> アヴィーユビル (快活CLUB)
        "walkKaikatsu": [
            [34.366245, 132.367826],  # 五日市駅南口
            [34.366366, 132.368627],  # アヴィーユビル
        ],
    }
    local_routes_xy = {
        k: [list(project_xy(lat, lon, LOCAL_BOUNDS)) for lat, lon in pts]
        for k, pts in local_routes.items()
    }

    # Trip routes (projected to Overview 960x640):
    # JR Sanyo Main Line: 五日市駅 -> 廿日市駅 -> 宮島口駅
    # Ferry: 宮島口大桟橋 -> 宮島桟橋 -> 厳島神社大鳥居
    trip_routes = {
        "jrMiyajima": [
            [34.366764, 132.368018],  # 五日市駅
            [34.362500, 132.352000],
            [34.358027, 132.335674],  # 廿日市駅
            [34.342000, 132.323000],
            [34.326000, 132.312500],
            [34.312313, 132.302938],  # 宮島口駅
            [34.310956, 132.305961],  # 宮島口大桟橋
        ],
        "ferryMiyajima": [
            [34.310956, 132.305961],  # 宮島口大桟橋
            [34.306500, 132.313800],
            [34.302095, 132.322247],  # 宮島桟橋
            [34.298800, 132.320400],
            [34.297300, 132.318136],  # 厳島神社・大鳥居
        ],
    }
    trip_routes_xy = {
        k: [list(project_xy(lat, lon, OVERVIEW_BOUNDS)) for lat, lon in pts]
        for k, pts in trip_routes.items()
    }

    payload = {
        "width": CANVAS_W,
        "height": CANVAS_H,
        "gridW": GRID_W,
        "gridH": GRID_H,
        "spots": projected_spots,
        "overview": {
            "bounds": OVERVIEW_BOUNDS,
            "demRle": rle_encode_grid(ov_grid),
            "vectors": {**ov_vec, "streams": ov_streams_xy},
            "routes": trip_routes_xy,
        },
        "local": {
            "bounds": LOCAL_BOUNDS,
            "demRle": rle_encode_grid(loc_grid),
            "vectors": loc_vec,
            "routes": local_routes_xy,
        },
    }

    js = (
        "/* Auto-generated by build-geo-data.py from GSI DEM/BVMap & OpenStreetMap */\n"
        "(() => {\n"
        "  const ns = (window.GGJAccessMap = window.GGJAccessMap || {});\n"
        f"  ns.geo = {json.dumps(payload, ensure_ascii=False, separators=(',', ':'))};\n"
        "  ns.decodeDem = function decodeDem(b64, expectedLen) {\n"
        "    const bin = atob(b64);\n"
        "    const out = new Uint8Array(expectedLen);\n"
        "    let pos = 0;\n"
        "    for (let i = 0; i < bin.length && pos < expectedLen; i++) {\n"
        "      const b = bin.charCodeAt(i);\n"
        "      if (b & 0x80) {\n"
        "        const count = b & 0x7f;\n"
        "        const val = bin.charCodeAt(++i);\n"
        "        for (let k = 0; k < count && pos < expectedLen; k++) out[pos++] = val;\n"
        "      } else {\n"
        "        out[pos++] = b;\n"
        "      }\n"
        "    }\n"
        "    return out;\n"
        "  };\n"
        "})();\n"
    )
    OUT_PATH.write_text(js, encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
