export const alignTranslationBoxToRowOutline = (translation, rowOutline) => {
  if (!translation || !rowOutline) return translation;

  return {
    ...translation,
    left: rowOutline.left + (rowOutline.width - translation.width) / 2,
    top: rowOutline.top - translation.height
  };
};
