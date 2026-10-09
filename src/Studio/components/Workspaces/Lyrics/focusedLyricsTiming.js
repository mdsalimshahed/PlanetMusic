const ENTER_WINDOW_RATIO = 0.3;
const ENTER_ANIMATION_RATIO = 0.6;
const MAX_ENTER_DURATION = 0.36;
const MAX_ENTER_STAGGER = 0.055;
const EXIT_WINDOW_RATIO = 0.1;
const MAX_EXIT_DURATION = 0.25;
const EXIT_CONTENT_RATIO = 0.62;
const MIN_EXIT_LAYER_DURATION = 0.1;
const MAX_EXIT_LAYER_DURATION = MAX_EXIT_DURATION * EXIT_CONTENT_RATIO;

export const getFocusedLyricsAnimationTiming = (lineDuration, wordCount) => {
  const duration = Number.isFinite(lineDuration) && lineDuration > 0 ? lineDuration : 0;
  const enterWindow = duration * ENTER_WINDOW_RATIO;
  const enterDuration = Math.min(wordCount > 1
    ? enterWindow * ENTER_ANIMATION_RATIO
    : enterWindow, MAX_ENTER_DURATION);
  const enterStagger = wordCount > 1
    ? Math.min((enterWindow - enterDuration) / (wordCount - 1), MAX_ENTER_STAGGER)
    : 0;
  const exitDuration = Math.min(duration * EXIT_WINDOW_RATIO, MAX_EXIT_DURATION);
  const exitLayerDuration = exitDuration > 0
    ? Math.max(MIN_EXIT_LAYER_DURATION, Math.min(exitDuration * EXIT_CONTENT_RATIO, MAX_EXIT_LAYER_DURATION))
    : 0;

  return {
    enterDuration,
    enterStagger,
    exitDuration,
    exitLayerDuration
  };
};
