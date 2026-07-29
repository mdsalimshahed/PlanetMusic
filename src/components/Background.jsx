/* --- src/components/Background.jsx --- */
import React, { useMemo } from 'react';
import './Background.css';

// A highly vibrant, multi-color palette (No dark purples)
const VIBRANT_PALETTE = [
  '#ff0a54', // Vivid Pink
  '#ff7000', // Bright Orange
  '#ffc300', // Bright Yellow
  '#00f5d4', // Aqua/Cyan
  '#00bbf9', // Bright Blue
  '#f15bb5', // Magenta
  '#38b000', // Lime Green
];

const Background = () => {
  // Generate random falling liquid drops once on load
  const liquidDrops = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const size = Math.random() * 25 + 20; // 20vw to 45vw
      return {
        id: i,
        color: VIBRANT_PALETTE[i % VIBRANT_PALETTE.length],
        size: size,
        left: Math.random() * 110 - 10, // -10vw to 100vw
        duration: Math.random() * 15 + 15, // 15s to 30s falling speed
        delay: Math.random() * -30, // Negative delay so they are already falling on load
        swayX: (Math.random() * 40) - 20 // Random horizontal drift (-20vw to +20vw)
      };
    });
  }, []);

  return (
    <div className="falling-fluid-bg">
      <div className="fluid-drops-container">
        {liquidDrops.map(drop => (
          <div
            key={drop.id}
            className="fluid-drop"
            style={{
              backgroundColor: drop.color,
              width: `${drop.size}vw`,
              height: `${drop.size}vw`,
              left: `${drop.left}vw`,
              animationDuration: `${drop.duration}s`,
              animationDelay: `${drop.delay}s`,
              '--sway-target': `${drop.swayX}vw`
            }}
          />
        ))}
      </div>
      
      {/* Dark frosted glass overlay to ensure dashboard text remains readable */}
      <div className="fluid-glass-overlay"></div>
    </div>
  );
};

export default Background;