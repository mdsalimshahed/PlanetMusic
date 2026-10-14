const ENTER_DURATION = 0.36;
const ENTER_STAGGER = 0.055;
const EXIT_DURATION = 0.25;
const EXIT_LAYER_DURATION = 0.155;

export const getFocusedLyricsAnimationTiming = () => ({
  enterDuration: ENTER_DURATION,
  enterStagger: ENTER_STAGGER,
  exitDuration: EXIT_DURATION,
  exitLayerDuration: EXIT_LAYER_DURATION
});
