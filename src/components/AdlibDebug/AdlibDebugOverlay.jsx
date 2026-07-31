/* --- src/components/AdlibDebug/AdlibDebugOverlay.jsx --- */
import React, { useEffect, useRef, useState } from 'react';
import './AdlibDebugOverlay.css';
import { calculateSafeAdlibPosition } from './adlibPlacementLogic';

const getClosestPoints = (r1, r2) => {
  let x1, x2, y1, y2;

  if (r1.right < r2.left) {
    x1 = r1.right; x2 = r2.left;
  } else if (r1.left > r2.right) {
    x1 = r1.left; x2 = r2.right;
  } else {
    x1 = x2 = (Math.max(r1.left, r2.left) + Math.min(r1.right, r2.right)) / 2;
  }

  if (r1.bottom < r2.top) {
    y1 = r1.bottom; y2 = r2.top;
  } else if (r1.top > r2.bottom) {
    y1 = r1.top; y2 = r2.bottom;
  } else {
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
  const [safeZones, setSafeZones] = useState([]);
  const [adlibCopies, setAdlibCopies] = useState([]);
  
  const [activeAdlibSingers, setActiveAdlibSingers] = useState([]);
  const syncDataRef = useRef(selectedSong?.syncData || []);
  const prevAdlibSingersRef = useRef(null);

  useEffect(() => {
    syncDataRef.current = selectedSong?.syncData || [];
  }, [selectedSong?.syncData]);

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

  useEffect(() => {
    const trackActiveLyrics = () => {
      if (!overlayRef.current) return;
      
      const overlayRect = overlayRef.current.getBoundingClientRect();
      const previewContainer = document.querySelector('.focused-lyrics-preview') || overlayRef.current;
      const containerRect = previewContainer.getBoundingClientRect();
      
      const safeTop = containerRect.top - overlayRect.top;
      const safeLeft = containerRect.left - overlayRect.left;
      const safeRight = containerRect.right - overlayRect.left;
      const safeBottom = containerRect.bottom - overlayRect.top;

      const activeLine = document.querySelector('.focused-line.active');
      const newBoxes = [];

      if (activeLine) {
        const tightBounds = getTightTextBounds(activeLine, overlayRect);
        if (tightBounds) {
          newBoxes.push({ id: 'combined-bounds', color: '#4ade80', ...tightBounds });
        }
      }

      const singerNameCorner = document.querySelector('.singer-name-corner.visible');
      if (singerNameCorner) {
        const tightBounds = getTightTextBounds(singerNameCorner, overlayRect);
        if (tightBounds) {
          newBoxes.push({ id: 'singer-name-bounds', color: '#f97316', ...tightBounds });
        }
      }

      const activeAdlibs = document.querySelectorAll('.focused-adlib-line.active');
      
      const newAdlibCopies = [];
      let activeAdlibAABB_W = 0;
      let activeAdlibAABB_H = 0;

      activeAdlibs.forEach((adlibNode, idx) => {
        let aabbW = 0;
        let aabbH = 0;
        
        const tightBounds = getTightTextBounds(adlibNode, overlayRect);
        if (tightBounds) {
          aabbW = tightBounds.width;
          aabbH = tightBounds.height;
          newBoxes.push({
            id: `adlib-bounds-${idx}`,
            color: '#eab308',
            datasetStart: parseFloat(adlibNode.dataset.start),
            ...tightBounds
          });
        } else {
          // Fallback if tightbounds fails
          const r = adlibNode.getBoundingClientRect();
          aabbW = r.width;
          aabbH = r.height;
        }
        
        if (idx === 0) {
          activeAdlibAABB_W = aabbW;
          activeAdlibAABB_H = aabbH;
        }

        newAdlibCopies.push({
          html: adlibNode.innerHTML,
          width: adlibNode.offsetWidth,
          height: adlibNode.offsetHeight,
          rot: adlibNode.style.getPropertyValue('--adlib-rot') || '0deg',
          aabbW,
          aabbH
        });
      });

      setAdlibCopies(prev => {
        if (prev.length !== newAdlibCopies.length) return newAdlibCopies;
        if (prev.length > 0) {
          if (prev[0].html !== newAdlibCopies[0].html || 
              prev[0].width !== newAdlibCopies[0].width ||
              prev[0].rot !== newAdlibCopies[0].rot ||
              prev[0].aabbW !== newAdlibCopies[0].aabbW ||
              prev[0].aabbH !== newAdlibCopies[0].aabbH) {
              return newAdlibCopies;
          }
        }
        return prev;
      });

      const combinedBox = newBoxes.find(b => b.id === 'combined-bounds');
      const singerBox = newBoxes.find(b => b.id === 'singer-name-bounds');
      const adlibBoxes = newBoxes.filter(b => b.id.startsWith('adlib-bounds-'));
      
      const newLines = [];
      const newStats = [];
      const colWidth = overlayRect.width / cols;
      const rowHeight = overlayRect.height / 2;
      const midX = overlayRect.width / 2;
      
      let lyricsClipped = false;
      let singerClipped = false;

      if (combinedBox) {
        if (
          combinedBox.left < safeLeft ||
          combinedBox.top < safeTop ||
          (combinedBox.left + combinedBox.width) > safeRight ||
          (combinedBox.top + combinedBox.height) > safeBottom
        ) {
          lyricsClipped = true;
        }
      }

      if (singerBox) {
        if (
          singerBox.left < safeLeft ||
          singerBox.top < safeTop ||
          (singerBox.left + singerBox.width) > safeRight ||
          (singerBox.top + singerBox.height) > safeBottom
        ) {
          singerClipped = true;
        }
      }

      setLayoutStats({ lyricsClipped, singerClipped });

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

      const activeSingersList = currentAdlibSingers 
        ? currentAdlibSingers.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) 
        : [];

      if (currentAdlibSingers !== prevAdlibSingersRef.current) {
        prevAdlibSingersRef.current = currentAdlibSingers;
        setActiveAdlibSingers(activeSingersList);
      }

      // --- CALCULATE QUADRANT-RESTRICTED SAFE ZONES AND CENTER-POINT INNER ZONES ---
      const newSafeZones = [];
      if (combinedBox) {
        const baseZones = [];
        
        // Top Zone
        if (combinedBox.top > safeTop) {
          baseZones.push({ type: 'Top', left: safeLeft, right: safeRight, top: safeTop, bottom: combinedBox.top });
        }
        
        // Bottom Zone: Expanded to full width, capped vertically by the singer box
        if (combinedBox.top + combinedBox.height < safeBottom) {
          const bTop = combinedBox.top + combinedBox.height;
          // Set the floor to the top of the singer box (or safeBottom if no singer box)
          const bBottom = singerBox ? Math.min(singerBox.top, safeBottom) : safeBottom;
          
          if (bBottom > bTop) {
            baseZones.push({ type: 'Bottom', left: safeLeft, right: safeRight, top: bTop, bottom: bBottom });
          }
        }

        const validCells = [];
        if (!isMulti || activeSingersList.length === 0) {
          validCells.push({ left: 0, right: overlayRect.width, top: 0, bottom: overlayRect.height });
        } else {
          for (let i = 0; i < cols * 2; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const artist = getArtistForCell(i);
            
            if (activeSingersList.includes(artist)) {
              validCells.push({
                left: col * colWidth,
                right: (col + 1) * colWidth,
                top: row * rowHeight,
                bottom: (row + 1) * rowHeight
              });
            }
          }
        }

        baseZones.forEach(bz => {
          validCells.forEach(vc => {
            // Intersect Base Zones with Valid Matrix Cells
            const ixLeft = Math.max(bz.left, vc.left);
            const ixRight = Math.min(bz.right, vc.right);
            const ixTop = Math.max(bz.top, vc.top);
            const ixBottom = Math.min(bz.bottom, vc.bottom);
            
            if (ixLeft < ixRight && ixTop < ixBottom) {
              const szWidth = ixRight - ixLeft;
              const szHeight = ixBottom - ixTop;
              
              let idealX = ixLeft + (szWidth / 2);
              let idealY = ixTop + (szHeight / 2);
              let innerZone = null;

              // Calculate the Inner Safe Zone using AABB dimensions so bounding boxes don't clip
              if (activeAdlibAABB_W > 0 && activeAdlibAABB_H > 0) {
                const iLeft = ixLeft + activeAdlibAABB_W / 2;
                const iTop = ixTop + activeAdlibAABB_H / 2;
                const iWidth = szWidth - activeAdlibAABB_W;
                const iHeight = szHeight - activeAdlibAABB_H;

                if (iWidth >= 0 && iHeight >= 0) {
                  innerZone = { left: iLeft, top: iTop, width: iWidth, height: iHeight };
                  // Ensure ideal placement is clamped inside the safe inner zone bounds
                  idealX = Math.max(iLeft, Math.min(iLeft + iWidth, idealX));
                  idealY = Math.max(iTop, Math.min(iTop + iHeight, idealY));
                }
              }

              newSafeZones.push({
                id: `sz-${bz.type}-${Math.round(ixLeft)}-${Math.round(ixTop)}`,
                top: ixTop,
                left: ixLeft,
                width: szWidth,
                height: szHeight,
                label: `${bz.type} Zone`,
                idealX,
                idealY,
                innerZone
              });
            }
          });
        });
      }
      setSafeZones(newSafeZones);
      // ---------------------------------------

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

        const aRight = adlibBox.left + adlibBox.width;
        const aBottom = adlibBox.top + adlibBox.height;

        if (
          adlibBox.left < safeLeft || 
          adlibBox.top < safeTop || 
          aRight > safeRight || 
          aBottom > safeBottom
        ) {
          stat.isClippedOut = true;
        }

        if (combinedBox) {
          const pts = getClosestPoints(adlibBox, combinedBox);
          newLines.push({ id: `line-c-${idx}`, x1: pts.x1, y1: pts.y1, x2: pts.x2, y2: pts.y2, color: combinedBox.color });
          stat.toLyrics = Math.round(pts.dist);

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

        if (singerBox) {
          const pts = getClosestPoints(adlibBox, singerBox);
          newLines.push({ id: `line-s-${idx}`, x1: pts.x1, y1: pts.y1, x2: pts.x2, y2: pts.y2, color: singerBox.color });
          stat.toSinger = Math.round(pts.dist);

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

        if (isMulti) {
          let matchedSinger = null;
          if (syncDataRef.current) {
            for (const line of syncDataRef.current) {
              if (line.isSplit && line.adlibs) {
                const found = line.adlibs.find(a => Math.abs(a.start - adlibBox.datasetStart) < 0.001);
                if (found) {
                  matchedSinger = found.singer;
                  break;
                }
              }
            }
          }

          const centerX = adlibBox.left + adlibBox.width / 2;
          const centerY = adlibBox.top + adlibBox.height / 2;
          
          const physCol = Math.max(0, Math.min(cols - 1, Math.floor(centerX / colWidth)));
          const physRow = Math.max(0, Math.min(1, Math.floor(centerY / rowHeight)));
          const physCellIdx = physRow * cols + physCol;
          
          const quadrantArtist = getArtistForCell(physCellIdx);
          
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

      {isSingerVisible && !isMulti && activeNames.length === 1 && (
        <div 
          className="debug-fullscreen-box"
          style={{ borderColor: masterPalette[activeNames[0]] || '#ff00ff' }}
        >
        </div>
      )}

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

      {/* Render Quadrant-Aware Safe Zones & Centered Adlib Ghost Copies */}
      {safeZones.map(zone => (
        <React.Fragment key={zone.id}>
          <div
            className="debug-safe-zone"
            style={{
              top: `${zone.top}px`,
              left: `${zone.left}px`,
              width: `${zone.width}px`,
              height: `${zone.height}px`,
            }}
          >
            <span className="debug-safe-zone-label">{zone.label}</span>
          </div>

          {/* Render the calculated Inner Safe Zone for Center Coordinates */}
          {zone.innerZone && (
            <div
              className="debug-inner-safe-zone"
              style={{
                top: `${zone.innerZone.top}px`,
                left: `${zone.innerZone.left}px`,
                width: `${zone.innerZone.width}px`,
                height: `${zone.innerZone.height}px`,
              }}
            >
              <span className="debug-inner-safe-zone-label">Center-Point Safe Area</span>
            </div>
          )}

          {/* Render only the white dashed AABB box at the ideal location */}
          {adlibCopies.length > 0 && (
            <div 
              className="debug-adlib-copy-wrapper"
              style={{ 
                left: `${zone.idealX}px`, 
                top: `${zone.idealY}px`, 
                width: `${adlibCopies[0].aabbW}px`, 
                height: `${adlibCopies[0].aabbH}px`,
                transform: `translate(-50%, -50%)`
              }}
            >
              <div className="debug-adlib-copy-box" />
            </div>
          )}
        </React.Fragment>
      ))}

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