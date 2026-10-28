const getBrowserVersion = (userAgent, expression) => {
  const match = userAgent.match(expression);
  return match ? Number(match[1]) : null;
};

export const isUnsupportedVaultBrowser = (userAgent) => {
  if (/SeaMonkey|MSIE|Trident/i.test(userAgent)) return true;

  const minimumVersions = [
    [/Edg\/(\d+)/, 79],
    [/OPR\/(\d+)/, 66],
    [/Chrome\/(\d+)/, 64],
    [/Firefox\/(\d+)/, 60],
    [/Version\/(\d+).*Safari/, 12]
  ];

  return minimumVersions.some(([expression, minimumVersion]) => {
    const version = getBrowserVersion(userAgent, expression);
    return version !== null && version < minimumVersion;
  });
};
