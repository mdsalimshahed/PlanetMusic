/* --- src/components/AdlibDebug/AdlibDebugOverlay.jsx --- */
import React, { useEffect, useRef, useState } from 'react';
import './AdlibDebugOverlay.css';

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
  const cachedFocusedAdlibsRef = useRef([]);

  // HUD UI States
  const [isIdle, setIsIdle] = useState(true);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [radialLines, setRadialLines] = useState([]);
  const [distanceStats, setDistanceStats] = useState([]);
  const [layoutStats, setLayoutStats] = useState({ lyricsClipped: false, singerClipped: false });
  const [safeZones, setSafeZones] = useState([]);
  const [innerSafeZones, setInnerSafeZones] = useState([]);
  const [activeAdlibSingers, setActiveAdlibSingers] = useState([]);

  const syncDataRef = useRef(selectedSong?.syncData || []);
  const prevAdlibSingersRef = useRef(null);

  useEffect(() => {
    syncDataRef.current = selectedSong?.syncData || [];
  }, [selectedSong?.syncData]);

  // --- DOM CACHE FOR DEBUG OVERLAY ---
  useEffect(() => {
    const timer = setTimeout(() => {
      cachedFocusedAdlibsRef.current = Array.from(document.querySelectorAll('.focused-adlib-line'));
    }, 200);
    return () => clearTimeout(timer);
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

      const activeAdlibs = cachedFocusedAdlibsRef.current.filter(node => node.classList.contains('active'));

      setIsIdle(activeAdlibs.length === 0);
      if (activeAdlibs.length === 0) {
        setBoundingBoxes([]);
        setRadialLines([]);
        setDistanceStats([]);
        setSafeZones([]);
        setInnerSafeZones([]);
        setLayoutStats({ lyricsClipped: false, singerClipped: false });
        rafRef.current = requestAnimationFrame(trackActiveLyrics);
        return;
      }

      const overlayRect = overlayRef.current.getBoundingClientRect();
      const previewContainer = document.querySelector('.focused-lyrics-preview') || overlayRef.current;
      const containerRect = previewContainer.getBoundingClientRect();

      const canvasTop = containerRect.top - overlayRect.top;
      const canvasLeft = containerRect.left - overlayRect.left;
      const canvasRight = containerRect.right - overlayRect.left;
      const canvasBottom = containerRect.bottom - overlayRect.top;

      const isMoreThanThree = activeNames.length > 3;
      const EDGE_PAD_X = activeNames.length > 2 ? -16 : Math.max(30, containerRect.width * 0.08);
      const EDGE_PAD_Y = isMoreThanThree ? -16 : Math.max(30, containerRect.height * 0.08);
      
      const LYRIC_PAD = 25;
      const SINGER_PAD = 20;
      const MAX_DIST = isMoreThanThree ? Infinity : 160;

      const safeTop = canvasTop + EDGE_PAD_Y;
      const safeLeft = canvasLeft + EDGE_PAD_X;
      const safeRight = canvasRight - EDGE_PAD_X;
      const safeBottom = canvasBottom - EDGE_PAD_Y;

      const activeLine = document.querySelector('.focused-line.active');
      const newBoxes = [];

      if (activeLine) {
        const tightBounds = getTightTextBounds(activeLine, overlayRect);
        if (tightBounds) {
          newBoxes.push({ id: 'combined-bounds', color: '#4ade80', ...tightBounds });
        }
      }

      const singerNameCorner = document.querySelector('.singer-name-corner.visible') || document.querySelector('.singer-name-corner');
      if (singerNameCorner) {
        const tightBounds = getTightTextBounds(singerNameCorner, overlayRect);
        if (tightBounds) {
          newBoxes.push({ id: 'singer-name-bounds', color: '#f97316', ...tightBounds });
        }
      }

      activeAdlibs.forEach((adlibNode, idx) => {
        const tightBounds = getTightTextBounds(adlibNode, overlayRect);
        const rotation = adlibNode.style.getPropertyValue('--adlib-rot') || '0deg';
        const scale = parseFloat(adlibNode.style.getPropertyValue('--adlib-scale')) || 1;
        const globalIndex = parseInt(adlibNode.dataset.globalIndex || idx, 10);

        const unrotatedWidth = adlibNode.scrollWidth * scale;
        const unrotatedHeight = adlibNode.scrollHeight * scale;

        if (tightBounds) {
          newBoxes.push({
            id: `adlib-bounds-${idx}`,
            globalIndex,
            color: '#ffffff',
            datasetStart: parseFloat(adlibNode.dataset.start),
            datasetSinger: adlibNode.dataset.singer,
            datasetParentSingers: adlibNode.dataset.parentSingers,
            rotation,
            unrotatedWidth,
            unrotatedHeight,
            ...tightBounds
          });
        } else {
          const r = adlibNode.getBoundingClientRect();
          newBoxes.push({
            id: `adlib-bounds-${idx}`,
            globalIndex,
            color: '#ffffff',
            datasetStart: parseFloat(adlibNode.dataset.start),
            datasetSinger: adlibNode.dataset.singer,
            datasetParentSingers: adlibNode.dataset.parentSingers,
            rotation,
            unrotatedWidth,
            unrotatedHeight,
            top: r.top - overlayRect.top,
            left: r.left - overlayRect.left,
            width: r.width,
            height: r.height
          });
        }
      });

      const combinedBox = newBoxes.find(b => b.id === 'combined-bounds');
      const singerBox = newBoxes.find(b => b.id === 'singer-name-bounds');
      const adlibBoxes = newBoxes.filter(b => b.id.startsWith('adlib-bounds-'));

      const newLines = [];
      const newStats = [];

      let lyricsClipped = false;
      let singerClipped = false;

      if (combinedBox) {
        if (
          combinedBox.left < canvasLeft ||
          combinedBox.top < canvasTop ||
          (combinedBox.left + combinedBox.width) > canvasRight ||
          (combinedBox.top + combinedBox.height) > canvasBottom
        ) {
          lyricsClipped = true;
        }
      }

      if (singerBox) {
        if (
          singerBox.left < canvasLeft ||
          singerBox.top < canvasTop ||
          (singerBox.left + singerBox.width) > canvasRight ||
          (singerBox.top + singerBox.height) > canvasBottom
        ) {
          singerClipped = true;
        }
      }

      setLayoutStats({ lyricsClipped, singerClipped });

      const currentAdlibSingers = adlibBoxes.length > 0 ? adlibBoxes[0].datasetSinger : null;
      const activeSingersList = currentAdlibSingers
        ? currentAdlibSingers.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      if (currentAdlibSingers !== prevAdlibSingersRef.current) {
        prevAdlibSingersRef.current = currentAdlibSingers;
        setActiveAdlibSingers(activeSingersList);
      }

      const newSafeZones = [];
      const newInnerZones = [];

      const validCells = [];
      if (!isMulti || activeSingersList.length === 0) {
        validCells.push({ left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom, width: safeRight - safeLeft, height: safeBottom - safeTop });
      } else {
        const colWidth = overlayRect.width / cols;
        const rowHeight = overlayRect.height / 2;

        for (let i = 0; i < cols * 2; i++) {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const artist = getArtistForCell(i);

          if (activeSingersList.includes(artist)) {
            const cellLeft = col === 0 ? safeLeft : col * colWidth;
            const cellRight = col === cols - 1 ? safeRight : (col + 1) * colWidth;
            const cellTop = row === 0 ? safeTop : row * rowHeight;
            const cellBottom = row === 1 ? safeBottom : (row + 1) * rowHeight;

            validCells.push({
              left: cellLeft,
              right: cellRight,
              top: cellTop,
              bottom: cellBottom,
              width: cellRight - cellLeft,
              height: cellBottom - cellTop
            });
          }
        }
      }

      if (combinedBox) {
        const baseZones = [];

        if (combinedBox.top > safeTop) {
          const bottomEdge = combinedBox.top - LYRIC_PAD;
          const topEdge = Math.max(safeTop, bottomEdge - MAX_DIST);
          if (bottomEdge > topEdge) {
            baseZones.push({ type: 'Top', left: safeLeft, right: safeRight, top: topEdge, bottom: bottomEdge });
          }
        }

        if (combinedBox.top + combinedBox.height < safeBottom) {
          const topEdge = combinedBox.top + combinedBox.height + LYRIC_PAD;
          let bottomEdge = Math.min(safeBottom, topEdge + MAX_DIST);

          if (singerBox && singerBox.top < safeBottom) {
            const sTopAdjusted = singerBox.top - SINGER_PAD;
            if (sTopAdjusted > topEdge) {
              bottomEdge = Math.min(bottomEdge, sTopAdjusted);
              baseZones.push({ type: 'Bottom', left: safeLeft, right: safeRight, top: topEdge, bottom: bottomEdge });
            }
          } else {
            if (bottomEdge > topEdge) {
              baseZones.push({ type: 'Bottom', left: safeLeft, right: safeRight, top: topEdge, bottom: bottomEdge });
            }
          }
        }

        baseZones.forEach(bz => {
          validCells.forEach(vc => {
            const ixLeft = Math.max(bz.left, vc.left);
            const ixRight = Math.min(bz.right, vc.right);
            const ixTop = Math.max(bz.top, vc.top);
            const ixBottom = Math.min(bz.bottom, vc.bottom);

            if (ixLeft < ixRight && ixTop < ixBottom) {
              newSafeZones.push({
                id: `sz-${bz.type}-${Math.round(ixLeft)}-${Math.round(ixTop)}`,
                top: ixTop,
                left: ixLeft,
                width: ixRight - ixLeft,
                height: ixBottom - ixTop,
                label: `${bz.type} Zone`
              });
            }
          });
        });
      }

      const activeViableZones = newSafeZones.length > 0 ? newSafeZones :
        (validCells.length > 0 ? validCells.map((vc, i) => ({...vc, id: `sz-vc-${i}`, label: 'Valid Cell'})) :
        [{ id: 'sz-full', left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom, width: safeRight - safeLeft, height: safeBottom - safeTop, label: 'Full Safe Zone' }]);

      setSafeZones(activeViableZones);

      adlibBoxes.forEach((adlibBox, idx) => {
        let stat = {
          id: adlibBox.globalIndex !== undefined ? adlibBox.globalIndex : idx,
          rotation: adlibBox.rotation,
          toCenter: null,
          isCorrect: true,
          quadArtist: null,
          evalMode: 'Full Screen',
          isCollidingWithLyrics: false,
          isCollidingWithSinger: false,
          isClippedOut: false,
          isRotationCorrect: false,
          expectedRotation: 0
        };

        const aRight = adlibBox.left + adlibBox.width;
        const aBottom = adlibBox.top + adlibBox.height;
        const centerX = adlibBox.left + adlibBox.width / 2;
        const centerY = adlibBox.top + adlibBox.height / 2;

        const canvasMidX = overlayRect.width / 2;
        const canvasMidY = overlayRect.height / 2;
        const distToCenter = Math.round(Math.sqrt(Math.pow(centerX - canvasMidX, 2) + Math.pow(centerY - canvasMidY, 2)));

        const actualRot = parseFloat(adlibBox.rotation) || 0;
        const rotMultiplier = (centerX - canvasMidX) / (canvasMidX || 1);
        const ySign = (centerY < canvasMidY) ? 1 : -1;
        const expectedBaseRot = rotMultiplier * ySign * 18;

        stat.isRotationCorrect = Math.abs(actualRot - expectedBaseRot) <= 12;
        stat.expectedRotation = expectedBaseRot;

        newLines.push({
          id: `radial-${stat.id}`,
          x1: centerX,
          y1: centerY,
          x2: canvasMidX,
          y2: canvasMidY,
          color: '#00ffff'
        });

        stat.toCenter = distToCenter;

        if (
          adlibBox.left < safeLeft ||
          adlibBox.top < safeTop ||
          aRight > safeRight ||
          aBottom > safeBottom
        ) {
          stat.isClippedOut = true;
        }

        if (combinedBox) {
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

        const adlibActiveNames = adlibBox.datasetParentSingers ? adlibBox.datasetParentSingers.split(',').map(s=>s.trim()).filter(Boolean) : [];
        const isAdlibMulti = adlibActiveNames.length > 1;
        const adlibCols = Math.max(2, adlibActiveNames.length);

        const getAdlibArtistForCell = (cellIndex) => {
          if (adlibActiveNames.length === 0) return null;
          const row = Math.floor(cellIndex / adlibCols);
          const col = cellIndex % adlibCols;
          return adlibActiveNames[(col + row) % adlibActiveNames.length];
        };

        if (isAdlibMulti) {
          const matchedSinger = adlibBox.datasetSinger || '';

          const colWidth = overlayRect.width / adlibCols;
          const rowHeight = overlayRect.height / 2;

          const physCol = Math.max(0, Math.min(adlibCols - 1, Math.floor(centerX / colWidth)));
          const physRow = Math.max(0, Math.min(1, Math.floor(centerY / rowHeight)));
          const physCellIdx = physRow * adlibCols + physCol;

          const quadrantArtist = getAdlibArtistForCell(physCellIdx);

          if (matchedSinger && quadrantArtist) {
            const parsedSingers = matchedSinger.split(',').map(s => s.trim()).filter(Boolean);
            stat.isCorrect = parsedSingers.includes(quadrantArtist);
          } else {
            stat.isCorrect = false;
          }
          stat.quadArtist = quadrantArtist;
          stat.evalMode = `Matrix (${adlibCols}x2)`;
        } else {
          stat.evalMode = 'Full Screen';
        }

        newStats.push(stat);

        activeViableZones.forEach((zone, zIdx) => {
          // Sync with the safe logic radius
          const safeRadius = Math.sqrt(Math.pow(adlibBox.unrotatedWidth, 2) + Math.pow(adlibBox.unrotatedHeight, 2)) / 2;
          const padX = safeRadius + 5; 
          const padY = safeRadius + 5;

          let iLeft = zone.left + padX;
          let iRight = zone.left + zone.width - padX;
          let iTop = zone.top + padY;
          let iBottom = zone.top + zone.height - padY;

          if (iLeft > iRight) {
            const mid = zone.left + zone.width / 2;
            iLeft = iRight = mid;
          }
          if (iTop > iBottom) {
            const mid = zone.top + zone.height / 2;
            iTop = iBottom = mid;
          }

          newInnerZones.push({
            id: `inner-sz-${idx}-${zIdx}`,
            left: iLeft,
            top: iTop,
            width: Math.max(1, iRight - iLeft),
            height: Math.max(1, iBottom - iTop),
            label: `Center Bounds`
          });
        });
      });

      setBoundingBoxes(newBoxes);
      setRadialLines(newLines);
      setDistanceStats(newStats);
      setInnerSafeZones(newInnerZones);
      rafRef.current = requestAnimationFrame(trackActiveLyrics);
    };

    rafRef.current = requestAnimationFrame(trackActiveLyrics);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cols, isMulti, currentSingerBg?.name]);

  return (
    <div className="adlib-debug-overlay" ref={overlayRef}>
      <svg className="debug-svg-layer">
        {radialLines.map(line => (
          <g key={line.id}>
            <line
              x1={line.x1} y1={line.y1}
              x2={line.x2} y2={line.y2}
              stroke={line.color} strokeWidth="1.5" strokeDasharray="6 4"
            />
            <circle cx={line.x2} cy={line.y2} r="4" fill="#ff00ff" />
            <circle cx={line.x1} cy={line.y1} r="3" fill="#ffffff" />
          </g>
        ))}
      </svg>
      <div className="debug-hud-panel">
        <div><strong>Current Singer(s):</strong> {currentSingerBg?.name || 'None'}</div>
        <div><strong>Active Adlib Singer:</strong> {activeAdlibSingers.length > 0 ? activeAdlibSingers.join(', ') : 'None'}</div>
        <div><strong>Layout Mode:</strong> {activeNames.length === 0 ? 'Idle' : (isMulti ? `Matrix (${cols}x2)` : 'Full Screen')}</div>
        
        {isIdle ? (
          <div style={{ color: '#4ade80', marginTop: '10px', fontSize: '13px' }}>
            <strong>Status:</strong> Idle (Calculations Paused)
          </div>
        ) : (
          <>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '6px', marginTop: '6px' }}>
              <strong>Core Layout Status:</strong>{' '}
              {layoutStats.lyricsClipped ? (
                <span style={{color: '#ef4444'}}>Lyrics Clipped</span>
              ) : (
                <span style={{color: '#4ade80'}}>  Lyrics Safe</span>
              )}{' | '}
              {layoutStats.singerClipped ? (
                <span style={{color: '#ef4444'}}>Name Clipped</span>
              ) : (
                <span style={{color: '#4ade80'}}>  Name Safe</span>
              )}
            </div>
            {distanceStats.length > 0 && distanceStats.map(stat => (
              <div key={`stat-${stat.id}`} style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div>
                  <strong>Adlib {stat.id} Radial:</strong>
                  {` Dist: ${stat.toCenter}px | Angle: ${parseFloat(stat.rotation).toFixed(1)}`}
                  {stat.isRotationCorrect ? (
                    <span style={{color: '#4ade80'}}>   Valid</span>
                  ) : (
                    <span style={{color: '#ef4444'}}>   Invalid (Exp: ~{stat.expectedRotation.toFixed(1)})</span>
                  )}
                </div>
                <div>
                  <strong>Placement:</strong> {stat.isCorrect ? (
                      <span style={{color: '#4ade80'}}>  Correct Quadrant ({stat.evalMode})</span>
                    ) : (
                      <span style={{color: '#ef4444'}}>  Wrong (in {stat.quadArtist}'s quad)</span>
                    )}
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
          </>
        )}
      </div>
      {isSingerVisible && !isMulti && activeNames.length === 1 && (
        <div className="debug-fullscreen-box" style={{ borderColor: masterPalette[activeNames[0]] || '#ff00ff' }}></div>
      )}
      {isSingerVisible && isMulti && (
        <div className="debug-matrix-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
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
      {safeZones.map(zone => (
        <React.Fragment key={zone.id}>
          <div
            className="debug-safe-zone"
            style={{ top: `${zone.top}px`, left: `${zone.left}px`, width: `${zone.width}px`, height: `${zone.height}px` }}
          >
            <span className="debug-safe-zone-label">{zone.label}</span>
          </div>
        </React.Fragment>
      ))}
      {innerSafeZones.map(zone => (
        <React.Fragment key={zone.id}>
          <div
            className="debug-inner-safe-zone"
            style={{ top: `${zone.top}px`, left: `${zone.left}px`, width: `${zone.width}px`, height: `${zone.height}px` }}
          >
            <span className="debug-inner-safe-zone-label">{zone.label}</span>
          </div>
        </React.Fragment>
      ))}
      {boundingBoxes.map(box => (
        <div
          key={box.id}
          className="debug-bounding-box"
          style={{ top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px`, borderColor: box.color }}
        >
          {box.id.startsWith('adlib-bounds') && (
            <span style={{
              position: 'absolute',
              top: '-12px',
              left: 0,
              background: 'white',
              color: 'black',
              fontSize: '10px',
              padding: '1px 4px',
              fontWeight: 'bold',
              lineHeight: 1,
              borderRadius: '2px'
            }}>
              Adlib #{box.globalIndex !== undefined ? box.globalIndex : box.id.replace('adlib-bounds-', '')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdlibDebugOverlay;