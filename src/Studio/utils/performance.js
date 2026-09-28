export const isLowPowerDevice = () => {
  if (typeof navigator === 'undefined') return false;

  const hasLimitedMemory = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4;
  const hasLimitedCores = Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency <= 4;
  const prefersDataSaving = Boolean(navigator.connection?.saveData);
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const isSmallTouchDevice = typeof window !== 'undefined'
    && window.innerWidth <= 900
    && window.matchMedia?.('(pointer: coarse)').matches;

  return hasLimitedMemory || hasLimitedCores || prefersDataSaving || prefersReducedMotion || isSmallTouchDevice;
};

export const getAnimationFrameInterval = () => {
  if (isLowPowerDevice()) return 1000 / 30;
  return 0;
};