/*
 * Adsterra placements are temporarily disabled. Restore this configuration
 * and the units map below to re-enable them.
 *
const wideBottomBanner = {
  scriptUrl: 'https://bauval.org/21/910aa18db3b991aa658299010d1e2590',
  containerId: 'container-910aa18db3b991aa658299010d1e2590'
};

const sidebarBannerLarge = {
  scriptUrl: 'https://bauval.org/21/c1216072aaab86e4181adaf6f0e86eb2',
  containerId: 'container-c1216072aaab86e4181adaf6f0e86eb2',
  height: 600,
  aspectRatio: '1 / 4'
};

const sidebarBannerSmall = {
  key: 'd8c7b2102419f2476edfbff6dd091b68',
  scriptUrl: 'https://bauval.org/22/d8c7b2102419f2476edfbff6dd091b68',
  format: 'iframe',
  width: 300,
  height: 250
};

const units = {
  dashboardBottom: wideBottomBanner,
  settingsBottom: wideBottomBanner,
  blogPostBottom: wideBottomBanner,
  blogFeedBottom: wideBottomBanner,
  contactBottom: wideBottomBanner,
  privacyBottom: wideBottomBanner,
  blogSidebar: sidebarBannerLarge,
  contactSidebar: sidebarBannerLarge,
  privacySidebar: sidebarBannerLarge,
  blogStickySidebar: sidebarBannerSmall,
  contactStickySidebar: sidebarBannerSmall,
  privacyStickySidebar: sidebarBannerSmall
};
*/

const units = {};
let adsterraLoadQueue = Promise.resolve();

export const getAdsterraUnit = (placement) => units[placement] || null;

export const loadAdsterraUnit = (unit, container) => {
  let script;
  let adContainer;
  let cancelled = false;
  let finishLoading;

  const load = (serializeAtOptions = false) => new Promise((resolve, reject) => {
    if (cancelled || !container.isConnected) {
      resolve();
      return;
    }
    finishLoading = resolve;

    if (unit.key) {
      window.atOptions = {
        key: unit.key,
        format: unit.format,
        height: unit.height,
        width: unit.width,
        params: {}
      };
    }

    if (unit.containerId) {
      document.getElementById(unit.containerId)?.remove();
      adContainer = document.createElement('div');
      adContainer.id = unit.containerId;
      adContainer.style.width = '100%';
      if (unit.height) adContainer.style.height = `${unit.height}px`;
      container.append(adContainer);
    }

    script = document.createElement('script');
    script.async = !serializeAtOptions;
    script.dataset.cfasync = 'false';
    script.src = unit.scriptUrl;
    script.onload = () => {
      finishLoading = null;
      resolve();
    };
    script.onerror = () => {
      finishLoading = null;
      reject(new Error(`Adsterra script failed to load: ${unit.scriptUrl}`));
    };

    container.append(script);
  });

  const reportLoadError = (error) => {
    console.error(error);
  };
  const loadPromise = unit.key
    ? adsterraLoadQueue.then(() => load(true))
    : load();

  if (unit.key) {
    adsterraLoadQueue = loadPromise.catch(reportLoadError);
  } else {
    loadPromise.catch(reportLoadError);
  }

  return () => {
    cancelled = true;
    script?.remove();
    adContainer?.remove();
    if (unit.key && window.atOptions?.key === unit.key) {
      delete window.atOptions;
    }
    finishLoading?.();
  };
};
