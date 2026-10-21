import { extractYouTubeId } from '../../utils/songHelpers.js';

export const resolvePlayerSource = (track, failedSources, isSyncWorkspaceActive, deezerArl, deezerArlValid) => {
  const trackId = track.trackId;
  const hasLocal = track.customLinks?.hasLocal;
  const dzUrl = track.customLinks?.deezer || '';
  const ytUrl = track.customLinks?.yt || track.yt || '';
  const extractedYtId = extractYouTubeId(ytUrl);
  const hasArl = Boolean(deezerArl?.trim()) && deezerArlValid === true;
  const getBestSource = (exclude = []) => {
    if (hasArl && dzUrl && !exclude.includes('deezer')) return 'deezer';
    if (hasLocal && !exclude.includes('local')) return 'local';
    if (extractedYtId && !exclude.includes('youtube')) return 'youtube';
    if (!isSyncWorkspaceActive && track.previewUrl && !exclude.includes('preview')) return 'preview';
    return null;
  };

  let intendedSource = null;
  if (track.forceSource && !failedSources.includes(track.forceSource)) {
    if (track.forceSource === 'local' && hasLocal) intendedSource = 'local';
    else if (track.forceSource === 'deezer' && hasArl && dzUrl) intendedSource = 'deezer';
    else if (track.forceSource === 'youtube' && extractedYtId) intendedSource = 'youtube';
    else if (track.forceSource === 'preview' && track.previewUrl && !isSyncWorkspaceActive) intendedSource = 'preview';
  }

  if (!intendedSource) intendedSource = getBestSource(failedSources);

  return { trackId, dzUrl, extractedYtId, hasArl, intendedSource };
};

export const shouldStartYouTubeWhileDeezerLoads = (extractedYtId, failedSources) => (
  Boolean(extractedYtId) && !failedSources.includes('youtube')
);
