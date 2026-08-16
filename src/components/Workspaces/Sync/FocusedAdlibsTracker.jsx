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
              whiteSpace: 'nowrap',
              WebkitTextFillColor: 'currentcolor',
              backgroundImage: 'none'
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

            const getSegmentStyle = (seg) => {
               // STRICT ADHERENCE: Only use the colors inherited directly from the segment tags
               let targetArtists = seg?.artists;
               let isGrad = false;
               let gradStyle = '';

               if (targetArtists && targetArtists.length > 1) {
                 isGrad = true;
                 const gradientColors = targetArtists.map(artist => masterPalette[artist] || '#ffffff').join(', ');
                 gradStyle = `linear-gradient(90deg, ${gradientColors})`;
               } else if (seg?.isGradient && seg?.gradient) {
                 isGrad = true;
                 gradStyle = seg.gradient;
               }

               if (isGrad) {
                 return {
                     backgroundImage: gradStyle,
                     WebkitBackgroundClip: 'text',
                     WebkitTextFillColor: 'transparent',
                     WebkitBoxDecorationBreak: 'clone',
                     display: 'inline',
                     filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 20px rgba(255,255,255,0.4))'
                 };
               }
               return {};
            };

            const renderColoredCharForTracker = (c, globalIdx) => {
              const isPunct = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(c.char);
              let style = {};

              if (isPunct && c.char.trim() !== '') {
                 style = {
                     color: '#fbbf24',
                     WebkitTextFillColor: '#fbbf24',
                     textShadow: '0 0 10px rgba(251, 191, 36, 0.6)',
                     backgroundImage: 'none',
                     filter: 'none'
                 };
              } else {
                 // STRICT ADHERENCE: Only use the colors inherited directly from the segment tags
                 let targetArtists = c.seg?.artists;
                 let isGrad = (targetArtists && targetArtists.length > 1) || c.seg?.isGradient;
                 
                 if (!isGrad) {
                     let activeColor = '#ffffff';
                     if (targetArtists && targetArtists.length === 1) {
                        activeColor = masterPalette[targetArtists[0]] || '#ffffff';
                     } else if (c.seg?.color) {
                        activeColor = c.seg.color;
                     }
                     style.color = activeColor;
                     style.WebkitTextFillColor = activeColor;
                     style.textShadow = `0 4px 8px rgba(0,0,0,0.9), 0 0 20px ${activeColor}80`;
                 }
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
              useSpacingText,
              getSegmentStyle
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
                      wordBreak: 'normal',
                      overflowWrap: 'normal'
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
                  <span className="pronunciation-text" style={{...basePronStyle, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'normal', maxWidth: '100%'}} dir="ltr">
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

        if (shouldBeActive && !item.isActive) {
          let pos = null;
          
          const container = containerRef.current?.parentElement;
          if (container) {
            const containerRect = container.getBoundingClientRect();
            
            const targetStart = item.parentStart !== null ? item.parentStart : 'NaN';
            const lyricsNode = container.querySelector(`.focused-line[data-start="${targetStart}"]`);
            
            const singerNode = document.querySelector('.singer-name-corner.visible') || document.querySelector('.singer-name-corner');
            
            const cBox = getRelativeRect(lyricsNode, containerRect);
            if (cBox && lyricsNode && !lyricsNode.classList.contains('active')) {
                cBox.top -= 20;
                cBox.bottom -= 20;
            }
            const sBox = getRelativeRect(singerNode, containerRect);
            
            pos = generateSafeAdlibPosition(
              item.node, 
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
          data-singer={item.activeSingersList.join(', ')}
          data-parent-singers={item.activeNames.join(', ')}
          style={{
            '--adlib-rot': '0deg', 
            '--adlib-top': '50%',
            '--adlib-left': '50%',
            width: 'max-content'
          }}
          onClick={(e) => { e.stopPropagation(); handleLineClick(item.start); }}
        >
          {item.rendered}
        </div>
      ))}
    </div>
  );
});