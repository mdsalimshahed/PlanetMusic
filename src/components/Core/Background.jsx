/* --- src/components/Core/Background.jsx --- */
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
  // Generate random floating and disappearing circles once on load
  const circles = useMemo(() => {
    return Array.from({ length: 45 }).map((_, i) => {
      const size = Math.random() * 15 + 5; // Radius size ranging from 5vw to 20vw
      const startX = Math.random() * 100; // Start anywhere from 0 to 100vw
      const startY = Math.random() * 100; // Start anywhere from 0 to 100vh
      
      // Determine how far and in what direction the circle will drift during its lifespan
      const moveX = (Math.random() - 0.5) * 40; // Drift horizontally between -20vw and +20vw
      const moveY = (Math.random() - 0.5) * 40; // Drift vertically between -20vh and +20vh
      
      const duration = Math.random() * 12 + 8; // Animation lifespan between 8s and 20s
      const delay = Math.random() * -25; // Negative delay so the screen is already populated on load

      return {
        id: i,
        color: VIBRANT_PALETTE[i % VIBRANT_PALETTE.length],
        size: size,
        startX: startX,
        startY: startY,
        moveX: moveX,
        moveY: moveY,
        duration: duration,
        delay: delay
      };
    });
  }, []);

  return (
    <div className="dynamic-circle-bg">
      <div className="circles-container">
        {circles.map(circle => (
          <div
            key={circle.id}
            className="floating-circle"
            style={{
              // Pre-baked blur via radial gradient (Zero GPU strain)
              background: `radial-gradient(circle, ${circle.color} 0%, transparent 70%)`,
              width: `${circle.size * 2}vw`, // Scaled up to accommodate the gradient fade
              height: `${circle.size * 2}vw`,
              left: `${circle.startX}vw`,
              top: `${circle.startY}vh`,
              animationDuration: `${circle.duration}s`,
              animationDelay: `${circle.delay}s`,
              '--move-x': `${circle.moveX}vw`,
              '--move-y': `${circle.moveY}vh`
            }}
          />
        ))}
      </div>
      
      {/* Dark gradient overlay to ensure dashboard text remains readable */}
      <div className="fluid-glass-overlay"></div>
    </div>
  );
};

export default Background;