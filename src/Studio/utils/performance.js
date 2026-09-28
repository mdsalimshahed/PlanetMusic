export const isLowPowerDevice = () => {
  if (typeof navigator === 'undefined') return false;

  const hasLimitedMemory = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4;
  const hasLimitedCores = Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency <= 4;
  const prefersDataSaving = Boolean(navigator.connection?.saveData);
  const isSmallTouchDevice = typeof window !== 'undefined'
    && window.innerWidth <= 900
    && window.matchMedia?.('(pointer: coarse)').matches;

  return hasLimitedMemory || hasLimitedCores || prefersDataSaving || isSmallTouchDevice;
};

export const getAnimationFrameInterval = () => (isLowPowerDevice() ? 1000 / 30 : 0);