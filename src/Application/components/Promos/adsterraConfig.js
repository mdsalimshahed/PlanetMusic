const units = {
  dashboardBottom: {
    scriptUrl: 'https://bauval.org/21/889574e3da81bc429d87767e99f24e0b',
    containerId: 'container-889574e3da81bc429d87767e99f24e0b'
  },
  blogSidebar: {
    key: 'ed5be38356b0e524b81107748c6a750e',
    scriptUrl: 'https://bauval.org/22/ed5be38356b0e524b81107748c6a750e',
    format: 'iframe',
    width: 160,
    height: 600
  },
  contactSidebar: {
    key: 'ed5be38356b0e524b81107748c6a750e',
    scriptUrl: 'https://bauval.org/22/ed5be38356b0e524b81107748c6a750e',
    format: 'iframe',
    width: 160,
    height: 600
  },
  privacySidebar: {
    key: 'ed5be38356b0e524b81107748c6a750e',
    scriptUrl: 'https://bauval.org/22/ed5be38356b0e524b81107748c6a750e',
    format: 'iframe',
    width: 160,
    height: 600
  }
};

export const getAdsterraUnit = (placement) => units[placement] || null;
