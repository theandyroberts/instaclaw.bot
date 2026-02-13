export function smoothScrollTo(selector: string, duration = 800) {
  const el = document.querySelector(selector);
  if (!el) return;

  const start = window.scrollY;
  const target = el.getBoundingClientRect().top + start - 80; // 80px offset for sticky nav
  const distance = target - start;
  let startTime: number | null = null;

  // Ease in-out cubic
  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function step(timestamp: number) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);

    window.scrollTo(0, start + distance * eased);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}
