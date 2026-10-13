const wideBottomBanner = {
  scriptUrl: 'https://bauval.org/21/889574e3da81bc429d87767e99f24e0b',
  containerId: 'container-889574e3da81bc429d87767e99f24e0b'
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

let adsterraLoadQueue = Promise.resolve();

export const getAdsterraUnit = (placement) => units[placement] || null;

export const loadAdsterraUnit = (unit, container) => {
  let script;
  let cancelled = false;
  let finishLoading;

  const load = () => new Promise((resolve, reject) => {
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

    script = document.createElement('script');
    script.async = false;
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

    if (unit.containerId) {
      const adContainer = document.createElement('div');
      adContainer.id = unit.containerId;
      adContainer.style.width = '100%';
      if (unit.height) adContainer.style.height = `${unit.height}px`;
      container.append(script, adContainer);
    } else {
      container.append(script);
    }
  });

  const loadPromise = adsterraLoadQueue.then(load);
  adsterraLoadQueue = loadPromise.catch((error) => {
    console.error(error);
  });

  return () => {
    cancelled = true;
    script?.remove();
    finishLoading?.();
  };
};
