/* --- src/components/Workspaces/Sync/FocusedAdlibsTracker.jsx --- */
import React, { useMemo, useRef, useEffect } from 'react';
import { generateSafeAdlibPosition, getRelativeRect } from "../../AdlibDebug/adlibPlacementLogic";
import EngineRouter from '../../LyricsRenderer/LanguageEngines/EngineRouter';
import { extractCharsAndSegments } from '../../LyricsRenderer/LanguageEngines/EngineUtils';

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
            const { chars, hasSpacingText } = extractCharsAndSegments(
                { text: adlibObj.text, segments: adlibObj.segments }, 
                adlibObj
            );

            const { mainJSX, translationJSX, pronunciationJSX } = EngineRouter({
                chars,
                lang: adlibObj.lang || 'auto',
                translation: adlibObj.translation,
                pronunciation: adlibObj.pronunciation,
                hasSpacingText,
                isFocused: true, // Adlibs in tracker use focused visuals
                masterPalette,
                originalText: adlibObj.text,
                isOnlyPunct: chars.length > 0 && chars.every(c => /^[\p{P}\p{S}\s]+$/u.test(c.char))
            });

            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%', position: 'relative' }}>
                {translationJSX && (
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
                    {translationJSX}
                  </span>
                )}

                <span className="primary-text" style={{ whiteSpace: 'pre-wrap', display: 'inline-block', maxWidth: '100%' }} dir="auto">
                  {mainJSX}
                </span>

                {pronunciationJSX && (
                  <span className="pronunciation-text" style={{
                      fontSize: 'var(--dyn-translit-font-size, 0.55em)',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      textAlign: 'center',
                      marginTop: 'var(--dyn-translit-bottom-padding, 4px)',
                      display: 'inline-block',
                      whiteSpace: 'normal',
                      wordBreak: 'normal',
                      overflowWrap: 'normal',
                      maxWidth: '100%',
                      WebkitTextFillColor: 'currentcolor',
                      backgroundImage: 'none'
                  }} dir="ltr">
                    {pronunciationJSX}
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