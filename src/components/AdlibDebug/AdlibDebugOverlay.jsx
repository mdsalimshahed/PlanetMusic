/* --- src/components/AdlibDebug/AdlibDebugOverlay.jsx --- */
import React, { useEffect, useRef, useState } from 'react';
import './AdlibDebugOverlay.css';
import { calculateSafeAdlibPosition } from './adlibPlacementLogic';

// Helper: Calculate the closest points and distance between two Axis-Aligned Bounding Boxes
const getClosestPoints = (r1, r2) => {
  let x1, x2, y1, y2;

  // X Axis
  if (r1.right < r2.left) {
    x1 = r1.right; x2 = r2.left;
  } else if (r1.left > r2.right) {
    x1 = r1.left; x2 = r2.right;
  } else {
    // Overlapping in X, pick the midpoint of the overlap
    x1 = x2 = (Math.max(r1.left, r2.left) + Math.min(r1.right, r2.right)) / 2;
  }

  // Y Axis
  if (r1.bottom < r2.top) {
    y1 = r1.bottom; y2 = r2.top;
  } else if (r1.top > r2.bottom) {
    y1 = r1.top; y2 = r2.bottom;
  } else {
    // Overlapping in Y, pick the midpoint of the overlap
    y1 = y2 = (Math.max(r1.top, r2.top) + Math.min(r1.bottom, r2.bottom)) / 2;
  }

  const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  return { x1, y1, x2, y2, dist };
};

