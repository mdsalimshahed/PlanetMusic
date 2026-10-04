const ENTER_WINDOW_RATIO = 0.3;
const ENTER_ANIMATION_RATIO = 0.6;
const EXIT_WINDOW_RATIO = 0.1;
const EXIT_CONTENT_RATIO = 0.7;

export const getFocusedLyricsAnimationTiming = (lineDuration, wordCount) => {
  const duration = Number.isFinite(lineDuration) && lineDuration > 0 ? lineDuration : 0;
  const enterWindow = duration * ENTER_WINDOW_RATIO;
  const enterDuration = wordCount > 1
    ? enterWindow * ENTER_ANIMATION_RATIO
    : enterWindow;
  const exitDuration = duration * EXIT_WINDOW_RATIO;

  return {
    enterDuration,
    enterStagger: wordCount > 1
      ? (enterWindow - enterDuration) / (wordCount - 1)
      : 0,
    exitDuration,
    exitLayerDuration: exitDuration * EXIT_CONTENT_RATIO
  };
};
