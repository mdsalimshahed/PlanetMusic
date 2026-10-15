const MAX_CACHED_ARL_VERIFICATIONS = 20;
const verificationResults = new Map();

export const getCachedArlVerification = arl => {
  const result = verificationResults.get(arl);
  if (!result) return null;

  verificationResults.delete(arl);
  verificationResults.set(arl, result);
  return result;
};

export const cacheArlVerification = (arl, result) => {
  if (!arl || (result !== 'success' && result !== 'error')) return;

  verificationResults.delete(arl);
  verificationResults.set(arl, result);
  if (verificationResults.size > MAX_CACHED_ARL_VERIFICATIONS) {
    const oldestArl = verificationResults.keys().next().value;
    verificationResults.delete(oldestArl);
  }
};