const AdlibDebugOverlay = ({ 
  currentSingerBg, 
  isSingerVisible, 
  masterPalette,
  selectedSong 
}) => {
  const overlayRef = useRef(null);
  const rafRef = useRef(null);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [distanceLines, setDistanceLines] = useState([]);
  const [distanceStats, setDistanceStats] = useState([]);
  const [layoutStats, setLayoutStats] = useState({ lyricsClipped: false, singerClipped: false });
  
  // Track who is singing the currently active adlib
  const [activeAdlibSingers, setActiveAdlibSingers] = useState([]);
  const syncDataRef = useRef(selectedSong?.syncData || []);
  const prevAdlibSingersRef = useRef(null);

  useEffect(() => {
    syncDataRef.current = selectedSong?.syncData || [];
  }, [selectedSong?.syncData]);

  // 1. Replicate the artist extraction logic
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
        height: maxBottom - minTop,
        right: maxRight - overlayRect.left,
        bottom: maxBottom - overlayRect.top
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
            datasetStart: parseFloat(adlibNode.dataset.start), // Stored for linking back to syncData
            ...tightBounds
          });
        }
      });

      // D. Calculate Closest Distances between Adlibs and other elements + Quadrant Checks + Collisions
      const combinedBox = newBoxes.find(b => b.id === 'combined-bounds');
      const singerBox = newBoxes.find(b => b.id === 'singer-name-bounds');
      const adlibBoxes = newBoxes.filter(b => b.id.startsWith('adlib-bounds-'));
      
      const newLines = [];
      const newStats = [];
      const colWidth = overlayRect.width / cols;
      const rowHeight = overlayRect.height / 2;
      
      let lyricsClipped = false;
      let singerClipped = false;

      // Check if Main Lyrics box is clipping canvas
      if (combinedBox) {
        if (
          combinedBox.left < 0 ||
          combinedBox.top < 0 ||
          (combinedBox.left + combinedBox.width) > overlayRect.width ||
          (combinedBox.top + combinedBox.height) > overlayRect.height
        ) {
          lyricsClipped = true;
        }
      }

      // Check if Singer Name box is clipping canvas
      if (singerBox) {
        if (
          singerBox.left < 0 ||
          singerBox.top < 0 ||
          (singerBox.left + singerBox.width) > overlayRect.width ||
          (singerBox.top + singerBox.height) > overlayRect.height
        ) {
          singerClipped = true;
        }
      }

      setLayoutStats({ lyricsClipped, singerClipped });

      adlibBoxes.forEach((adlibBox, idx) => {
        let stat = { 
          id: idx, 
          toLyrics: null, 
          toSinger: null, 
          isCorrect: true, 
          quadArtist: null,
          isCollidingWithLyrics: false,
          isCollidingWithSinger: false,
          isClippedOut: false
        };

        // Coordinates for overlap checking
        const aRight = adlibBox.left + adlibBox.width;
        const aBottom = adlibBox.top + adlibBox.height;

        // 1. Check if adlib is bleeding out of the canvas (Clipping)
        if (
          adlibBox.left < 0 || 
          adlibBox.top < 0 || 
          aRight > overlayRect.width || 
          aBottom > overlayRect.height
        ) {
          stat.isClippedOut = true;
        }

        // Draw distance to combined layout and Check Collision
        if (combinedBox) {
          const pts = getClosestPoints(adlibBox, combinedBox);
          newLines.push({ id: `line-c-${idx}`, x1: pts.x1, y1: pts.y1, x2: pts.x2, y2: pts.y2, color: combinedBox.color });
          stat.toLyrics = Math.round(pts.dist);

          // AABB Intersection check (True if rectangles overlap)
          const cRight = combinedBox.left + combinedBox.width;
          const cBottom = combinedBox.top + combinedBox.height;
          
          if (!(
            adlibBox.left >= cRight ||
            aRight <= combinedBox.left ||
            adlibBox.top >= cBottom ||
            aBottom <= combinedBox.top
          )) {
            stat.isCollidingWithLyrics = true;
          }
        }

        // Draw distance to singer name and Check Collision
        if (singerBox) {
          const pts = getClosestPoints(adlibBox, singerBox);
          newLines.push({ id: `line-s-${idx}`, x1: pts.x1, y1: pts.y1, x2: pts.x2, y2: pts.y2, color: singerBox.color });
          stat.toSinger = Math.round(pts.dist);

          // AABB Intersection check for Singer Name Corner
          const sRight = singerBox.left + singerBox.width;
          const sBottom = singerBox.top + singerBox.height;
          
          if (!(
            adlibBox.left >= sRight ||
            aRight <= singerBox.left ||
            adlibBox.top >= sBottom ||
            aBottom <= singerBox.top
          )) {
            stat.isCollidingWithSinger = true;
          }
        }

        // Determine if placed in correct quadrant
        if (isMulti) {
          let matchedSinger = null;
          if (syncDataRef.current) {
            for (const line of syncDataRef.current) {
              if (line.isSplit && line.adlibs) {
                // Match the DOM node's dataset start time to the original syncData object
                const found = line.adlibs.find(a => Math.abs(a.start - adlibBox.datasetStart) < 0.001);
                if (found) {
                  matchedSinger = found.singer;
                  break;
                }
              }
            }
          }

          // Calculate physical center of the ad-lib bounding box
          const centerX = adlibBox.left + adlibBox.width / 2;
          const centerY = adlibBox.top + adlibBox.height / 2;
          
          // Map to physical grid mathematically
          const physCol = Math.max(0, Math.min(cols - 1, Math.floor(centerX / colWidth)));
          const physRow = Math.max(0, Math.min(1, Math.floor(centerY / rowHeight)));
          const physCellIdx = physRow * cols + physCol;
          
          const quadrantArtist = getArtistForCell(physCellIdx);
          
          // Compare mapped physical artist to actual singing artist
          if (matchedSinger && quadrantArtist) {
             const parsedSingers = matchedSinger.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim());
             stat.isCorrect = parsedSingers.includes(quadrantArtist);
          } else {
             stat.isCorrect = false;
          }
          stat.quadArtist = quadrantArtist;
        }
        
        newStats.push(stat);
      });

      // E. Check global audio time to find active adlibs for quadrant dimming
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
                break;
              }
            }
          }
          if (currentAdlibSingers) break;
        }
      }

      if (currentAdlibSingers !== prevAdlibSingersRef.current) {
        prevAdlibSingersRef.current = currentAdlibSingers;
        const parsedSingers = currentAdlibSingers 
          ? currentAdlibSingers.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) 
          : [];
        setActiveAdlibSingers(parsedSingers);
      }

      setBoundingBoxes(newBoxes);
      setDistanceLines(newLines);
      setDistanceStats(newStats);
      rafRef.current = requestAnimationFrame(trackActiveLyrics);
    };

    rafRef.current = requestAnimationFrame(trackActiveLyrics);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cols, isMulti]);

  return (
    <div className="adlib-debug-overlay" ref={overlayRef}>
      
      {/* X/Y Graph Axes with Ticks (Center is 0,0) */}
      <div className="debug-graph-axes">
        <div className="debug-axis-x">
          {[10, 20, 30, 40, 60, 70, 80, 90].map(pct => (
            <div key={`x-${pct}`} className="debug-tick-x" style={{ left: `${pct}%` }}>
              <span className="debug-tick-label-x">{pct - 50}</span>
            </div>
          ))}
        </div>
        <div className="debug-axis-y">
          {[10, 20, 30, 40, 60, 70, 80, 90].map(pct => (
            <div key={`y-${pct}`} className="debug-tick-y" style={{ top: `${pct}%` }}>
              <span className="debug-tick-label-y">{pct - 50}</span>
            </div>
          ))}
        </div>
        <div className="debug-center-label">0,0</div>
      </div>

      {/* SVG Layer for Distance Lines */}
      <svg className="debug-svg-layer">
        {distanceLines.map(line => (
          <g key={line.id}>
            <line 
              x1={line.x1} y1={line.y1} 
              x2={line.x2} y2={line.y2} 
              stroke={line.color} strokeWidth="1.5" strokeDasharray="4 4" 
            />
            <circle cx={line.x1} cy={line.y1} r="3" fill="#eab308" />
            <circle cx={line.x2} cy={line.y2} r="3" fill={line.color} />
          </g>
        ))}
      </svg>

      {/* HUD info panel */}
      <div className="debug-hud-panel">
        <div><strong>Current Singer(s):</strong> {currentSingerBg?.name || 'None'}</div>
        <div><strong>Active Adlib Singer:</strong> {activeAdlibSingers.length > 0 ? activeAdlibSingers.join(', ') : 'None'}</div>
        <div><strong>Layout Mode:</strong> {activeNames.length === 0 ? 'Idle' : (isMulti ? `Matrix (${cols}x2)` : 'Full Screen')}</div>
        
        {/* Core Layout Canvas Bounds Checking */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '6px', marginTop: '6px' }}>
          <strong>Core Layout Status:</strong>{' '}
          {layoutStats.lyricsClipped ? (
            <span style={{color: '#ef4444'}}>Lyrics Clipped</span>
          ) : (
            <span style={{color: '#4ade80'}}>Lyrics Safe</span>
          )}{' | '}
          {layoutStats.singerClipped ? (
            <span style={{color: '#ef4444'}}>Name Clipped</span>
          ) : (
            <span style={{color: '#4ade80'}}>Name Safe</span>
          )}
        </div>

        {distanceStats.length > 0 && distanceStats.map(stat => (
          <div key={`stat-${stat.id}`} style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div>
              <strong>Adlib {stat.id + 1} Distances:</strong>
              {stat.toLyrics !== null ? ` To Lyrics: ${stat.toLyrics}px |` : ''}
              {stat.toSinger !== null ? ` To Name: ${stat.toSinger}px` : ''}
            </div>
            <div>
              <strong>Placement:</strong> {isMulti ? (
                stat.isCorrect ? (
                  <span style={{color: '#4ade80'}}> Correct Quadrant</span>
                ) : (
                  <span style={{color: '#ef4444'}}> Wrong (in {stat.quadArtist}'s quad)</span>
                )
              ) : ' Full Screen'}
            </div>
            <div>
              <strong>Status:</strong>{' '}
              {stat.isCollidingWithLyrics ? (
                <span style={{color: '#ef4444'}}>Lyrics Collision</span>
              ) : (
                <span style={{color: '#4ade80'}}>Safe from Lyrics</span>
              )}{' | '}
              {stat.isCollidingWithSinger ? (
                <span style={{color: '#ef4444'}}>Name Collision</span>
              ) : (
                <span style={{color: '#4ade80'}}>Safe from Name</span>
              )}{' | '}
              {stat.isClippedOut ? (
                <span style={{color: '#ef4444'}}>Clipped Bounds</span>
              ) : (
                <span style={{color: '#4ade80'}}>Inside Canvas</span>
              )}
            </div>
          </div>
        ))}
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