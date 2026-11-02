(() => {
  const header = document.querySelector(".site-header");
  const sticky = document.querySelector(".mobile-entry");
  const hero = document.querySelector(".hero");
  const entry = document.querySelector("#entry");
  if (!header) return;
  let scheduled = false;
  function update() {
    // Keep focused controls available even when scroll position changes.
    const visible =
      window.scrollY > 80 || header.contains(document.activeElement);
    header.classList.toggle("is-visible", visible);
    header.inert = !visible;
    header.setAttribute("aria-hidden", String(!visible));
    const headerHeight = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty(
      "--header-offset",
      `${headerHeight + 16}px`,
    );
    if (sticky && hero && entry) {
      const show =
        (hero.getBoundingClientRect().bottom < 0 &&
          entry.getBoundingClientRect().top > window.innerHeight) ||
        sticky.contains(document.activeElement);
      sticky.classList.toggle("is-visible", show);
      sticky.inert = !show;
      sticky.setAttribute("aria-hidden", String(!show));
    }
    scheduled = false;
  }
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  };
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
})();
