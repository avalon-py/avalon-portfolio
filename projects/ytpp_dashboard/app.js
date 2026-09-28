// Player scrubber: fixed 33% on the home page (the real Spearman), otherwise page-scroll progress with a running "time".
const f = document.querySelector(".sc .f"), t = document.getElementById("time");
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
if (f && f.dataset.w) requestAnimationFrame(() => setTimeout(() => { f.style.transition = "width 1.6s cubic-bezier(.2,.7,.2,1)"; f.style.width = f.dataset.w + "%"; }, 250));
else if (f) {
  const total = +t.dataset.total, tick = () => {
    const h = document.documentElement, p = Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight));
    f.style.width = p * 100 + "%"; t.textContent = fmt(p * total) + " / " + fmt(total);
  };
  addEventListener("scroll", tick, { passive: true }); tick();
}

// Bars fill when scrolled into view.
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.firstElementChild.style.width = (parseFloat(e.target.dataset.v) / 0.35) * 100 + "%"; io.unobserve(e.target);
}), { threshold: 0.4 });
document.querySelectorAll(".bar").forEach((b) => io.observe(b));

// Sidebar: mark the current page as "watched", and filter with the chips.
const here = location.pathname.split("/").pop() || "home.html";
document.querySelectorAll(".it").forEach((a) => { if (a.getAttribute("href") === here) a.querySelector(".th").insertAdjacentHTML("beforeend", '<i class="seen"></i>'); });
document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
  document.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === c));
  document.querySelectorAll(".it").forEach((a) => (a.hidden = c.dataset.c !== "all" && a.dataset.c !== c.dataset.c));
}));

// Search box: jump to the page that matches what you type.
const map = { "home.html": "overview why project problem demo", "technicals.html": "technicals model architecture clip fusion encoder training target", "stack.html": "stack flow oracle caddy airflow pipeline retrain promotion serving deploy vm architecture docker", "results.html": "results score spearman ablation experiments accuracy" };
document.getElementById("search").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = e.target.q.value.trim().toLowerCase(), hit = Object.keys(map).find((k) => q && map[k].split(" ").some((w) => w.startsWith(q) || q.startsWith(w)));
  if (hit) location.href = hit; else { e.target.q.value = ""; e.target.q.placeholder = "No match. Try: model, results, why"; }
});

// Share: copy the page link.
const sh = document.getElementById("share");
if (sh) sh.addEventListener("click", () => navigator.clipboard.writeText(location.href).then(() => { sh.lastChild.textContent = "Copied"; setTimeout(() => (sh.lastChild.textContent = "Share"), 1500); }));

// Retrain history dot chart (hollow = rejected by the promotion gate).
const host = document.getElementById("promo");
if (host) {
  const runs = [[.321,1],[.307,1],[.307,1],[.307,1],[.307,1],[.307,1],[.307,0],[.307,1],[.307,1],[.299,1],[.299,1],[.308,1],[.308,1],[.300,1],[.307,1],[.323,1],[.305,1],[.305,1]];
  const W = 640, L = 40, lo = .28, hi = .34, y = (v) => 170 - ((v - lo) / (hi - lo)) * 150;
  let s = `<svg viewBox="0 0 ${W} 190" role="img" aria-label="Test Spearman of each retraining run">`;
  [.28,.30,.32,.34].forEach((v) => (s += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#303030"/><text x="0" y="${y(v)+4}">${v.toFixed(2)}</text>`));
  runs.forEach(([v, ok], i) => {
    const x = L + 14 + i * ((W - L - 28) / (runs.length - 1));
    s += `<circle cx="${x}" cy="${y(v)}" r="6" fill="${ok ? "#f03" : "#0f0f0f"}" stroke="#f03" stroke-width="2"><title>Run ${i+1}: ${v.toFixed(3)}${ok ? "" : " (rejected)"}</title></circle>`;
  });
  host.innerHTML = s + "</svg>";
}