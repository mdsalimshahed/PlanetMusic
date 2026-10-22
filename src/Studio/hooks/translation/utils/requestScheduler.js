const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

export const createRequestScheduler = (minimumIntervalMs) => {
  let queue = Promise.resolve();
  let lastStartedAt = 0;
  let pausedUntil = 0;

  const schedule = (request) => {
    const scheduledRequest = queue.then(async () => {
      const remainingInterval = Math.max(
        minimumIntervalMs - (Date.now() - lastStartedAt),
        pausedUntil - Date.now()
      );
      if (remainingInterval > 0) {
        await wait(remainingInterval);
      }

      lastStartedAt = Date.now();
      return request();
    });

    queue = scheduledRequest.then(() => undefined, () => undefined);
    return scheduledRequest;
  };

  schedule.pause = (milliseconds) => {
    pausedUntil = Math.max(pausedUntil, Date.now() + milliseconds);
  };

  return schedule;
};
