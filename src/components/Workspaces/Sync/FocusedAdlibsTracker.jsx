/* --- src/components/Workspaces/Sync/FocusedAdlibsTracker.jsx --- */
import React, { useMemo, useRef, useEffect } from 'react';
import { generateSafeAdlibPosition, getRelativeRect } from "../../AdlibDebug/adlibPlacementLogic";
import { getGraphemes, normalizeTrans, isCJ } from '../../LyricsRenderer/textUtils';
import { alignChunksWithTransliteration, renderFormattedTranslation } from "../../LyricsRenderer/Formatters";

export const FocusedAdlibsTracker = React.memo(({ syncData, handleLineClick, masterPalette, isPlayingCurrentSong }) => {
  const containerRef = useRef(null);
  const cachedTrackNodesRef = useRef([]);

  const adlibsToRender = useMemo(() => {
    const items = [];
    if (!Array.isArray(syncData)) return items;

    syncData.forEach((node) => {
      if (node?.isSplit && node.adlibs) {
        const lineActiveNames = node.singer?.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) || [];
        const isMulti = lineActiveNames.length > 1;
        const cols = Math.max(2, lineActiveNames.length);

        node.adlibs.forEach((adlib, j) => {
          if (adlib.start === null) return;
          
          const key = `adlib-${adlib.start}-${j}`;
          const activeSingersList = adlib.singer?.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) || [];

          const renderAdlibPure = (adlibObj) => {
            const basePronStyle = {
              fontSize: 'var(--dyn-translit-font-size, 0.55em)',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              textAlign: 'center',
              marginTop: 'var(--dyn-translit-bottom-padding, 4px)',
              display: 'inline-block',
              whiteSpace: 'nowrap'
            };

            const activeSpacingText = adlibObj.spacingText || '';
            const useSpacingText = Boolean(activeSpacingText && activeSpacingText.trim());
            const activeDisplayText = useSpacingText ? activeSpacingText : adlibObj.text || '';
            
            let adlibChars = [];
            let segmentPointer = 0;
            let charPointerInSegment = 0;
            const segs = adlibObj.segments || [{ text: adlibObj.text }];

            if (useSpacingText) {
              const spacedGraphemes = getGraphemes(activeDisplayText);
              const origGraphemes = getGraphemes(adlibObj.text || '');
              let origPointer = 0;
              
              spacedGraphemes.forEach((char, idx) => {
                let currentSeg = segs[segmentPointer] || segs[segs.length - 1] || {};
                let isOrigChar = false;
                
                if (origPointer < origGraphemes.length && char === origGraphemes[origPointer]) {
                    isOrigChar = true;
                } else if (/\s/.test(char) && origPointer < origGraphemes.length && !/\s/.test(origGraphemes[origPointer])) {
                    isOrigChar = false;
                } else {
                    isOrigChar = !/\s/.test(char);
                }

                adlibChars.push({
                  char,
                  seg: currentSeg,
                  globalIndex: idx
                });

                if (isOrigChar) {
                  origPointer++;
                  charPointerInSegment += getGraphemes(char).length;
                  if (currentSeg && charPointerInSegment >= getGraphemes(currentSeg.text || '').length) {
                    segmentPointer++;
                    charPointerInSegment = 0;
                  }
                }
              });
            } else {
              const graphemes = getGraphemes(activeDisplayText);
              graphemes.forEach((char, idx) => {
                let currentSeg = segs[segmentPointer] || segs[segs.length - 1] || {};
                adlibChars.push({
                  char,
                  seg: currentSeg,
                  globalIndex: idx
                });

                charPointerInSegment += getGraphemes(char).length;
                if (currentSeg && charPointerInSegment >= getGraphemes(currentSeg.text || '').length) {
                  segmentPointer++;
                  charPointerInSegment = 0;
                }
              });
            }

            const renderColoredCharForTracker = (c, globalIdx) => {
              let inlineColor = c.seg?.color || '#ffffff';
              let inlineIsGradient = c.seg?.isGradient || false;
              let inlineGradient = c.seg?.gradient || '';
              
              if (c.seg?.artists && c.seg.artists.length > 0) {
                if (c.seg.artists.length > 1) {
                  inlineIsGradient = true;
                  const c1 = masterPalette[c.seg.artists[0]] || '#ffffff';
                  const c2 = masterPalette[c.seg.artists[1]] || '#ffffff';
                  inlineGradient = `linear-gradient(90deg, ${c1}, ${c2})`;
                } else {
                  inlineColor = masterPalette[c.seg.artists[0]] || inlineColor;
                }
              }

              const isPunct = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(c.char);
              let style = {};

              if (isPunct && c.char.trim() !== '') {
                style.color = '#fbbf24';
                style.WebkitTextFillColor = '#fbbf24';
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

              return <span key={globalIdx} style={style}>{c.char === ' ' ? '\u00A0' : c.char}</span>;
            };

            let aParsedChunks = null;
            let aFullTrans = null;
            let aPron = adlibObj?.pronunciation;
            
            if (typeof aPron === 'string') {
              if (aPron.startsWith('{')) {
                try {
                  const p = JSON.parse(aPron);
                  aParsedChunks = p.chunks;
                  aFullTrans = p.full;
                } catch (e) {}
              } else if (aPron.startsWith('[')) {
                try { aParsedChunks = JSON.parse(aPron); } catch (e) {}
              } else {
                aFullTrans = aPron;
              }
            }

            const alignedAdlibJSX = alignChunksWithTransliteration(
              adlibChars,
              aParsedChunks,
              aFullTrans,
              renderColoredCharForTracker,
              basePronStyle,
              false, 
              true,  
              useSpacingText
            );

            let displayPronString = null;
            const isCJKLine = adlibChars.some(c => isCJ(c.char));

            if (aPron && !aPron.startsWith('{') && !aPron.startsWith('[')) {
              if (!isCJKLine && !aParsedChunks) {
                displayPronString = normalizeTrans(aPron);
              }
            }

            let adlibTranslation = adlibObj?.translation || '';
            if (adlibTranslation) adlibTranslation = adlibTranslation.replace(/[()\uff08\uff09]/g, '').trim();

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
                      whiteSpace: 'normal',
                      wordBreak: 'break-word'
                    }}
                    dir="ltr"
                  >
                    {renderFormattedTranslation(adlibTranslation)}
                  </span>
                )}
                <span className="primary-text" style={{ whiteSpace: 'pre-wrap', display: 'inline-block', maxWidth: '100%' }} dir="auto">
                  {alignedAdlibJSX}
                </span>
                {displayPronString && (
                  <span className="pronunciation-text" style={{...basePronStyle, whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '100%'}} dir="ltr">
                    {renderFormattedTranslation(displayPronString)}
                  </span>
                )}
              </div>
            );
          };

          const start = adlib.start;
          const end = adlib.end !== null ? adlib.end : start + 5;

          items.push({
            key,
            start,
            end,
            isMulti,
            cols,
            activeSingersList,
            activeNames: lineActiveNames,
            parentStart: node.start,
            rendered: renderAdlibPure(adlib)
          });
        });
      }
    });

    return items;
  }, [syncData, masterPalette]);

  useEffect(() => {
    if (containerRef.current) {
      cachedTrackNodesRef.current = Array.from(containerRef.current.querySelectorAll('.focused-adlib-line')).map((node, i) => {
        const dataItem = adlibsToRender[i];
        return {
          node,
          start: dataItem.start,
          end: dataItem.end,
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

        // ALL CALCULATION HAPPENS ON THE FLY, EXACTLY WHEN THE AD-LIB BECOMES ACTIVE
        if (shouldBeActive && !item.isActive) {
          let pos = null;
          
          const container = containerRef.current?.parentElement;
          if (container) {
            const containerRect = container.getBoundingClientRect();
            
            const targetStart = item.parentStart !== null ? item.parentStart : 'NaN';
            const lyricsNode = container.querySelector(`.focused-line[data-start="${targetStart}"]`);
            const singerNode = container.querySelector('.singer-name-corner.visible');
            
            const cBox = getRelativeRect(lyricsNode, containerRect);
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
              item.activeNames
            );
          }

          if (pos) {
            item.node.style.setProperty('--adlib-left', pos.left);
            item.node.style.setProperty('--adlib-top', pos.top);
            item.node.style.setProperty('--adlib-rot', `${pos.rot}deg`);
            item.node.style.setProperty('--adlib-max-width', `${pos.maxWidth}px`);
            item.node.style.setProperty('--adlib-scale', pos.scale);
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
      {adlibsToRender.map((item, index) => (
        <div
          key={`adlib-render-${index}`}
          className="focused-adlib-line"
          data-start={item.start}
          data-end={item.end}
          style={{
            '--adlib-rot': '0deg', 
            '--adlib-top': '50%',
            '--adlib-left': '50%'
          }}
          onClick={(e) => { e.stopPropagation(); handleLineClick(item.start); }}
        >
          {item.rendered}
        </div>
      ))}
    </div>
  );
});