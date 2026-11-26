/* 16-bit Super Famicom (SNES) style pixel-art sprite library for GGJ Setouchi Access Map */
(() => {
  const ns = (window.GGJAccessMap = window.GGJAccessMap || {});

  // Cohesive 16-bit SNES RPG palette inspired by classic coastal/mountain world maps
  const PAL = {
    ".": null,
    // Outlines & deep shadows
    k: "#14262e", // deep dark slate-teal outline
    n: "#1d3540", // secondary dark outline
    s: "#263847", // building dark outline

    // Greens (foliage, pine, deciduous, bright highlights)
    d: "#184f2f", // darkest pine shadow
    p: "#266e39", // pine body
    g: "#3b8f3e", // mid forest green
    l: "#63b744", // sunlit grass/canopy
    y: "#96d958", // bright lime highlight
    m: "#75aa53", // muted meadow green

    // Sakura & blossoms
    P: "#f59bb8", // mid sakura pink
    L: "#ffd2e2", // sakura highlight
    D: "#c85b83", // sakura shadow

    // Wood & earth & rocks
    t: "#593b25", // trunk dark
    b: "#7c5432", // trunk/wood mid
    e: "#a67c52", // light wood/path
    R: "#4e4942", // rock dark
    r: "#7f7768", // rock mid
    C: "#b4aa93", // rock light
    S: "#ede1ba", // sand / stone pavement

    // Architecture walls & roofs
    w: "#fbf4dc", // warm cream stucco
    W: "#ded5bc", // shaded cream wall
    X: "#f7f8fa", // bright crisp white facade (Nexus21 wings)
    Z: "#c7d0da", // cool gray-white shaded wing (Nexus21 side)
    z: "#96a3b0", // deep precast shadow
    G: "#aab4bd", // concrete gray
    H: "#74818e", // shaded concrete
    c: "#51a9cf", // glass cyan
    Q: "#8ad4ce", // mint-teal curtain-wall glass highlight (Nexus21)
    q: "#68ced6", // foam/wake
    J: "#4b9896", // mint-teal curtain-wall mid glass (Nexus21)
    j: "#2e6168", // mint-teal curtain-wall mullion/shadow (Nexus21)
    B: "#2d6ca8", // bright blue glass/roof
    N: "#1f4772", // deep navy roof/trim
    T: "#c8573c", // terracotta roof/annex
    h: "#9e442c", // dark terracotta shadow (Nexus21 circular wing)
    O: "#e67c4f", // bright orange/terracotta highlight
    M: "#4b8b5b", // moss green roof
    V: "#d94a38", // vermilion (torii/shrine/red wing)
    v: "#962921", // dark vermilion
    Y: "#ffd447", // gold/yellow accent
    u: "#f0a629", // amber/gold shadow

    // Water & boat & steam
    a: "#259ab0", // teal water
    f: "#ffffff", // crisp white
  };

  function makeCanvas(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  function bakeMatrix(rows, customPal) {
    const h = rows.length;
    const w = rows[0].length;
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const pal = customPal ? { ...PAL, ...customPal } : PAL;
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        const col = pal[ch];
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return canvas;
  }

  // ---- Sprite Definitions (SNES 1px dark outlines + crisp top-left sunlit shading) ----
  const DEFS = {
    // 1. Nature: Pines, Deciduous Trees, Sakura, Cliffs, Islets, Paddies, Waterfall
    pineTall: [
      "....kk....",
      "...kygk...",
      "...kggk...",
      "..kypggk..",
      "..kgpppk..",
      ".kylgpppk.",
      ".kggppddk.",
      "kylggppddk",
      "kgggpppddk",
      ".kkpdddkk.",
      "...kbtk...",
      "...kbtk...",
      "....kk....",
    ],
    pineMed: [
      "...kk...",
      "..kygk..",
      "..kpgk..",
      ".kylppk.",
      ".kggpdk.",
      "kyggppdk",
      "kpppdddk",
      ".kkbtkk.",
      "...kk...",
    ],
    pineCluster: [
      "....kk....kk...",
      "...kygk..kpgk..",
      "..kyggpkkyggpk.",
      ".kggppdklggppdk",
      "kyggppdkggppddk",
      "kpppdddkpppdddk",
      ".kkbtkk..kkbtk.",
      "...kk......kk..",
    ],
    oakBright: [
      "...kkkk...",
      ".kkylllgk.",
      "kyylllggpk",
      "kyllggggdk",
      "klgggppddk",
      ".kppddddk.",
      "..kkbtkk..",
      "...kbtk...",
      "....kk....",
    ],
    oakMid: [
      "..kkkk..",
      ".kyllgk.",
      "kylggppk",
      "klggppdk",
      "kgppdddk",
      ".kkbtkk.",
      "..kbtk..",
      "...kk...",
    ],
    oakDark: [
      "..kkkk..",
      ".kglppk.",
      "kggppddk",
      "kgppdddk",
      ".kddddk.",
      "..kbtk..",
      "...kk...",
    ],
    sakuraLarge: [
      "...kkkkk...",
      ".kkLLLPPLk.",
      "kLLLPPPPPDk",
      "kLLPPPPDDDk",
      "kLPPPDDDDDk",
      ".kPPDDDDkk.",
      "..kkbtkk...",
      "...kbtk....",
      "....kk.....",
    ],
    sakuraSmall: [
      "..kkkk..",
      ".kLLPPk.",
      "kLLPPPDk",
      "kPPPDDDk",
      ".kPDDkk.",
      "..kbtk..",
      "...kk...",
    ],
    cliffRock: [
      "..kkkkkk...",
      ".kCCrCCrk..",
      "kCCrrrRRrk.",
      "kCrrRRRRRrk",
      "kRrRRRRRRRk",
      ".kkkkkkkkk.",
    ],
    seaRock: ["..kkkk..", ".kCCrrk.", "kCrRRRr.", "qkkkkkkq"],
    seaIslet: [
      ".....kkkkkk.....",
      "...kkllllgpk....",
      "..klllgpppddk...",
      ".kCllgppddddrk..",
      "kSSrrrrrrrrSSSk.",
      "qqkkkkkkkkkkkqq.",
    ],
    paddyField: [
      "kkkkkkkkkkkk",
      "kllmaaallmak",
      "keellmaaallk",
      "kllmaaallmak",
      "kkkkkkkkkkkk",
    ],
    waterfall: ["kRRqfRRk", "kRqffqRk", "kRqfqqRk", "kqqffqqk", "qqqffqqq"],

    // 2. Urban & Residential Variety (Japanese roofs, apartments, commercial, towers)
    houseBlue: [
      "..kkkkkkkk..",
      ".kBBBBBBBBk.",
      "kBBNNNNNNNNk",
      "kBwwwwwwwwBk",
      "k.kwcwwcwk.k",
      "k.kwwttwwk.k",
      "..kkkkkkkk..",
    ],
    houseRed: [
      "..kkkkkkkk..",
      ".kOOOOOOOTk.",
      "kOOTTTTTTTTk",
      "kTwwwwwwwwTk",
      "k.kwcwwcwk.k",
      "k.kwwttwwk.k",
      "..kkkkkkkk..",
    ],
    houseNavy: [
      ".kkkkkkkk.",
      "kBBBBNNNNk",
      "kBwwwwwwNk",
      "k.kwcwtw.k",
      "k.kwwwww.k",
      ".kkkkkkkk.",
    ],
    houseGreen: [
      ".kkkkkkkk.",
      "kllMMMMMMk",
      "klwwwwwwMk",
      "k.kwcwtw.k",
      "k.kwwwww.k",
      ".kkkkkkkk.",
    ],
    shopA: [
      "kkkkkkkkkk",
      "kGGGGGGGGk",
      "kVVffVVffk",
      "kwwccwwcck",
      "kwwttwwcck",
      "kkkkkkkkkk",
    ],
    shopB: [
      "kkkkkkkkkk",
      "kBBBBBBBBk",
      "kYYccYYcck",
      "kwwwwwwwwk",
      "kwwttwcwck",
      "kkkkkkkkkk",
    ],
    mansionSmall: [
      ".kkkkkkkkkk.",
      "kGGGGGGGGGGk",
      "kwwcwwcwwcwk",
      "kWWcWWcWWcWk",
      "kwwcwwcwwcwk",
      "kWWcwwtwWWck",
      "kkkkkkkkkkkk",
    ],
    mansionWide: [
      ".kkkkkkkkkkkkkk.",
      "kGGGGGGGGGGGGGGk",
      "kwwcwwcwwcwwcwwk",
      "kWWcWWcWWcWWcWWk",
      "kwwcwwcwwcwwcwwk",
      "kWWcWWcttWWcWWck",
      "kkkkkkkkkkkkkkkk",
    ],
    officeA: [
      ".kkkkkkkk.",
      "kXwwXXwwZk",
      "kXccXXccZk",
      "kXwwXXwwZk",
      "kXccXXccZk",
      "kXwwXXwwZk",
      "kXccXXccZk",
      "kHHkttkHHk",
      "kkkkkkkkkk",
    ],
    officeB: [
      ".kkkkkkkk.",
      "kSSSSSSSSk",
      "kWccWWccWk",
      "kGwwGGwwGk",
      "kWccWWccWk",
      "kGwwGGwwGk",
      "kWccWWccWk",
      "kHHkttkHHk",
      "kkkkkkkkkk",
    ],
    officeGlass: [
      "..kkkkkk..",
      ".kGGGGGGk.",
      "kXQJJJJQXk",
      "kXjQQQQjXk",
      "kXQJJJJQXk",
      "kXjQQQQjXk",
      "kZccccccZk",
      "kHHkttkHHk",
      "kkkkkkkkkk",
    ],
    towerA: [
      "..kkkkkk..",
      ".kSSSSSSk.",
      ".kXXccXXk.",
      "kXXcGGcZZk",
      "kXXcwwcZZk",
      "kXXcGGcZZk",
      "kXXcwwcZZk",
      "kXXcGGcZZk",
      "kXXcwwcZZk",
      "kHHkttkHHk",
      "kkkkkkkkkk",
    ],
    towerB: [
      "...kkkk...",
      "..kTTTTk..",
      ".kXXXXXXk.",
      ".kXccXXZk.",
      "kXXccXXZZk",
      "kWWccWWZZk",
      "kXXccXXZZk",
      "kWWccWWZZk",
      "kXXccXXZZk",
      "kHHkttkHHk",
      "kkkkkkkkkk",
    ],
    warehouse: [
      ".kkkkkkkkkkkk.",
      "kGGGGGGGGGGGGk",
      "kHHHHHHHHHHHHk",
      "kGGGGGGGGGGGGk",
      "kGGHkkkkkkHGGk",
      "kkkkkkkkkkkkkk",
    ],
    aeonMall: [
      "..kkkkkkkkkkkkkkkk..",
      ".kPPPPGGGGGGGGPPPPk.",
      "kPPffPPffGGGGGGGGGGk",
      "kwwwwwwcwcwcwcwcwwwk",
      "kWWcWWcwcwcwcwcWWcWk",
      "kkkkkkkkkkkkkkkkkkkk",
    ],

    // 3. Hero Landmarks (Accurate Hiroshima, HIT Campus, Itsukaichi, Miyajima landmarks)
    hiroshimaCastle: [
      "..........kYYk..........",
      "..........kGGk..........",
      "........kkGGGGkk........",
      ".......kGGwwwwGGk.......",
      "......kkGGGGGGGGkk......",
      ".....kGGGwwwwwwGGGk.....",
      "....kkGGGGGGGGGGGGkk....",
      "...kGGGwwwwwwwwwwGGGk...",
      "..kGGGGGGGGGGGGGGGGGGk..",
      ".kGGwwwcwcwwwwcwcwwwGGk.",
      "krrrrrrrrrrrrrrrrrrrrrrk",
      "kRRrrRRrCRRrCRrRRrRRrRRk",
      ".kkkkkkkkkkkkkkkkkkkkkk.",
    ],
    abombDome: [
      ".....kkkk.....",
      "...kkrkkrkk...",
      "..krrkrrkrrk..",
      ".kkOOOOOOOOkk.",
      "kOOTTTTTTTTOOk",
      "kTTwwkTTkwwTTk",
      "kTTkwwTTwwkTTk",
      "kTTTTTTTTTTTTk",
      "kkkkkkkkkkkkkk",
    ],
    hiroshimaStation: [
      "..kkkkkkkkkkkkkkkkkkkkkkkk..",
      ".kGGGGGGGGGGGGGGGGGGGGGGGGk.",
      "kBBccccccccccccccccccccccBBk",
      "kwwwGwwGwwGYYffYYGwwGwwGwwwk",
      "kHHHkttkHHHkcccckHHHkttkHHHk",
      "kkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    ],
    hitCampusOverview: [
      "...kkkkkkkkkkkkkk.................",
      "..kXkkQQJJQQkkXXZk................",
      ".kXjXkQJJJJQkXjXZZk...............",
      ".kXjXkjjjjjjkXjXZZk...............",
      ".kXjXkQQJJQQkXjXZZk...kkkkkk......",
      ".kXjXkQJJJJQkXjXZZk..kXXXXXXk.....",
      ".kXjXkjjjjjjkXjXZZkkkkXccXccZk....",
      ".kXjXkQQJJQQkXjXZZZZkkkkkkXXZk....",
      ".kXjXkQJJJJQkXjXkTTTfXfXfTTkkk....",
      ".kXjXkjjjjjjkXjXkOTTTTTTTTTThk....",
      ".kXXkkjkkkkjkXZZkTTkkTTTTTTThk....",
      ".kSSkkjkkkkjkSSZkOThhTTTTTTThk....",
      "..kkkkkkkkkkkkkkkkkkkkkkkkkkkk....",
    ],
    hitNexus21: [
      "....kkkkkkkkkkkkkkkkkkkkk.....................",
      "..kGGGGGGGGGGGGGGGGGGGGGGZk...................",
      ".kXXkQQJJQQJJQQkXXjXjXjXZZZk..................",
      ".kXjXkQJJQQJJQkXXjXjXjXjXZZk..................",
      ".kXjXkjjjjjjjjkXXjXjXjXjXZZk..................",
      ".kXjXkQQJJQQJJQkXXjXjXjXZZZk........kkkkkkk...",
      ".kXjXkQJJQQJJQkXXjXjXjXjXZZk.......kXXXXXXXk..",
      ".kXjXkjjjjjjjjkXXjXjXjXjXZZk.......kXjXjXjXZk.",
      ".kXjXkQQJJQQJJQkXXjXjXjXZZZk.......kXXXXXXXZk.",
      ".kXjXkQJJQQJJQkXXjXjXjXjXZZk.kkkk..kXjXjXjXZk.",
      ".kXjXkjjjjjjjjkXXjXjXjXjXZZkkTTTTkkXXXXXXXXZk.",
      ".kXjXkQQJJQQJJQkXXjXjXjXZkkOOffffffTTTkjXjXZk.",
      ".kXjXkQJJQQJJQkXXjXjXjXkkOOTTTTTTTTTTThkXXXZk.",
      ".kXjXkjjjjjjjjkXXjXjXkkOOTfXfXfXfXfXTTThkZZZk.",
      ".kXXkkjjjjjjjjkXXjXkkOOTTTTTTTTTTTTTTTThkkkkk.",
      ".kSSkjkHkkkHjkXSSkkOOTTTTkkTTTTTTTkkTTThk.....",
      ".kSSkjkHkkkHjkXSSkOOTTTTkhhkTTTTTkhhkTThk.....",
      "..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.....",
    ],
    hitNew4: [
      "..kkk.............................",
      ".kYYYk............................",
      ".kYYk.............................",
      "..k..kkkkkkkkkkkkkkkkkkkkkkkkkk...",
      "..k.kXQQJJQQXXXXXXXXXXQQJJQQXXZk..",
      "..k.kXjjjjjjXjjXjjXjjXjjjjjjXXZk..",
      "..kkkXQQJJQQXXXXXXXXXXQQJJQQXXZk..",
      "..kXXwwwwwwwwXjjXjjXjjXXXXXXXXZk..",
      "..kZZkttkZZZkXkkkkkkXZZkttkZZZZk..",
      "..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..",
    ],
    hitGate: [
      "kk..........kk",
      "kCk........kCk",
      "kCk.kkkkkk.kCk",
      "kCk.kSSSSk.kCk",
      "kkk.kSSSSk.kkk",
    ],
    honoyuOnsen: [
      "......f...f.......",
      ".....f.....f......",
      "...kkkkkkkkkkkk...",
      "..kNNNNNNNNNNNNk..",
      ".kNNTTTTTTTTTTNNk.",
      "kNNwwwwwwwwwwwwNNk",
      "kwwkBBkwwwwkBBkwwk",
      "kWWkBBkSSSSkBBkWWk",
      "kkkkkkkkkkkkkkkkkk",
    ],
    kaikatsuBuilding: [
      "..kkkkkkkkkk..",
      ".kBBBBBBBBBBk.",
      "kBYYffYYffYYBk",
      "kBwwccwwccwwBk",
      "kGwwccwwccwwGk",
      "kHwwccwwccwwHk",
      "kGwwccwwccwwGk",
      "kHHkcckkcckHHk",
      "kkkkkkkkkkkkkk",
    ],
    stationItsukaichi: [
      "..kkkkkkkkkkkkkkkkkkkk..",
      ".kBBBBGGGGGGGGGGGGBBBBk.",
      "kBccccccccccccccccccccBk",
      "kwwwGYYffYYGwwwwGwwwGwwk",
      "kHHHkcccccckHHHHktttkHHk",
      "kkkkkkkkkkkkkkkkkkkkkkkk",
    ],
    stationRakurakuen: [
      "..kkkkkkkkkkkkkk..",
      ".kMMMMGGGGGGMMMMk.",
      "kMwwwwYYffYYwwwwMk",
      "kWWcWWkcccckWWcWWk",
      "kkkkkkkkkkkkkkkkkk",
    ],
    miyajimaTorii: [
      "..kkkkkkkkkkkkkk..",
      ".kVVVVVVVVVVVVVVk.",
      "kVVvvvvvvvvvvvvVVk",
      "..kkVV......VVkk..",
      "...kVVVVVVVVVVk...",
      "...kVV......VVk...",
      "...kVv......vVk...",
      "...kVv......vVk...",
      "..qkvvkq..qkvvkq..",
    ],
    itsukushimaShrine: [
      "....kkkkkkkkkkkkkkkkkkkk....",
      "..kkVVVVVVVVVVVVVVVVVVVVkk..",
      ".kVVwwwwwwwwwwwwwwwwwwwwVVk.",
      "kVVvvvvvvvvvvvvvvvvvvvvvvVVk",
      "kVV..kVV..kVV..kVV..kVV..VVk",
      "qkkkkkkkkkkkkkkkkkkkkkkkkkkq",
    ],
    miyajimaPagoda: [
      "....kk....",
      "...kYYk...",
      "..kkVVkk..",
      ".kVVvvVVk.",
      "..kVVVVk..",
      ".kVVvvVVk.",
      "..kVVVVk..",
      ".kVVvvVVk.",
      "..kVVVVk..",
      ".kVVvvVVk.",
      "..kwwwwk..",
      "..kkkkkk..",
    ],
    ferryTerminal: [
      "..kkkkkkkkkkkkkkkk..",
      ".kBBBBBBBBBBBBBBBBk.",
      "kBwwwwcwcwcwcwcwwwBk",
      "kGwwwwkcccccckwwwwGk",
      "kSSSSSkSSSSSSkSSSSSk",
      "qqkkkkkkkkkkkkkkkkqq",
    ],

    // 4. Vehicles & Living Details
    hirodenTram: [
      "....kkkkk.....",
      "...k.k.k.k....",
      ".kkkkkkkkkkkk.",
      "kllffllffllffk",
      "klcwwlcwwlcwwk",
      "kggggggggggggk",
      ".kk.kk..kk.kk.",
    ],
    jrTrain: [
      ".kkkkkkkkkkkkkk.",
      "kVVGGGGGGGGGGVVk",
      "kVcwwcwwcwwcwwVk",
      "kVVGGGGVVGGGGVVk",
      ".kk..kk..kk..kk.",
    ],
    localBus: [
      ".kkkkkkkkkk.",
      "kffBBBBBBffk",
      "kBccBccBccBk",
      "kBBBBBBBBBBk",
      ".kk......kk.",
    ],
    miyajimaFerry: [
      "....kkkk....",
      "..kkffffkk..",
      ".kfccfccfck.",
      "kffffffffffk",
      "kVVVVVVVVVVk",
      "qkkkkkkkkkkq",
    ],
    sailboatLarge: [
      "....k....",
      "...kfk...",
      "..kffk...",
      ".kfffk...",
      ".kfffk...",
      "kSSSSSk..",
      "qkVVVkq..",
      "qqkkkqq..",
    ],
    sailboatSmall: ["...k...", "..kfk..", ".kffk..", "kSSSk..", "qkkkq.."],
    fishingBoat: ["...kk...", "..kffk..", "kSSSSSk.", "qkkkkkq."],
    harborCrane: ["kkkkkk..", "kO..k...", "k...k...", "k...k...", "k..kkk.."],
  };

  // Dedicated 16x16 UI pixel-art icons (used on markers & bottom access instruction cards)
  const ICON_DEFS = {
    tram: [
      ".....kkkkkk.....",
      "....k.k..k.k....",
      ".....kkkkkk.....",
      "...kkkkkkkkkk...",
      "..kllllllllllk..",
      "..klffllllfflk..",
      "..klcccllccclk..",
      "..kllllllllllk..",
      "..kffffffffffk..",
      "..kggYYggYYggk..",
      "..kggggggggggk..",
      "...kkkkkkkkkk...",
      "....kk....kk....",
      "...kSSkkkkSSk...",
    ],
    bus: [
      "...kkkkkkkkkk...",
      "..kBBBBBBBBBBk..",
      "..kBffffffffBk..",
      "..kBccccccccBk..",
      "..kBccccccccBk..",
      "..kBBBBBBBBBBk..",
      "..kBYffffffYBk..",
      "..kBBBBBBBBBBk..",
      "..kNNk....kNNk..",
      "...kk......kk...",
    ],
    flag: [
      "...kk...........",
      "..kYYk..........",
      "..kYYkkkkkkkk...",
      "..kYYkYYYYYYYk..",
      "..kYYkYYffYYkk..",
      "..kYYkYYYYYYk...",
      "..kYYkkkkkkkk...",
      "..kYYk..........",
      "..kYYk..........",
      "..kYYk..........",
      ".kSSSSk.........",
      "kSSSSSSk........",
      "kkkkkkkk........",
    ],
    station: [
      "..kkkkkkkkkkkk..",
      ".kBBBBBBBBBBBBk.",
      "kBccccccccccccBk",
      "kBwwYYffffYYwwBk",
      "kGGwwwccccwwwGGk",
      "kHHkcckHHkcckHHk",
      "kkkkkkkkkkkkkkkk",
    ],
    onsen: [
      "...f...f...f....",
      "..f...f...f.....",
      "...f...f...f....",
      ".kkkkkkkkkkkkkk.",
      "kVVVVVVVVVVVVVVk",
      "kVffffffffffffVk",
      "kVffaaaffffaaafk",
      "kVffaaaffffaaafk",
      ".kkkkkkkkkkkkkk.",
    ],
    cafe: [
      "..kkkkkkkkkk....",
      ".kYYYYYYYYYYk...",
      ".kYYccccccYYk...",
      "kNNNNNNNNNNNN...",
      "kNffffffffffNkk.",
      "kNfaaaaaaaafN.k.",
      "kNfaaaaaaaafNkk.",
      "kNffffffffffNk..",
      ".kkkkkkkkkkkk...",
    ],
    ferry: [
      ".....kkkk.......",
      "...kkffffkk.....",
      "..kfccffccfk....",
      ".kffffffffffk...",
      "kVVVVVVVVVVVVk..",
      "qqkkkkkkkkkkqq..",
    ],
    torii: [
      ".kkkkkkkkkkkkkk.",
      "kVVVVVVVVVVVVVVk",
      ".kkVVvvvvvvVVkk.",
      "...kVVVVVVVVk...",
      "...kVV....VVk...",
      "...kVV....VVk...",
      "..kVVk....kVVk..",
      "..qqqq....qqqq..",
    ],
    gate: [
      ".kkk........kkk.",
      "kSSSk......kSSSk",
      "kSSSkkkkkkkkSSSk",
      "kSSSkGkkGGkkSSSk",
      "kSSSkGkkGGkkSSSk",
      "kSSSkkkkkkkkSSSk",
      "kkkkk......kkkkk",
    ],
    nexus: [
      "..kkkkkkkkkk....",
      ".kXQQJQQkXXZk...",
      ".kXjjjjjkXjZk...",
      ".kXQQJQQkXjZk...",
      ".kXjjjjjkXkkk...",
      ".kXQQJQQkTTTfk..",
      ".kXjjjjjkTTTThk.",
      ".kXXkkkkkTkkThk.",
      "..kkkkkkkkkkkk..",
    ],
  };

  const FOLIAGE_SPRITES = new Set([
    "pineTall",
    "pineMed",
    "pineCluster",
    "oakBright",
    "oakMid",
    "oakDark",
    "sakuraLarge",
    "sakuraSmall",
  ]);
  const FOLIAGE_PAL = { k: "#174027" };

  const cache = {};
  function getSprite(name) {
    if (!cache[name]) {
      const def = DEFS[name];
      if (!def) throw new Error(`Unknown sprite: ${name}`);
      cache[name] = bakeMatrix(
        def,
        FOLIAGE_SPRITES.has(name) ? FOLIAGE_PAL : null,
      );
    }
    return cache[name];
  }

  const iconCache = {};
  function getIconDataUrl(name, pixelScale = 2) {
    const key = `${name}:${pixelScale}`;
    if (!iconCache[key]) {
      const def = ICON_DEFS[name];
      if (!def) throw new Error(`Unknown icon: ${name}`);
      const raw = bakeMatrix(def);
      const pad = 2;
      const out = makeCanvas(
        (raw.width + pad * 2) * pixelScale,
        (raw.height + pad * 2) * pixelScale,
      );
      const ctx = out.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        raw,
        pad * pixelScale,
        pad * pixelScale,
        raw.width * pixelScale,
        raw.height * pixelScale,
      );
      iconCache[key] = out.toDataURL();
    }
    return iconCache[key];
  }

  ns.sprites = {
    PAL,
    getSprite,
    getIconDataUrl,
    names: Object.keys(DEFS),
  };
})();
