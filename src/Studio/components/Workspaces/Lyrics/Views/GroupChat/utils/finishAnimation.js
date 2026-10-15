export const finishAnimationAtCurrentStyles = animation => {
  animation.commitStyles();
  animation.cancel();
};
