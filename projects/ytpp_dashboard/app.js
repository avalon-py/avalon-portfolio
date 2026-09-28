// Scroll progress (YouTube-style loading bar)
const bar = document.getElementById("progress");
addEventListener("scroll", () => {
  const h = document.documentElement;
  bar.style.width = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100 + "%";
}, { passive: true });

// The one orchestrated moment: fill the player scrubber to the real rank correlation.
const f = document.querySelector(".scrub .f");
if (f) requestAnimationFrame(() => setTimeout(() => (f.style.width = f.dataset.w + "%"), 250));

// Bars fill when scrolled into view. Each bar's width = value / scale.
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  const i = e.target.querySelector("i");
  i.style.width = (parseFloat(e.target.dataset.v) / parseFloat(e.target.dataset.max || 0.35)) * 100 + "%";
  io.unobserve(e.target);
}), { threshold: 0.4 });
document.querySelectorAll(".bar").forEach((b) => io.observe(b));

// Promotion history: test Spearman of each retrain (rejected runs hollow).
const host = document.getElementById("promo");
if (host) {
  const runs = [[.321,1],[.307,1],[.307,1],[.307,1],[.307,1],[.307,1],[.307,0],[.307,1],[.307,1],[.299,1],[.299,1],[.308,1],[.308,1],[.300,1],[.307,1],[.323,1],[.305,1],[.305,1]];
  const W = 640, H = 200, L = 40, lo = .28, hi = .34, y = (v) => 170 - ((v - lo) / (hi - lo)) * 150;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Test Spearman of each retraining run">`;
  [.28,.30,.32,.34].forEach((v) => s += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#333"/><text x="0" y="${y(v)+4}">${v.toFixed(2)}</text>`);
  runs.forEach(([v, ok], i) => {
    const x = L + 14 + i * ((W - L - 28) / (runs.length - 1));
    s += `<circle cx="${x}" cy="${y(v)}" r="6" fill="${ok ? "#ff0033" : "#0f0f0f"}" stroke="#ff0033" stroke-width="2"><title>Run ${i+1}: ${v.toFixed(3)}${ok ? "" : " (rejected)"}</title></circle>`;
  });
  host.innerHTML = s + "</svg>";
}
