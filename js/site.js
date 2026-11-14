// ASCII render of public HiP-CT data: the hero sweep through a whole brain.
// Everything here is progressive: the page reads complete with this file absent.
(() => {
  "use strict";

  let ADVANCE = 0.6; // glyph advance in em; measured once the font has loaded
  const LINE = 1.2;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const rowsOf = (frame) => frame.split("\n").length;

  function measureAdvance() {
    const probe = document.createElement("pre");
    probe.className = "ascii";
    probe.style.cssText = "position:absolute;visibility:hidden;font-size:100px;left:-9999px;top:0";
    probe.textContent = "@".repeat(50);
    document.body.appendChild(probe);
    ADVANCE = probe.getBoundingClientRect().width / 50 / 100;
    probe.remove();
  }

  // Largest font size that fits a cols x rows grid into w x h.
  const fit = (cols, rows, w, h) => Math.min(w / (cols * ADVANCE), h / (rows * LINE));

  // ---------- hero: sagittal sweep ----------
  const field = document.getElementById("field");
  const pre = document.getElementById("hero-ascii");
  const slider = document.getElementById("slice");
  const out = document.getElementById("slice-out");
  const of = document.getElementById("slice-of");
  const pauseBtn = document.getElementById("pause");

  let hero = null;
  let frames = [];
  let shown = -1;
  let pos = 0;          // float frame position
  let dir = 1;
  let target = null;    // pointer-driven target position
  let paused = reduce.matches;
  let visible = true;
  let last = 0;
  let idleTimer = 0;

  function chooseHeroSet() {
    if (!hero) return;
    const wide = window.innerWidth > 1100;
    const text = document.querySelector(".hero-text");
    const gutter = parseFloat(getComputedStyle(text).paddingLeft) || 16;
    const w = wide ? field.clientWidth - parseFloat(getComputedStyle(document.querySelector(".readout")).paddingRight) : window.innerWidth - 2 * gutter;
    const h = wide ? window.innerHeight - document.querySelector(".top").offsetHeight - field.querySelector(".readout").offsetHeight - 40 : window.innerHeight * 0.62;
    let best = null;
    for (const cols of [176, 120, 72]) {
      const set = hero[String(cols)];
      if (!set) continue;
      const fs = fit(cols, rowsOf(set[0]), w, h);
      if (fs >= 8.5) { best = { cols, fs, set }; break; }
      if (!best || fs > best.fs) best = { cols, fs, set };
    }
    frames = best.set;
    pre.style.fontSize = best.fs.toFixed(2) + "px";
    shown = -1;
    draw();
  }

  function draw() {
    const i = Math.max(0, Math.min(frames.length - 1, Math.round(pos)));
    if (i === shown) return;
    shown = i;
    pre.textContent = frames[i];
    slider.value = String(i);
    out.value = String(i + 1);
  }

  function tick(t) {
    requestAnimationFrame(tick);
    if (!frames.length || !visible) { last = t; return; }
    const dt = Math.min(0.1, (t - (last || t)) / 1000);
    last = t;
    if (target !== null) {
      pos += (target - pos) * Math.min(1, dt * 12);
    } else if (!paused) {
      pos += dir * dt * 5; // five slices a second
      if (pos >= frames.length - 1) { pos = frames.length - 1; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
    }
    draw();
  }

  function setPaused(p) {
    paused = p;
    pauseBtn.setAttribute("aria-pressed", String(p));
    pauseBtn.textContent = p ? "play" : "pause";
  }

  async function initHero() {
    if (!field) return;
    try {
      const res = await fetch(field.dataset.src);
      hero = await res.json();
    } catch { return; } // static frame already in the page
    const n = hero["120"].length;
    slider.max = String(n - 1);
    of.textContent = String(n);
    pos = Math.round(n * 0.3);
    setPaused(paused);
    chooseHeroSet();

    pre.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const r = pre.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      target = f * (frames.length - 1);
      clearTimeout(idleTimer);
    });
    pre.addEventListener("pointerleave", () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { target = null; }, 1200);
    });
    slider.addEventListener("input", () => {
      target = null;
      pos = Number(slider.value);
      setPaused(true);
      draw();
    });
    pauseBtn.addEventListener("click", () => { target = null; setPaused(!paused); });

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(field);
    requestAnimationFrame(tick);
  }

  // ---------- nav: mark the section in view ----------
  function initNav() {
    const links = new Map([...document.querySelectorAll(".top nav a")].map((a) => [a.hash.slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const a = links.get(e.target.id);
        if (a && e.isIntersecting) {
          links.forEach((l) => l.removeAttribute("aria-current"));
          a.setAttribute("aria-current", "true");
        }
      }
    }, { rootMargin: "-40% 0px -55% 0px" });
    links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  let rz = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(chooseHeroSet);
  });

  reduce.addEventListener?.("change", () => setPaused(reduce.matches || paused));

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    measureAdvance();
    initHero();
  });
  initNav();
})();
