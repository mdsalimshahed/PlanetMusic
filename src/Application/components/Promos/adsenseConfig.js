const slotIds = {
  dashboardBottom: import.meta.env.VITE_ADSENSE_SLOT_DASHBOARD_BOTTOM,
  trackGrid: import.meta.env.VITE_ADSENSE_SLOT_TRACK_GRID,
  blogPostBottom: import.meta.env.VITE_ADSENSE_SLOT_BLOG_POST_BOTTOM,
  blogFeed: import.meta.env.VITE_ADSENSE_SLOT_BLOG_FEED,
  blogSidebar: import.meta.env.VITE_ADSENSE_SLOT_BLOG_SIDEBAR,
  blogStickySidebar: import.meta.env.VITE_ADSENSE_SLOT_BLOG_STICKY_SIDEBAR,
  contactSidebar: import.meta.env.VITE_ADSENSE_SLOT_CONTACT_SIDEBAR,
  contactStickySidebar: import.meta.env.VITE_ADSENSE_SLOT_CONTACT_STICKY_SIDEBAR,
  contactBottom: import.meta.env.VITE_ADSENSE_SLOT_CONTACT_BOTTOM,
  privacySidebar: import.meta.env.VITE_ADSENSE_SLOT_PRIVACY_SIDEBAR,
  privacyStickySidebar: import.meta.env.VITE_ADSENSE_SLOT_PRIVACY_STICKY_SIDEBAR,
  privacyBottom: import.meta.env.VITE_ADSENSE_SLOT_PRIVACY_BOTTOM,
  settingsFeedOne: import.meta.env.VITE_ADSENSE_SLOT_SETTINGS_FEED_ONE,
  settingsFeedTwo: import.meta.env.VITE_ADSENSE_SLOT_SETTINGS_FEED_TWO,
  settingsBottom: import.meta.env.VITE_ADSENSE_SLOT_SETTINGS_BOTTOM
};

export const getAdSenseConfig = ({ client, slot, placement } = {}) => {
  const resolvedClient = (client || import.meta.env.VITE_ADSENSE_CLIENT || '').trim();
  const resolvedSlot = (slot || slotIds[placement] || import.meta.env.VITE_ADSENSE_SLOT_DEFAULT || '').trim();

  return {
    client: resolvedClient,
    slot: resolvedSlot,
    isValid: /^ca-pub-\d+$/.test(resolvedClient) && /^\d+$/.test(resolvedSlot)
  };
};

export const loadAdSenseScript = (client) => {
  if (typeof window === 'undefined') return;

  window.adsbygoogle = window.adsbygoogle || [];
  if (document.querySelector('script[data-adsense-loader]')) return;

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.adsenseLoader = 'true';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
};