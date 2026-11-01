export const getHistoryGlideStart = ({
  previousTop,
  previousTransform,
  currentTop,
  currentTransform,
  scale
}) => {
  const previousLayoutTop = previousTop / scale - previousTransform;
  const currentLayoutTop = currentTop / scale - currentTransform;
  return currentTransform + previousLayoutTop - currentLayoutTop;
};
