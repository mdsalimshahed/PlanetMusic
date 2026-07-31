/* --- src/components/FocusedAdlibsTracker.jsx --- */
import React, { useMemo, useRef, useEffect, useState, useLayoutEffect } from 'react';
import { normalizeTrans } from './LyricsLineRenderer';

// Deterministic pseudo-random float generator to keep rot/variation steady per ad-lib
const pseudoRandom = (seedStr) => {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash++) * 10000;
  return x - Math.floor(x);
};

export const FocusedAdlibsTracker = React.memo(({ syncData, handleLineClick, masterPalette, isPlayingCurrentSong }) => {
  const containerRef = useRef(null);
  const cachedTrackNodesRef = useRef([]);
  const adlibDomRefs = useRef({});
  const [gridPositions, setGridPositions] = useState({});

  // ------------------------------------------------------------------
  // GRAPH-BASED OCCUPIED GRID POINT PLACEMENT ENGINE (WITH CANVAS BOUNDS CLAMP)
  // ------------------------------------------------------------------
  const computeGraphPositions = () => {
    const parentContainer = containerRef.current?.parentElement;
    const activeFocusedLine = document.querySelector('.focused-line.active');
    
    if (!parentContainer) return;
    const canvasWidth = parentContainer.clientWidth;
    const canvasHeight = parentContainer.clientHeight;
    
    if (canvasWidth === 0 || canvasHeight === 0) return;
    
    // Outer safe perimeter margin to completely prevent clipping off canvas edges
    const marginPx = 16; 

    // 1. Calculate Main Lyrics Occupied Box on Graph Paper
    let occupiedBox = {
      left: canvasWidth * 0.10,
      right: canvasWidth * 0.90,
      top: canvasHeight * 0.30,
      bottom: canvasHeight * 0.70
    };

    if (activeFocusedLine) {
      const parentRect = parentContainer.getBoundingClientRect();
      const lineRect = activeFocusedLine.getBoundingClientRect();
      const translationEl = activeFocusedLine.querySelector('.chunk-translation, .focused-translation');
      const transliterationEl = activeFocusedLine.querySelector('.pronunciation-text');
      
      let topY = lineRect.top - parentRect.top;
      let bottomY = lineRect.bottom - parentRect.top;

      if (translationEl) {
        const transRect = translationEl.getBoundingClientRect();
        topY = Math.min(topY, transRect.top - parentRect.top);
      }
      if (transliterationEl) {
        const translitRect = transliterationEl.getBoundingClientRect();
        bottomY = Math.max(bottomY, translitRect.bottom - parentRect.top);
      }

      const paddingPx = 36; // Safe perimeter buffer around main line
      occupiedBox = {
        left: Math.max(0, lineRect.left - parentRect.left - paddingPx),
        right: Math.min(canvasWidth, lineRect.right - parentRect.left + paddingPx),
        top: Math.max(0, topY - paddingPx),
        bottom: Math.min(canvasHeight, bottomY + paddingPx)
      };
    }

    const claimedBoxes = [occupiedBox];
    const newGridPositions = {};

    // 2. Iterate through ad-libs and place them safely inside canvas bounds
    Object.keys(adlibDomRefs.current).forEach((key) => {
      const domEl = adlibDomRefs.current[key];
      if (!domEl) return;

      const adlibRect = domEl.getBoundingClientRect();
      const adlibW = Math.min(adlibRect.width || 120, canvasWidth - (marginPx * 2));
      const adlibH = adlibRect.height || 50;

      // Extract quadrant column & row targeting metadata
      const targetCol = parseInt(domEl.dataset.col || '0', 10);
      const targetRow = parseInt(domEl.dataset.row || '0', 10);
      const totalCols = Math.max(1, parseInt(domEl.dataset.totalCols || '2', 10));

      // Define Column Bounds on Graph Paper
      const colWidth = canvasWidth / totalCols;
      const colMinX = colWidth * targetCol;
      const colMaxX = colWidth * (targetCol + 1);
      const targetCenterX = colMinX + colWidth / 2;

      // Candidate Y positions based on targeted Row (Row 0 = Top, Row 1 = Bottom)
      const seedVal = pseudoRandom(key);
      const candidatePoints = [];

      if (targetRow === 0) {
        // Upper Quadrant Candidates (Row 0)
        const safeUpperY = Math.max(marginPx, occupiedBox.top - adlibH - 20);
        candidatePoints.push({ x: targetCenterX - adlibW / 2, y: safeUpperY });
        candidatePoints.push({ x: Math.max(colMinX + marginPx, targetCenterX - adlibW / 2 - 20), y: Math.max(marginPx, safeUpperY - 10) });
        candidatePoints.push({ x: Math.min(colMaxX - adlibW - marginPx, targetCenterX - adlibW / 2 + 20), y: Math.max(marginPx, safeUpperY - 10) });
      } else {
        // Lower Quadrant Candidates (Row 1)
        const safeLowerY = Math.min(canvasHeight - adlibH - marginPx, occupiedBox.bottom + 20);
        candidatePoints.push({ x: targetCenterX - adlibW / 2, y: safeLowerY });
        candidatePoints.push({ x: Math.max(colMinX + marginPx, targetCenterX - adlibW / 2 - 20), y: Math.min(canvasHeight - adlibH - marginPx, safeLowerY + 10) });
        candidatePoints.push({ x: Math.min(colMaxX - adlibW - marginPx, targetCenterX - adlibW / 2 + 20), y: Math.min(canvasHeight - adlibH - marginPx, safeLowerY + 10) });
      }

      if (seedVal > 0.5) {
        candidatePoints.reverse();
      }

      let selectedPoint = null;

      // Check Grid Collision against Occupied Box & other claimed ad-libs
      for (const pt of candidatePoints) {
        // Strict boundary clamp to guarantee ad-lib stays 100% inside canvas area
        const clampedX = Math.max(marginPx, Math.min(canvasWidth - adlibW - marginPx, pt.x));
        const clampedY = Math.max(marginPx, Math.min(canvasHeight - adlibH - marginPx, pt.y));

        const testBox = {
          left: clampedX,
          right: clampedX + adlibW,
          top: clampedY,
          bottom: clampedY + adlibH
        };

        const intersects = claimedBoxes.some((b) => {
          return !(
            testBox.right < b.left ||
            testBox.left > b.right ||
            testBox.bottom < b.top ||
            testBox.top > b.bottom
          );
        });

        if (!intersects) {
          selectedPoint = { x: clampedX, y: clampedY };
          claimedBoxes.push(testBox);
          break;
        }
      }

      // Fallback: Clamp strictly inside canvas & outside occupied box
      if (!selectedPoint) {
        const fallbackY = targetRow === 1
          ? Math.min(canvasHeight - adlibH - marginPx, occupiedBox.bottom + 20)
          : Math.max(marginPx, occupiedBox.top - adlibH - 20);

        const clampedX = Math.max(
          marginPx,
          Math.min(canvasWidth - adlibW - marginPx, targetCenterX - adlibW / 2)
        );

        selectedPoint = { x: clampedX, y: fallbackY };
        claimedBoxes.push({
          left: selectedPoint.x,
          right: selectedPoint.x + adlibW,
          top: selectedPoint.y,
          bottom: selectedPoint.y + adlibH
        });
      }

      // Convert final Graph Coordinates into Percentages
      const topPct = ((selectedPoint.y + adlibH / 2) / canvasHeight) * 100;
      const leftPct = ((selectedPoint.x + adlibW / 2) / canvasWidth) * 100;

      newGridPositions[key] = { top: topPct, left: leftPct };
    });

    setGridPositions(newGridPositions);
  };

  useLayoutEffect(() => {
    if (!isPlayingCurrentSong) return;
    computeGraphPositions();

    const handleResize = () => computeGraphPositions();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [syncData, isPlayingCurrentSong]);

  // ------------------------------------------------------------------
  // AD-LIB QUADRANT MAPPING & ROOT-LEVEL FORMATTING COLLECTOR
  // ------------------------------------------------------------------
  const adlibsToRender = useMemo(() => {
    const items = [];
    if (!syncData) return items;
    
    const currentTime = window.currentAudioTime || 0;

    const globalSingers = Object.keys(masterPalette || {}).filter(Boolean);
    const totalCols = Math.max(2, globalSingers.length);

    syncData.forEach((node) => {
      if (node?.isSplit && node.adlibs) {
        
        const lineActiveNames = node.singer?.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) || [];
        const isMulti = lineActiveNames.length > 1;
        const totalCells = totalCols * 2;
        
        const getArtistForCell = (cellIndex) => {
          if (lineActiveNames.length === 0) return null;
          const row = Math.floor(cellIndex / totalCols);
          const col = cellIndex % totalCols;
          return lineActiveNames[(col + row) % lineActiveNames.length];
        };

        node.adlibs.forEach((adlib, j) => {
          if (adlib.start === null) return;
          
          const key = `adlib-${adlib.start}-${j}`;
          const seedBase = `${node.text}-${adlib.start}-${j}`;
          const randRot = pseudoRandom(seedBase + '-rot');
          const rowSeed = pseudoRandom(seedBase + '-row');
          const rot = (randRot * 12) - 6; 
          
          const adlibNames = adlib.singer?.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) || [];
          const primaryAdlibSinger = adlibNames[0];

          let targetRow = 0;
          let targetCol = 0;

          let validCells = [];
          if (isMulti && primaryAdlibSinger) {
            for (let i = 0; i < totalCells; i++) {
              if (getArtistForCell(i) === primaryAdlibSinger) {
                validCells.push(i);
              }
            }
          }

          if (validCells.length > 0) {
            const pickIndex = Math.floor(pseudoRandom(seedBase + '-cell') * validCells.length);
            const chosenCell = validCells[pickIndex];
            targetRow = Math.floor(chosenCell / totalCols);
            targetCol = chosenCell % totalCols;
          } else {
            targetRow = rowSeed > 0.5 ? 1 : 0;
            targetCol = Math.floor(pseudoRandom(seedBase + '-col') * totalCols);
          }

          const pos = gridPositions[key] || { top: targetRow === 0 ? 15 : 75, left: (targetCol + 0.5) * (100 / totalCols) };

          const renderAdlibPure = (adlibObj) => {
            let aPron = adlibObj?.pronunciation;
            let aTrans = '';

            if (typeof aPron === 'string') {
              if (aPron.startsWith('{')) {
                try { aTrans = JSON.parse(aPron).full || ''; } catch (e) {}
              } else if (aPron.startsWith('[')) {
                try { aTrans = JSON.parse(aPron).map(c => c.trans || c.text).join(''); } catch (e) {}
              } else { aTrans = aPron; }
            }

            let adlibTranslation = adlibObj?.translation || '';
            if (adlibTranslation) adlibTranslation = adlibTranslation.replace(/[()]/g, '').trim();

            const basePronStyle = {
              fontSize: 'var(--dyn-translit-font-size, 0.55em)',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              textAlign: 'center',
              marginTop: 'var(--dyn-translit-bottom-padding, 4px)',
              display: 'inline-block'
            };

            const segs = adlibObj.segments || [{ text: adlibObj.text }];
            const renderedSegments = [];
            let charIdxCounter = 0;

            segs.forEach((seg, segIdx) => {
              let inlineColor = seg.color || '#ffffff';
              let inlineIsGradient = seg.isGradient || false;
              let inlineGradient = seg.gradient || '';

              if (seg.artists && seg.artists.length > 0) {
                if (seg.artists.length > 1) {
                  inlineIsGradient = true;
                  const c1 = masterPalette[seg.artists[0]] || '#ffffff';
                  const c2 = masterPalette[seg.artists[1]] || '#ffffff';
                  inlineGradient = `linear-gradient(90deg, ${c1}, ${c2})`;
                } else {
                  inlineColor = masterPalette[seg.artists[0]] || inlineColor;
                }
              }

              const segChars = Array.from(seg.text || '');
              const renderedChars = segChars.map((char) => {
                const isPunct = /([.,!?;:"'()\[\]{}\- ]+)/.test(char);
                let style = {};

                if (isPunct) {
                  style.color = '#fbbf24';
                  style.textShadow = '0 0 10px rgba(251, 191, 36, 0.6)';
                } else if (inlineIsGradient) {
                  style.backgroundImage = inlineGradient;
                  style.WebkitBackgroundClip = 'text';
                  style.WebkitTextFillColor = 'transparent';
                  style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 20px rgba(255,255,255,0.4))';
                } else {
                  style.color = inlineColor;
                  style.textShadow = `0 4px 8px rgba(0,0,0,0.9), 0 0 20px ${inlineColor}80`;
                }

                return (
                  <span key={charIdxCounter++} style={style}>
                    {char}
                  </span>
                );
              });

              renderedSegments.push(
                <React.Fragment key={segIdx}>
                  {renderedChars}
                </React.Fragment>
              );
            });

            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%', position: 'relative' }}>
                {adlibTranslation && (
                  <span 
                    className="chunk-translation" 
                    style={{ 
                      opacity: 1, 
                      visibility: 'visible',
                      position: 'relative',
                      top: 'auto', 
                      left: 'auto', 
                      transform: 'none', 
                      marginBottom: '6px',
                      maxWidth: '100%',
                      width: 'max-content'
                    }} 
                    dir="ltr"
                  >
                    {adlibTranslation}
                  </span>
                )}
                <span className="primary-text" style={{ whiteSpace: 'pre-wrap', display: 'inline-block' }} dir="auto">
                  {renderedSegments}
                </span>
                {aTrans ? <span className="pronunciation-text" style={basePronStyle} dir="ltr">{normalizeTrans(aTrans)}</span> : null}
              </div>
            );
          };

          const rendered = renderAdlibPure(adlib);
          const start = adlib.start;
          const end = adlib.end !== null ? adlib.end : start + 5;
          const isActive = isPlayingCurrentSong && currentTime >= start && currentTime <= end;

          items.push({
            key,
            start,
            end,
            rot,
            top: pos.top,
            left: pos.left,
            targetCol,
            targetRow,
            totalCols,
            rendered,
            adlib,
            initialClass: isActive ? 'active' : ''
          });
        });
      }
    });

    return items;
  }, [syncData, masterPalette, isPlayingCurrentSong, gridPositions]);

  // Fast DOM cache update for time ticks
  useEffect(() => {
    if (containerRef.current) {
      cachedTrackNodesRef.current = Array.from(containerRef.current.querySelectorAll('.focused-adlib-line')).map(node => ({
        node,
        start: parseFloat(node.dataset.start),
        end: parseFloat(node.dataset.end),
        isActive: node.classList.contains('active')
      }));
    }
  }, [adlibsToRender]);

  // Audio Playback Time Sync
  useEffect(() => {
    const clearActiveNodes = () => {
        if (cachedTrackNodesRef.current.length > 0) {
            cachedTrackNodesRef.current.forEach(item => {
                if (item.isActive) {
                    item.node.classList.remove('active');
                    item.isActive = false;
                }
            });
        }
    };

    if (!isPlayingCurrentSong) {
      clearActiveNodes();
      return;
    }

    const handleTime = (e) => {
      const time = e.detail;
      const nodes = cachedTrackNodesRef.current;

      for (let i = 0; i < nodes.length; i++) {
        const item = nodes[i];
        const shouldBeActive = time >= item.start && time <= item.end;

        if (shouldBeActive && !item.isActive) {
          item.node.classList.add('active');
          item.isActive = true;
        } else if (!shouldBeActive && item.isActive) {
          item.node.classList.remove('active');
          item.isActive = false;
        }
      }
    };

    // CRITICAL FIX: Gracefully fade out any remaining floating adlibs when the song ends
    const handlePlayState = (e) => {
        if (e.detail.isEnded) {
            clearActiveNodes();
        }
    };

    window.addEventListener('globalTimeUpdate', handleTime);
    window.addEventListener('globalPlayState', handlePlayState);
    return () => {
        window.removeEventListener('globalTimeUpdate', handleTime);
        window.removeEventListener('globalPlayState', handlePlayState);
    };
  }, [isPlayingCurrentSong]);

  if (adlibsToRender.length === 0) return null;

  return (
    <div className="focused-adlibs-container" ref={containerRef}>
      {adlibsToRender.map(item => (
        <div
          key={item.key}
          ref={(el) => (adlibDomRefs.current[item.key] = el)}
          className={`focused-adlib-line ${item.initialClass}`}
          data-start={item.start}
          data-end={item.end}
          data-col={item.targetCol}
          data-row={item.targetRow}
          data-total-cols={item.totalCols}
          style={{
            '--adlib-rot': `${item.rot}deg`,
            '--adlib-top': `${item.top}%`,
            '--adlib-left': `${item.left}%`
          }}
          onClick={(e) => { e.stopPropagation(); handleLineClick(item.adlib.start); }}
        >
          {item.rendered}
        </div>
      ))}
    </div>
  );
});