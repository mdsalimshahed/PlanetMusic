/* --- src/components/Core/Background.jsx --- */
import React, { useMemo, useEffect, useState } from 'react';
import './Background.css';

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
  const [isTabVisible, setIsTabVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Reduced from 45 down to 14 circles to reduce GPU fill-rate strain by 70%
  const circles = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const size = Math.random() * 12 + 6;
      const startX = Math.random() * 100;
      const startY = Math.random() * 100;
      const moveX = (Math.random() - 0.5) * 30;
      const moveY = (Math.random() - 0.5) * 30;
      const duration = Math.random() * 10 + 10;
      const delay = Math.random() * -20;

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

  if (!isTabVisible) return <div className="dynamic-circle-bg" />;

  return (
    <div className="dynamic-circle-bg">
      <div className="circles-container">
        {circles.map(circle => (
          <div
            key={circle.id}
            className="floating-circle"
            style={{
              background: `radial-gradient(circle, ${circle.color} 0%, transparent 70%)`,
              width: `${circle.size * 2}vw`,
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
      <div className="fluid-glass-overlay"></div>
    </div>
  );
};

export default Background;