/* --- src/components/Core/Background.jsx --- */
import React, { useMemo, useState, useRef, useCallback } from 'react';
import './Background.css';

// A highly vibrant, expanded multi-color palette
const VIBRANT_PALETTE = [
  '#ff0a54', '#ff7000', '#ffc300', '#00f5d4', '#00bbf9', 
  '#f15bb5', '#38b000', '#8a2be2', '#00ff00', '#ff00ff', 
  '#ffff00', '#00ffff', '#ff4500', '#ff007f', '#adff2f'
];

// Simple deterministic pseudo-random number generator
const getStableRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Isolated component that teleports itself safely while invisible
const AmbientCircle = React.memo(({ circle }) => {
  const [pos, setPos] = useState({ x: circle.initialX, y: circle.initialY });
  const iterationRef = useRef(0);

  // Fires exactly when the animation reaches 100% (opacity is 0)
  const handleIteration = useCallback(() => {
    iterationRef.current += 1;
    
    // Generate new seeds based on iteration count so it moves randomly forever
    const newSeedX = circle.id * 100 + iterationRef.current * 13;
    const newSeedY = circle.id * 200 + iterationRef.current * 17;
    
    setPos({
      x: getStableRandom(newSeedX) * 110 - 10, // -10vw to 100vw
      y: getStableRandom(newSeedY) * 110 - 10  // -10vh to 100vh
    });
  }, [circle.id]);

  return (
    <div 
      className="ambient-wrapper"
      style={{
        width: `${circle.size}vw`,
        height: `${circle.size}vw`,
        transform: `translate3d(${pos.x}vw, ${pos.y}vh, 0)`
      }}
    >
      <div
        className="pop-circle"
        onAnimationIteration={handleIteration}
        style={{
          background: `radial-gradient(circle, ${circle.color} 0%, transparent 70%)`,
          animationDuration: `${circle.duration}s`,
          animationDelay: `${circle.delay}s`,
          '--max-opacity': circle.maxOpacity
        }}
      />
    </div>
  );
});

const Background = () => {
  // Generate the initial parameters once on mount
  const ambientCircles = useMemo(() => {
    return Array.from({ length: 25 }).map((_, i) => {
      const seedBase = i + 1;
      
      const size = getStableRandom(seedBase * 1.1) * 30 + 15; 
      const maxOpacity = getStableRandom(seedBase * 7.7) * 0.4 + 0.3; 
      const colorIndex = Math.floor(getStableRandom(seedBase * 6.6) * VIBRANT_PALETTE.length);
      
      return {
        id: i,
        color: VIBRANT_PALETTE[colorIndex],
        size: size,
        initialX: getStableRandom(seedBase * 2.2) * 100 - 10, 
        initialY: getStableRandom(seedBase * 3.3) * 100 - 10,  
        duration: getStableRandom(seedBase * 4.4) * 8 + 8, // 8s to 16s cycle
        delay: getStableRandom(seedBase * 5.5) * -20, // Negative start stagger
        maxOpacity: maxOpacity
      };
    });
  }, []);

  return (
    <div className="falling-fluid-bg">
      <div className="fluid-drops-container">
        {ambientCircles.map(circle => (
          <AmbientCircle key={circle.id} circle={circle} />
        ))}
      </div>
      
      {/* Dark gradient overlay to ensure dashboard text remains readable */}
      <div className="fluid-glass-overlay"></div>
    </div>
  );
};

export default Background;