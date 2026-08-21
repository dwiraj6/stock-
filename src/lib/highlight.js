/* A two-line pub/sub so the conversation panel can highlight the
   score row it is citing (Part 7). Small and cheap, and it makes the
   chat feel wired into the product rather than bolted on. */

const listeners = new Set();
let current = null;

export function setHighlight(key) {
  current = key;
  listeners.forEach((fn) => fn(current));
}

export function subscribeHighlight(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}
