/* --- src/components/FocusedAdlibsTracker.jsx --- */
import React, { useMemo, useRef, useEffect } from 'react';
import { normalizeTrans, renderFormattedTranslation } from "../Lyrics/LyricsLineRenderer";
import { generateSafeAdlibPosition, getRelativeRect, pseudoRandom } from "../../AdlibDebug/adlibPlacementLogic";

// GLOBAL CACHE: Persists calculated ad-lib positions in memory even if you go to the dashboard!
// Only clears mathematically if window size or song lyrics change.
const adlibPlacementCache = new Map();

export const FocusedAdlibsTracker = React.memo(({ syncData, handleLineClick, masterPalette, isPlayingCurrentSong }) => {
  const containerRef = useRef(null);
  const cachedTrackNodesRef = useRef([]);

  // Generate a totally stable session seed based directly on the lyrics.
  // If the lyrics remain the same, the seed is identical (persists across dashboard returns).
  // If lyrics change, the seed changes automatically, naturally wiping the cache!
  const sessionSeed = useMemo(() => {
    if (!syncData || syncData.length === 0) return 'empty_seed';
    const textHash = syncData.map(d => d.text).join('').substring(0, 50);
    return `seed_${Math.floor(pseudoRandom(textHash) * 100000)}`;
  }, [syncData]);

  // ------------------------------------------------------------------
  // AD-LIB COMPILATION & RENDER GENERATOR
  // ------------------------------------------------------------------
  const adlibsToRender = useMemo(() => {
    const items = [];
    if (!syncData) return items;
    let globalAdlibCounter = 0;

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
              whiteSpace: 'nowrap' // FIX: Ensure ad-lib transliterations do not independently wrap internally
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
                      whiteSpace: 'pre'
                    }}
                    dir="ltr"
                  >
                    {renderFormattedTranslation(adlibTranslation)}
                  </span>
                )}
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
            globalIndex: globalAdlibCounter++, 
            sessionSeed, 
            seedBase,
            start,
            end,
            isMulti,
            cols,
            activeSingersList,
            activeNames: lineActiveNames,
            parentStart: node.start, // <--- CRITICAL FIX: Direct link back to parent DOM element
            rendered: renderAdlibPure(adlib)
          });
        });
      }
    });
    return items;
  }, [syncData, masterPalette, sessionSeed]);

  // Update DOM Ref cache quietly when components mount
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
          sessionSeed: dataItem.sessionSeed,
          seedBase: dataItem.seedBase,
          isMulti: dataItem.isMulti,
          cols: dataItem.cols,
          activeSingersList: dataItem.activeSingersList,
          activeNames: dataItem.activeNames,
          parentStart: dataItem.parentStart,
          isActive: node.classList.contains('active')
        };
      });
    }
  }, [adlibsToRender]);

  // ------------------------------------------------------------------
  // JIT (JUST-IN-TIME) PLACEMENT CACHE ENGINE - ZERO IDLE CPU USAGE
  // ------------------------------------------------------------------
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
          
          // Use Browser Memory Cache mapping Window Size + Unique Adlib Key
          const cacheKey = `${item.sessionSeed}_${item.key}_${window.innerWidth}x${window.innerHeight}`;
          let pos = adlibPlacementCache.get(cacheKey);

          // JIT Calculation ONLY if missing from memory cache
          if (!pos) {
            const container = containerRef.current?.parentElement;
            if (container) {
              const containerRect = container.getBoundingClientRect();
              
              // CRITICAL FIX: Bypass the `.active` class race condition completely!
              // Select the exact DOM node this ad-lib belongs to, even if it hasn't animated in yet.
              const targetStart = item.parentStart !== null ? item.parentStart : 'NaN';
              const lyricsNode = container.querySelector(`.focused-line[data-start="${targetStart}"]`);
              const singerNode = container.querySelector('.singer-name-corner.visible');
              
              const cBox = getRelativeRect(lyricsNode, containerRect);

              // CRITICAL DOM MEASUREMENT FIX:
              // If this JIT calculation fires milliseconds before LyricsDisplay applies 
              // the '.active' class, the main text is physically sitting 20px lower (pre-transition state).
              // We must mathematically reverse this 20px shift to calculate bounds against its TRUE resting place.
              if (cBox && lyricsNode && !lyricsNode.classList.contains('active')) {
                  cBox.top -= 20;
                  cBox.bottom -= 20;
              }

              const sBox = getRelativeRect(singerNode, containerRect);
              
              pos = generateSafeAdlibPosition(
                item.node.offsetWidth || 150,
                item.node.offsetHeight || 40,
                containerRect,
                cBox,
                sBox,
                item.isMulti,
                item.cols,
                item.activeSingersList,
                item.activeNames,
                item.seedBase,
                item.globalIndex,
                item.sessionSeed
              );
              
              // Cache it so it never runs math again for this screen size!
              adlibPlacementCache.set(cacheKey, pos);
            }
          }

          // Apply variables instantly
          if (pos) {
            item.node.style.setProperty('--adlib-left', pos.left);
            item.node.style.setProperty('--adlib-top', pos.top);
            item.node.style.setProperty('--adlib-rot', `${pos.rot}deg`);
          }

          item.node.classList.add('active');
          item.isActive = true;
        } else if (!shouldBeActive && item.isActive) {
          item.node.classList.remove('active');
          item.isActive = false;
        }
      }
    };

    const handlePlayState = (e) => {
      if (e.detail.isEnded) clearActiveNodes();
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
          data-global-index={item.globalIndex}
          style={{
            '--adlib-rot': '0deg', 
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