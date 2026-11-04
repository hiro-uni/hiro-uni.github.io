(() => {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const entryButton = header.querySelector(".nav-entry");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeBurst;
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) activeBurst?.();
  });
  document.getElementById("toggle-motion")?.addEventListener("click", () => {
    activeBurst?.();
  });

  function burstEntry() {
    if (
      reducedMotion.matches ||
      document.documentElement.dataset.motionPaused !== "false" ||
      !entryButton
    )
      return;
    activeBurst?.();
    const bounds = entryButton.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const layer = document.createElement("div");
    layer.className = "entry-burst";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
    const animations = [];

    function scatter(node, x, y, dx, dy, rotation, duration, smoke = false) {
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      layer.append(node);
      const transform = (progress, fall, scale) =>
        `translate(-50%, -50%) translate(${dx * progress}px, ${dy * progress + fall}px) rotate(${rotation * progress}deg) scale(${scale})`;
      animations.push(
        node.animate(
          [
            { transform: transform(0, 0, smoke ? 0.3 : 1), opacity: 1 },
            {
              transform: transform(0.55, 12, smoke ? 1.5 : 1.15),
              opacity: smoke ? 0.45 : 1,
              offset: 0.45,
            },
            {
              transform: transform(1, smoke ? -25 : 160, smoke ? 2.8 : 0.65),
              opacity: 0,
            },
          ],
          { duration, easing: "cubic-bezier(.12,.55,.4,1)", fill: "forwards" },
        ),
      );
    }

    // Measure each glyph before hiding the label so the burst starts in place.
    const icon = entryButton.querySelector("i");
    const label = entryButton.querySelector("span");
    const pieces = [];
    if (icon)
      pieces.push({
        node: icon.cloneNode(true),
        bounds: icon.getBoundingClientRect(),
      });
    if (label) {
      const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode;
        let offset = 0;
        for (const character of text.textContent) {
          const range = document.createRange();
          range.setStart(text, offset);
          offset += character.length;
          range.setEnd(text, offset);
          if (!character.trim()) continue;
          const node = document.createElement("span");
          node.textContent = character;
          pieces.push({ node, bounds: range.getBoundingClientRect() });
        }
      }
    }
    const style = getComputedStyle(entryButton);
    layer.style.font = style.font;
    layer.style.color = style.color;
    pieces.forEach(({ node, bounds: pieceBounds }, index) => {
      node.classList.add("entry-burst-piece");
      const angle = ((index + 0.5) * Math.PI) / pieces.length;
      const distance = 120 + Math.random() * 100;
      scatter(
        node,
        pieceBounds.left + pieceBounds.width / 2,
        pieceBounds.top + pieceBounds.height / 2,
        Math.cos(angle) * distance,
        Math.sin(angle) * distance - 70,
        (index % 2 ? 1 : -1) * (100 + Math.random() * 200),
        1100,
      );
    });
    for (let index = 0; index < 24; index++) {
      const smoke = index < 8;
      const particle = document.createElement("span");
      particle.className = smoke ? "entry-burst-smoke" : "entry-burst-spark";
      const angle = Math.random() * Math.PI * 2;
      const distance = smoke
        ? 35 + Math.random() * 60
        : 75 + Math.random() * 130;
      if (!smoke)
        particle.style.background = ["#d7ff3f", "#ffbb44", "#168b9c"][
          index % 3
        ];
      scatter(
        particle,
        centerX,
        centerY,
        Math.cos(angle) * distance,
        Math.sin(angle) * distance - 30,
        Math.random() * 360,
        smoke ? 850 : 1000,
        smoke,
      );
    }
    entryButton.classList.add("is-bursting");
    const restoreTimer = window.setTimeout(
      () => entryButton.classList.remove("is-bursting"),
      650,
    );
    const cleanup = () => {
      window.clearTimeout(restoreTimer);
      entryButton.classList.remove("is-bursting");
      animations.forEach((animation) => animation.cancel());
      layer.remove();
      if (activeBurst === cleanup) activeBurst = undefined;
    };
    activeBurst = cleanup;
    Promise.allSettled(animations.map((animation) => animation.finished)).then(
      cleanup,
    );
  }

  let scheduled = false;
  function update() {
    // Keep focused controls available even when scroll position changes.
    const visible =
      window.scrollY > 80 || header.contains(document.activeElement);
    header.classList.toggle("is-visible", visible);
    const headerHeight = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty(
      "--header-offset",
      `${headerHeight + 16}px`,
    );
    scheduled = false;
  }
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  };
  document.addEventListener("focusin", (event) => {
    const control = event.target;
    if (
      !(control instanceof HTMLElement) ||
      !control.matches("a[href], button, summary, input, select, textarea") ||
      header.contains(control)
    )
      return;
    requestAnimationFrame(() => {
      if (document.activeElement !== control) return;
      update();
      const bounds = control.getBoundingClientRect();
      const top = header.classList.contains("is-visible")
        ? header.getBoundingClientRect().bottom + 16
        : 16;
      const floatingEntry = document.querySelector(".mobile-entry");
      const bottom =
        floatingEntry &&
        floatingEntry !== control &&
        floatingEntry.getClientRects().length
          ? window.innerHeight -
            floatingEntry.getBoundingClientRect().height -
            32
          : window.innerHeight - 16;
      if (bounds.top < top || bounds.bottom > bottom) {
        const available = Math.max(0, bottom - top);
        const destination = top + Math.max(0, (available - bounds.height) / 2);
        window.scrollBy({ top: bounds.top - destination, behavior: "instant" });
        update();
      }
    });
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.('a[href^="#"]');
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (link === entryButton) burstEntry();
    const id = link.getAttribute("href").slice(1);
    const target = document.getElementById(id);
    if (target && target.hasAttribute("tabindex")) {
      requestAnimationFrame(() => {
        target.focus({ preventScroll: true });
        update();
      });
    }
  });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("pageshow", update);
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", schedule);
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(schedule).observe(header);
  update();
  // Off-screen navigation remains reachable by Tab and assistive technology.
  // Without JavaScript the header stays visible.
  header.classList.add("is-collapsible");
})();
