export const createRequestScheduler = (minimumIntervalMs, maxConcurrentRequests = 1) => {
  const queue = [];
  const concurrencyLimit = Math.max(1, maxConcurrentRequests);
  const burstCapacity = concurrencyLimit;
  let activeRequests = 0;
  let availableTokens = burstCapacity;
  let lastTokenRefillAt = Date.now();
  let pausedUntil = 0;
  let timer = null;

  const refillTokens = (now) => {
    if (minimumIntervalMs <= 0) {
      availableTokens = burstCapacity;
    } else {
      const elapsed = Math.max(0, now - lastTokenRefillAt);
      availableTokens = Math.min(
        burstCapacity,
        availableTokens + elapsed / minimumIntervalMs
      );
    }
    lastTokenRefillAt = now;
  };

  const drainQueue = () => {
    if (timer !== null || queue.length === 0 || activeRequests >= concurrencyLimit) return;

    const now = Date.now();
    if (now < pausedUntil) {
      timer = setTimeout(() => {
        timer = null;
        drainQueue();
      }, pausedUntil - now);
      return;
    }

    refillTokens(now);
    if (availableTokens < 1) {
      const waitForToken = Math.ceil((1 - availableTokens) * minimumIntervalMs);
      timer = setTimeout(() => {
        timer = null;
        drainQueue();
      }, waitForToken);
      return;
    }

    const { request, resolve, reject } = queue.shift();
    availableTokens--;
    activeRequests++;
    Promise.resolve()
      .then(request)
      .then(resolve, reject)
      .finally(() => {
        activeRequests--;
        drainQueue();
      });
    drainQueue();
  };

  const schedule = (request) => new Promise((resolve, reject) => {
    queue.push({ request, resolve, reject });
    drainQueue();
  });

  schedule.pause = (milliseconds) => {
    pausedUntil = Math.max(pausedUntil, Date.now() + milliseconds);
    availableTokens = 0;
    lastTokenRefillAt = pausedUntil;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    drainQueue();
  };

  return schedule;
};
