/** Debounces a burst of realtime events into one call. */
export function coalesce(fn: () => void, ms = 250) {
  let t: ReturnType<typeof setTimeout> | null = null;
  const trigger = () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn();
    }, ms);
  };
  return Object.assign(trigger, {
    cancel() {
      if (t) clearTimeout(t);
      t = null;
    },
  });
}

/** Each load calls begin(); only the most recent load's isLatest() stays true (stale-response guard). */
export function createLoadGate() {
  let seq = 0;
  return {
    begin() {
      const id = ++seq;
      return () => id === seq;
    },
  };
}
