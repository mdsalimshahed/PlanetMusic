const isHttpUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
};

export const validatePlatformLink = (platform, value) => {
  const link = value?.trim();
  if (!link) return '';

  const url = isHttpUrl(link);
  if (!url) return 'Enter a valid link beginning with https://.';

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (platform === 'deezer') {
    const isDeezerTrackLink =
      host === 'deezer.com' &&
      /^\/(?:[a-z]{2}\/)?track\/\d+\/?$/i.test(url.pathname);
    return isDeezerTrackLink
      ? ''
      : 'Use a full Deezer track link, such as https://www.deezer.com/en/track/854914442.';
  }

  if (platform === 'spotify') {
    const spotifyHost = url.hostname.toLowerCase();
    const isSpotifyTrackOrAlbumLink =
      spotifyHost === 'open.spotify.com' &&
      /^\/(?:intl-[a-z]{2}\/)?(?:track|album)\/[a-z0-9]{22}\/?$/i.test(url.pathname);
    return isSpotifyTrackOrAlbumLink
      ? ''
      : 'Use a Spotify track or album link from open.spotify.com.';
  }

  if (platform === 'yt') {
    const isYouTubeHost = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'music.youtube.com',
      'youtu.be',
      'www.youtu.be'
    ].includes(url.hostname.toLowerCase());
    if (!isYouTubeHost) return 'Use a YouTube or YouTube Music video link.';

    const videoId = url.hostname.toLowerCase().endsWith('youtu.be')
      ? url.pathname.split('/').filter(Boolean)[0]
      : (url.pathname === '/watch' ? url.searchParams.get('v') : null) ||
        url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/i)?.[1];
    return videoId && /^[\w-]{11}$/.test(videoId)
      ? ''
      : 'Use a valid YouTube or YouTube Music video link.';
  }

  return '';
};

export const getPlatformLinkErrors = customData => ({
  spotify: validatePlatformLink('spotify', customData?.spotify),
  deezer: validatePlatformLink('deezer', customData?.deezer),
  yt: validatePlatformLink('yt', customData?.yt)
});
