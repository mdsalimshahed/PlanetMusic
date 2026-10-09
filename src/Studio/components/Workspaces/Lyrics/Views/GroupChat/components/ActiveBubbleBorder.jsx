import React, { useLayoutEffect, useRef, useState } from 'react';

const getBubbleBorderPath = (width, height, side, shape) => {
  const left = 1;
  const top = 1;
  const right = Math.max(left + 1, width - 1);
  const bottom = Math.max(top + 1, height - 1);
  const groupedCorner = shape === 'middle' || shape === 'last' ? 8 : 6;
  const topLeft = Math.min(20, (right - left) / 2, (bottom - top) / 2);
  const topRight = topLeft;
  const bottomLeft = Math.min(side === 'left' ? groupedCorner : 20, topLeft);
  const bottomRight = Math.min(side === 'right' ? groupedCorner : 20, topLeft);

  return [
    `M ${left + topLeft} ${top}`,
    `H ${right - topRight}`,
    `Q ${right} ${top} ${right} ${top + topRight}`,
    `V ${bottom - bottomRight}`,
    `Q ${right} ${bottom} ${right - bottomRight} ${bottom}`,
    `H ${left + bottomLeft}`,
    `Q ${left} ${bottom} ${left} ${bottom - bottomLeft}`,
    `V ${top + topLeft}`,
    `Q ${left} ${top} ${left + topLeft} ${top}`,
    'Z'
  ].join(' ');
};

const ActiveBubbleBorder = ({ colors, side, shape }) => {
  const borderRef = useRef(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const gradientId = `chat-border-${React.useId().replace(/:/g, '')}`;
  const gradientColors = colors.length > 1 ? colors : [...colors, ...colors];

  useLayoutEffect(() => {
    const border = borderRef.current;
    if (!border) return undefined;

    const updateSize = () => {
      const { width, height } = border.getBoundingClientRect();
      setSize(current => (
        current.width === width && current.height === height
          ? current
          : { width: Math.max(1, width), height: Math.max(1, height) }
      ));
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateSize);
    observer.observe(border);
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      ref={borderRef}
      className="group-chat-active-border"
      viewBox={`0 0 ${size.width} ${size.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={size.width}
          y2={size.height}
        >
          {gradientColors.map((color, index) => (
            <stop
              key={`${color}-${index}`}
              offset={`${gradientColors.length > 1 ? (index / (gradientColors.length - 1)) * 100 : 0}%`}
              stopColor={color}
            />
          ))}
        </linearGradient>
      </defs>
      <path
        d={getBubbleBorderPath(size.width, size.height, side, shape)}
        pathLength="100"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default ActiveBubbleBorder;
