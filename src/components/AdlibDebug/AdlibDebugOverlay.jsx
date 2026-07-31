/* --- src/components/AdlibDebug/AdlibDebugOverlay.jsx --- */
import React, { useEffect, useRef, useState } from 'react';
import './AdlibDebugOverlay.css';
import { calculateSafeAdlibPosition } from './adlibPlacementLogic';

const AdlibDebugOverlay = ({ 
  currentSingerBg, 
  isSingerVisible, 
  masterPalette,
  selectedSong 
}) => {
  const overlayRef = useRef(null);
  const rafRef = useRef(null);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  
  // Track who is singing the currently active adlib
  const [activeAdlibSingers, setActiveAdlibSingers] = useState([]);
  const syncDataRef = useRef(selectedSong?.syncData || []);
  const prevAdlibSingersRef = useRef(null);

  // Keep the ref updated without triggering full re-renders
  useEffect(() => {
    syncDataRef.current = selectedSong?.syncData || [];
  }, [selectedSong?.syncData]);

  // 1. Replicate the artist extraction logic from DynamicBackground
  const activeNames = currentSingerBg?.name?.split(/\s*(?:&|,|\band\b)\s*/i)
    .filter(Boolean)
    .map(s => s.trim()) || [];
    
  const isMulti = activeNames.length > 1;
  const cols = Math.max(2, activeNames.length);

  const getArtistForCell = (cellIndex) => {
    if (activeNames.length === 0) return null;
    const row = Math.floor(cellIndex / cols);
    const col = cellIndex % cols;
    return activeNames[(col + row) % activeNames.length];
  };

  // Helper function to get mathematically precise bounds of TEXT only
  const getTightTextBounds = (element, overlayRect) => {
    let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
    let hasValidBounds = false;

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let node;
    
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() !== '') {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = range.getClientRects();
        
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i];
          if (rect.width > 0 && rect.height > 0) {
            hasValidBounds = true;
            minTop = Math.min(minTop, rect.top);
            minLeft = Math.min(minLeft, rect.left);
            maxRight = Math.max(maxRight, rect.right);
            maxBottom = Math.max(maxBottom, rect.bottom);
          }
        }
      }
    }

    if (hasValidBounds) {
      return {
        top: minTop - overlayRect.top,
        left: minLeft - overlayRect.left,
        width: maxRight - minLeft,
        height: maxBottom - minTop
      };
    }
    return null;
  };

  // 2. Real-time DOM and Time tracking
  useEffect(() => {
    const trackActiveLyrics = () => {
      if (!overlayRef.current) return;
      const overlayRect = overlayRef.current.getBoundingClientRect();
      const activeLine = document.querySelector('.focused-line.active');
      const newBoxes = [];

      // A. Track the Main Lyrics Block tightly
      if (activeLine) {
        const tightBounds = getTightTextBounds(activeLine, overlayRect);
        if (tightBounds) {
          newBoxes.push({
            id: 'combined-bounds',
            color: '#4ade80', // Bright Green
            ...tightBounds
          });
        }
      }

      // B. Track the Singer Name Corner tightly
      const singerNameCorner = document.querySelector('.singer-name-corner.visible');
      if (singerNameCorner) {
        const tightBounds = getTightTextBounds(singerNameCorner, overlayRect);
        if (tightBounds) {
          newBoxes.push({
            id: 'singer-name-bounds',
            color: '#f97316', // Orange
            ...tightBounds
          });
        }
      }

      // C. Track any currently active Adlibs tightly
      const activeAdlibs = document.querySelectorAll('.focused-adlib-line.active');
      activeAdlibs.forEach((adlibNode, idx) => {
        const tightBounds = getTightTextBounds(adlibNode, overlayRect);
        if (tightBounds) {
          newBoxes.push({
            id: `adlib-bounds-${idx}`,
            color: '#eab308', // Yellow
            ...tightBounds
          });
        }
      });

      // D. Check global audio time to find active adlibs for quadrant dimming
      const time = window.currentAudioTime || 0;
      let currentAdlibSingers = null;

      if (syncDataRef.current) {
        for (let i = 0; i < syncDataRef.current.length; i++) {
          const line = syncDataRef.current[i];
          if (line.isSplit && line.adlibs) {
            for (let j = 0; j < line.adlibs.length; j++) {
              const adlib = line.adlibs[j];
              const start = adlib.start;
              const end = adlib.end !== null ? adlib.end : (start !== null ? start + 5 : 0);
              
              if (start !== null && time >= start && time <= end) {
                currentAdlibSingers = adlib.singer;
                break; // Found the active adlib
              }
            }
          }
          if (currentAdlibSingers) break;
        }
      }

      // Update state only if the active adlib singer has changed
      if (currentAdlibSingers !== prevAdlibSingersRef.current) {
        prevAdlibSingersRef.current = currentAdlibSingers;
        const parsedSingers = currentAdlibSingers 
          ? currentAdlibSingers.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) 
          : [];
        setActiveAdlibSingers(parsedSingers);
      }

      setBoundingBoxes(newBoxes);
      rafRef.current = requestAnimationFrame(trackActiveLyrics);
    };

    rafRef.current = requestAnimationFrame(trackActiveLyrics);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="adlib-debug-overlay" ref={overlayRef}>
      
      {/* X/Y Graph Axes with Ticks */}
      <div className="debug-graph-axes">
        <div className="debug-axis-x">
          {[10, 20, 30, 40, 60, 70, 80, 90].map(pct => (
            <div key={`x-${pct}`} className="debug-tick-x" style={{ left: `${pct}%` }} />
          ))}
        </div>
        <div className="debug-axis-y">
          {[10, 20, 30, 40, 60, 70, 80, 90].map(pct => (
            <div key={`y-${pct}`} className="debug-tick-y" style={{ top: `${pct}%` }} />
          ))}
        </div>
      </div>

      {/* HUD info panel */}
      <div className="debug-hud-panel">
        <div><strong>Current Singer(s):</strong> {currentSingerBg?.name || 'None'}</div>
        <div><strong>Active Adlib Singer:</strong> {activeAdlibSingers.length > 0 ? activeAdlibSingers.join(', ') : 'None'}</div>
        <div><strong>Layout Mode:</strong> {activeNames.length === 0 ? 'Idle' : (isMulti ? `Matrix (${cols}x2)` : 'Full Screen')}</div>
      </div>

      {/* Render Full Screen Border if single artist */}
      {isSingerVisible && !isMulti && activeNames.length === 1 && (
        <div 
          className="debug-fullscreen-box"
          style={{ borderColor: masterPalette[activeNames[0]] || '#ff00ff' }}
        >
        </div>
      )}

      {/* Render Matrix Borders if multiple artists */}
      {isSingerVisible && isMulti && (
        <div 
          className="debug-matrix-grid" 
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols * 2 }).map((_, cellIdx) => {
            const targetArtist = getArtistForCell(cellIdx);
            const artistColor = masterPalette[targetArtist] || '#ff00ff';
            
            // Dim quadrant if an adlib is playing and this artist isn't singing it
            const isDimmed = activeAdlibSingers.length > 0 && !activeAdlibSingers.includes(targetArtist);
            
            return (
              <div 
                key={cellIdx} 
                className={`debug-matrix-cell ${isDimmed ? 'dimmed' : ''}`}
                style={{ borderColor: artistColor }}
              >
              </div>
            );
          })}
        </div>
      )}

      {/* Render Dynamic Bounding Boxes */}
      {boundingBoxes.map(box => (
        <div
          key={box.id}
          className="debug-bounding-box"
          style={{
            top: `${box.top}px`,
            left: `${box.left}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            borderColor: box.color
          }}
        />
      ))}
      
    </div>
  );
};

export default AdlibDebugOverlay;