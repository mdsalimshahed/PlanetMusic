/* --- src/components/FocusedAdlibsTracker.jsx --- */
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { normalizeTrans, renderFormattedTranslation } from './LyricsLineRenderer';
import { generateSafeAdlibPosition } from './AdlibDebug/adlibPlacementLogic';

export const FocusedAdlibsTracker = React.memo(({ syncData, handleLineClick, masterPalette, isPlayingCurrentSong }) => {
  const containerRef = useRef(null);
  const cachedTrackNodesRef = useRef([]);

  // Generate a unique seed for this specific playback session.
  const [sessionSeed] = useState(() => Math.random().toString(36).substring(2, 9));

  // ------------------------------------------------------------------
  // AD-LIB COMPILATION & RENDER GENERATOR
  // ------------------------------------------------------------------
  const adlibsToRender = useMemo(() => {
    const items = [];
    if (!syncData) return items;

    let globalAdlibCounter = 0; // Tracks consecutive sequence across the entire song

    syncData.forEach((node) => {
      if (node?.isSplit && node.adlibs) {
        
        const lineActiveNames = node.singer?.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) || [];
        const isMulti = lineActiveNames.length > 1;
        const cols = Math.max(2, lineActiveNames.length);

        node.adlibs.forEach((adlib, j) => {
          if (adlib.start === null) return;

          const key = `adlib-${adlib.start}-${j}`;
          const seedBase = `${sessionSeed}-${node.text}-${adlib.start}-${j}`;
          const activeSingersList = adlib.singer?.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) || [];

          // Standard rich-text formatting
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
              display: 'inline-block',
              whiteSpace: 'pre' // Force no wrap
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
                      width: 'max-content',
                      whiteSpace: 'pre' // Force no wrap
                    }}
                    dir="ltr"
                  >
                    {renderFormattedTranslation(adlibTranslation)}
                  </span>
                )}
                {/* FORCED NO-WRAP PREVENTS AABB MATH FROM DISTORTING */}
                <span className="primary-text" style={{ whiteSpace: 'pre', display: 'inline-block' }} dir="auto">
                  {renderedSegments}
                </span>
                {aTrans ? <span className="pronunciation-text" style={basePronStyle} dir="ltr">{renderFormattedTranslation(normalizeTrans(aTrans))}</span> : null}
              </div>
            );
          };

          const start = adlib.start;
          const end = adlib.end !== null ? adlib.end : start + 5;

          items.push({
            key,
            globalIndex: globalAdlibCounter++, // Assign global sequence ID
            seedBase,
            start,
            end,
            isMulti,
            cols,
            activeSingersList,
            activeNames: lineActiveNames,
            rendered: renderAdlibPure(adlib)
          });
        });
      }
    });
    return items;
  }, [syncData, masterPalette, sessionSeed]);

  // ------------------------------------------------------------------
  // HIGH-PERFORMANCE DOM CACHING & PLACEMENT ENGINE
  // ------------------------------------------------------------------
  
  useEffect(() => {
    if (containerRef.current) {
      cachedTrackNodesRef.current = Array.from(containerRef.current.querySelectorAll('.focused-adlib-line')).map((node, i) => {
        const dataItem = adlibsToRender[i];
        return {
          node,
          start: dataItem.start,
          end: dataItem.end,
          key: dataItem.key,
          globalIndex: dataItem.globalIndex,
          seedBase: dataItem.seedBase,
          isMulti: dataItem.isMulti,
          cols: dataItem.cols,
          activeSingersList: dataItem.activeSingersList,
          activeNames: dataItem.activeNames,
          isActive: node.classList.contains('active'),
          isPlaced: false 
        };
      });
    }
  }, [adlibsToRender]);

  useEffect(() => {
    const clearActiveNodes = () => {
      if (cachedTrackNodesRef.current.length > 0) {
        cachedTrackNodesRef.current.forEach(item => {
          if (item.isActive) {
            item.node.classList.remove('active');
            item.isActive = false;
            item.isPlaced = false; 
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
          
          if (!item.isPlaced) {
            const newPos = generateSafeAdlibPosition(
              item.node,
              item.isMulti,
              item.cols,
              item.activeSingersList,
              item.activeNames,
              item.seedBase,
              item.globalIndex
            );
            
            item.node.style.setProperty('--adlib-left', newPos.left);
            item.node.style.setProperty('--adlib-top', newPos.top);
            item.node.style.setProperty('--adlib-rot', `${newPos.rot}deg`);
            item.isPlaced = true;
          }

          item.node.classList.add('active');
          item.isActive = true;
        } else if (!shouldBeActive && item.isActive) {
          item.node.classList.remove('active');
          item.isActive = false;
          item.isPlaced = false;
        }
      }
    };

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
          className="focused-adlib-line"
          data-start={item.start}
          data-end={item.end}
          data-global-index={item.globalIndex} // Pass index so HUD can read it
          style={{
            '--adlib-rot': '0deg', // Initializes flat so math can measure it correctly
            '--adlib-top': '50%',
            '--adlib-left': '50%',
            maxWidth: 'none',
            whiteSpace: 'pre'
          }}
          onClick={(e) => { e.stopPropagation(); handleLineClick(item.start); }}
        >
          {item.rendered}
        </div>
      ))}
    </div>
  );
});