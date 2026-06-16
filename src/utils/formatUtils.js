/* --- src/utils/formatUtils.js --- */

export const formatTime = (millis) => {
  if (!millis) return "N/A";
  const minutes = Math.floor(millis / 60000);
  const seconds = ((millis % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export const formatPreciseTime = (sec) => {
  if (isNaN(sec) || sec === null) return "--:--.---";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${ms.toString().padStart(3, '0')}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const cleanUrl = (urlStr) => {
  if (!urlStr) return '';
  try {
    const url = new URL(urlStr);
    const trackers = ['host', 'deferredFl', 'universal_link', 'si', 'context', 'nd', 'ls', 'app', 'at', 'ct', 'l', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'feature', 'fbclid', 'igshid'];
    trackers.forEach(param => url.searchParams.delete(param));
    return url.toString();
  } catch (e) {
    return urlStr;
  }
};

export const cleanImageUrl = (urlStr) => {
  if (!urlStr) return '';
  try {
    const url = new URL(urlStr);
    const junkParams = [
      'si', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 
      'fbclid', 'igshid', '_nc_ht', '_nc_cat', 'oh', 'oe', 'usqp', 'ved',
      'w', 'h', 'width', 'height', 'size', 'resize', 'crop', 'quality', 'fit', 'format', 'auto', 'blur', 'dpr', 's'
    ];
    junkParams.forEach(param => url.searchParams.delete(param));
    
    let finalUrl = url.toString();
    if (finalUrl.includes('upload.wikimedia.org') && finalUrl.includes('/thumb/')) {
      finalUrl = finalUrl.replace(/\/thumb\//, '/');
      finalUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/'));
    }

    return finalUrl;
  } catch (e) {
    return urlStr;
  }
};

export const parseTrackName = (trackName) => {
  if (!trackName) return { mainTitle: '', extras: [], featuredArtists: [] };
  
  const extras = [];
  const featuredArtists = [];
  
  let mainTitle = trackName.replace(/[\(\[]([^()\[\]]+)[\)\]]/g, (match, content) => {
    const lowerContent = content.toLowerCase().trim();
    if (
      lowerContent.includes('soundtrack') || 
      lowerContent.includes('motion picture') || 
      lowerContent.startsWith('from ') ||
      lowerContent === 'ost' ||
      lowerContent.includes('original score')
    ) {
      return ''; 
    }
    
    const featMatch = content.match(/^(?:feat\.?|ft\.?|featuring)\s+(.+)$/i);
    if (featMatch) {
      featuredArtists.push(featMatch[1].trim());
      return ''; 
    }
    
    extras.push(content.trim());
    return ''; 
  });
  
  mainTitle = mainTitle.replace(/\s+/g, ' ').trim();
  
  return { mainTitle, extras, featuredArtists };
};