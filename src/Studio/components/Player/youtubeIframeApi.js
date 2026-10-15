let apiReadyPromise = null;

export const loadYouTubeIframeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise((resolve, reject) => {
    const fail = error => {
      apiReadyPromise = null;
      reject(error);
    };
    const previousReadyCallback = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      try {
        previousReadyCallback?.();
      } catch (error) {
        fail(error);
        return;
      }

      if (!window.YT?.Player) {
        fail(new Error('YouTube IFrame API callback ran without a player API.'));
        return;
      }
      resolve(window.YT);
    };

    const existingScript = [...document.scripts].find(script => (
      script.src === 'https://www.youtube.com/iframe_api'
    ));
    if (existingScript) {
      existingScript.addEventListener('error', () => {
        fail(new Error('YouTube IFrame API script failed to load.'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.addEventListener('error', () => {
      fail(new Error('YouTube IFrame API script failed to load.'));
    }, { once: true });
    document.head.appendChild(script);
  });

  return apiReadyPromise;
};
