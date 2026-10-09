import { useLayoutEffect, useRef, useState } from 'react';

const MODES = [
  ['live', 'Live'],
  ['focused', 'Focused'],
  ['group-chat', 'Group Chat'],
  ['plain', 'Plain Text']
];

const LyricsViewModeSlider = ({ lyricsViewMode, setLyricsViewMode }) => {
  const sliderRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, positioned: false });

  useLayoutEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return undefined;

    const updateIndicator = () => {
      const selectedButton = slider.querySelector(`[data-view-mode="${lyricsViewMode}"]`);
      if (!selectedButton) return;

      const sliderRect = slider.getBoundingClientRect();
      const buttonRect = selectedButton.getBoundingClientRect();
      setIndicator({
        left: buttonRect.left - sliderRect.left - slider.clientLeft,
        width: buttonRect.width,
        positioned: true
      });
    };

    updateIndicator();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(updateIndicator);
    observer.observe(slider);
    Array.from(slider.querySelectorAll('.segment-btn')).forEach(button => {
      observer.observe(button);
    });
    return () => observer.disconnect();
  }, [lyricsViewMode]);

  return (
    <div
      className={`view-mode-segmented-slider${indicator.positioned ? ' is-positioned' : ''}`}
      ref={sliderRef}
    >
      <span
        className="view-mode-active-pill"
        aria-hidden="true"
        style={{
          width: `${indicator.width}px`,
          transform: `translateX(${indicator.left}px)`
        }}
      />
      {MODES.map(([mode, label]) => (
        <button
          className="segment-btn"
          data-view-mode={mode}
          key={mode}
          aria-pressed={lyricsViewMode === mode}
          onClick={() => setLyricsViewMode(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default LyricsViewModeSlider;
