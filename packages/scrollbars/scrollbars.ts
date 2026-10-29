// Scroll events do not bubble, so one capture listener covers nested panels too.
const hideTimers = new WeakMap<Element, number>();

document.addEventListener('scroll', (event) => {
  const target = event.target === document ? document.documentElement : event.target;
  if (!(target instanceof Element) || target.classList.contains('hide-scrollbar')) return;

  target.classList.add('is-scrolling');
  window.clearTimeout(hideTimers.get(target));
  hideTimers.set(target, window.setTimeout(() => {
    target.classList.remove('is-scrolling');
    hideTimers.delete(target);
  }, 1200));
}, { capture: true, passive: true });
