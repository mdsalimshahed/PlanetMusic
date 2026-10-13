const units = {
  trackGrid: {
    scriptUrl: 'https://bauval.org/21/889574e3da81bc429d87767e99f24e0b',
    containerId: 'container-889574e3da81bc429d87767e99f24e0b'
  }
};

export const getAdsterraUnit = (placement) => units[placement] || null;
