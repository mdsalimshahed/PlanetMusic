export const getSyncTimingCompensationKey = (lineIndex, adlibIndex, field) => (
  `${lineIndex}:${adlibIndex === null ? 'main' : `adlib-${adlibIndex}`}:${field}`
);

export const applySyncTimingCompensation = (data, compensationMs, pendingFields) => {
  if (!Array.isArray(data) || !Number.isFinite(compensationMs) || pendingFields.size === 0) {
    return data;
  }

  const offsetSeconds = compensationMs / 1000;
  const shiftField = (value, key) => {
    if (!pendingFields.has(key) || value === null || value === undefined || value === '') {
      return value;
    }

    const time = Number(value);
    if (!Number.isFinite(time)) return value;

    return Math.max(0, Number((time - offsetSeconds).toFixed(3)));
  };

  return data.map((line, lineIndex) => ({
    ...line,
    start: shiftField(
      line.start,
      getSyncTimingCompensationKey(lineIndex, null, 'start')
    ),
    end: shiftField(
      line.end,
      getSyncTimingCompensationKey(lineIndex, null, 'end')
    ),
    adlibs: Array.isArray(line.adlibs)
      ? line.adlibs.map((adlib, adlibIndex) => ({
        ...adlib,
        start: shiftField(
          adlib.start,
          getSyncTimingCompensationKey(lineIndex, adlibIndex, 'start')
        ),
        end: shiftField(
          adlib.end,
          getSyncTimingCompensationKey(lineIndex, adlibIndex, 'end')
        )
      }))
      : line.adlibs
  }));
};
