/* --- src/components/LyricsRenderer/adlibInlinePlacement.js --- */

/**
 * Calculates absolute layout positioning for the physically separate Ad-lib Unit Container.
 * The container's width is strictly bounded by the ad-lib text line, forcing top translation
 * and bottom pronunciation blocks to wrap into multiple lines when they exceed its width.
 *
 * @param {Object} params
 * @param {number|null} parentMainTop - Top offset of parent main text box
 * @param {number|null} parentMainHeight - Height of parent main text box
 * @param {number|null} parentMainWidth - Width of parent main text box
 * @param {number} transHeight - Measured height of the translation block
 * @returns {Object} Absolute positioning style object for the overarching ad-lib unit container
 */
export const calculateAdlibInlinePlacement = ({
  parentMainTop = null,
  parentMainHeight = null,
  parentMainWidth = null,
  transHeight = 0
}) => {
  const baseContainerStyle = {
    position: 'absolute',
    display: 'inline-flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    width: 'max-content !important', // Width is bounded strictly by the ad-lib main text line
    maxWidth: 'max-content !important',
    height: 'auto !important',
    overflow: 'visible !important'
  };

  if (parentMainTop !== null && parentMainHeight !== null) {
    const computedTop = parentMainTop - transHeight;

    return {
      ...baseContainerStyle,
      top: `${computedTop}px`,
      left: parentMainWidth !== null ? `calc(${parentMainWidth}px + 12px)` : '100%'
    };
  }

  return {
    ...baseContainerStyle,
    top: '0px',
    left: '100%',
    marginLeft: '12px'
  };
};

/**
 * Translation block styling inside the overarching ad-lib unit container.
 * Strictly respects the dynamic --dyn-trans-top-padding setting set via the Settings slider.
 */
export const getAdlibTranslationStyle = () => ({
  position: 'relative',
  display: 'block',
  width: '100% !important',
  maxWidth: '100% !important',
  boxSizing: 'border-box',
  height: 'auto !important',
  maxHeight: 'none !important',
  textAlign: 'center !important',
  wordBreak: 'normal !important',
  overflowWrap: 'break-word !important',
  whiteSpace: 'normal !important',
  marginBottom: 'var(--dyn-trans-top-padding, 8px) !important', // Respects the Translation Top Padding slider
  pointerEvents: 'none',
  zIndex: 10
});

/**
 * Pronunciation block styling inside the overarching ad-lib unit container.
 * Strictly respects the dynamic --dyn-translit-bottom-padding setting set via the Settings slider.
 */
export const getAdlibPronunciationStyle = () => ({
  position: 'relative',
  display: 'inline-block',
  width: '100% !important',
  maxWidth: '100% !important',
  boxSizing: 'border-box',
  height: 'auto !important',
  maxHeight: 'none !important',
  marginTop: 'var(--dyn-translit-bottom-padding, 4px) !important', // Respects the Transliteration Bottom Padding slider
  fontSize: 'var(--dyn-translit-font-size, 0.55em)',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  textAlign: 'center !important',
  wordBreak: 'normal !important',
  overflowWrap: 'break-word !important',
  whiteSpace: 'normal !important',
  WebkitTextFillColor: 'currentcolor',
  backgroundImage: 'none',
  color: 'rgba(255,255,255,0.7)',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
  wordSpacing: '4px',
  lineHeight: '1.4',
  pointerEvents: 'none',
  zIndex: 10
});