/* --- src/components/FocusedAdlibsTracker.jsx --- */
import React, { useMemo, useRef, useEffect } from 'react';
import { normalizeTrans } from './LyricsLineRenderer';

export const FocusedAdlibsTracker = React.memo(({ syncData, handleLineClick, masterPalette, isPlayingCurrentSong }) => {
  const containerRef = useRef(null);
  const cachedTrackNodesRef = useRef([]);
  const adlibsToRender = useMemo(() => {
      const items = [];
      if (!syncData) return items;
      
      const currentTime = window.currentAudioTime || 0;
      syncData.forEach((node) => {
          if (node?.isSplit && node.adlibs) {
              const lineActiveNames = node.singer?.split(/\s*(?:&|,|\band\b)\s*/i)
                  .filter(Boolean)
                  .map(s => s.trim()) || [];
              
              const cols = Math.max(2, lineActiveNames.length);
              node.adlibs.forEach((adlib, j) => {
                  if (adlib.start === null) return;
                  
                  const randRot = Math.random();
                  const randX = Math.random();
                  const randY = Math.random();
                  const rot = (randRot * 20) - 10;
                  
                  const adlibNames = adlib.singer?.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) || [];
                  const primaryAdlibSinger = adlibNames[0];
                  
                  let col = 0;
                  const row = Math.random() > 0.5 ? 0 : 1;
                  if (lineActiveNames.length > 0 && primaryAdlibSinger) {
                      const idx = lineActiveNames.indexOf(primaryAdlibSinger);
                      if (idx !== -1) {
                          col = (idx - row + lineActiveNames.length) % lineActiveNames.length;
                      } else {
                          col = Math.floor(Math.random() * cols);
                      }
                  } else {
                      col = Math.floor(Math.random() * cols);
                  }
                  
                  const top = row === 0 ? 12 + (randY * 15) : 68 + (randY * 15);
                  const colCenter = (col + 0.5) * (100 / cols);
                  const left = colCenter + (randX * 20 - 10);

                  const renderAdlibPure = (adlibObj) => {
                      let aPron = adlibObj?.pronunciation;
                      let aTrans = '';
                      if (typeof aPron === 'string') {
                          if (aPron.startsWith('{')) {
                              try { aTrans = JSON.parse(aPron).full || ''; } catch(e){}
                          } else if (aPron.startsWith('[')) {
                              try { aTrans = JSON.parse(aPron).map(c=>c.trans||c.text).join(''); } catch(e){}
                          } else { aTrans = aPron; }
                      }
                      let adlibTranslation = adlibObj?.translation || '';
                      if (adlibTranslation) adlibTranslation = adlibTranslation.replace(/[()]/g, '').trim();
                      const basePronStyle = { fontSize: 'var(--dyn-translit-font-size, 0.55em)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', marginTop: 'var(--dyn-translit-bottom-padding, 4px)', display: 'inline-block' };
                      const segs = adlibObj.segments || [{ text: adlibObj.text }];
                      const renderedChars = [];
                      let charIdxCounter = 0;
                      segs.forEach((seg) => {
                          let defaultColor = seg.color || '#ffffff';
                          if (seg.artists && seg.artists.length > 0) {
                              defaultColor = masterPalette[seg.artists[0]] || defaultColor;
                          } else if (node.singer) {
                              const activeSingerName = node.singer.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean)[0]?.trim();
                              if (activeSingerName && masterPalette[activeSingerName]) {
                                  defaultColor = masterPalette[activeSingerName];
                              }
                          }
                          Array.from(seg.text).forEach((char) => {
                              const isPunct = /([.,!?;:"'()\[\]{}\- ]+)/.test(char);
                              const activeColor = isPunct ? '#fbbf24' : defaultColor;
                              renderedChars.push(
                                  <span key={charIdxCounter++} style={{ color: activeColor }}>
                                      {char}
                                  </span>
                              );
                          });
                      });
                      return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%', position: 'relative' }}>
                              {adlibTranslation && (
                                  <span className="chunk-translation focused-translation" dir="ltr">
                                      {adlibTranslation}
                                  </span>
                              )}
                              <span className="primary-text" style={{ whiteSpace: 'nowrap', display: 'inline-block' }} dir="auto">
                                  {renderedChars}
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
                     key: `adlib-${start}-${j}`,
                     start,
                     end,
                     rot, top, left, rendered, adlib,
                     initialClass: isActive ? 'active' : ''
                  });
              });
          }
      });
      return items;
  }, [syncData, masterPalette, isPlayingCurrentSong]);

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

  useEffect(() => {
      if (!isPlayingCurrentSong) {
          if (cachedTrackNodesRef.current.length > 0) {
              cachedTrackNodesRef.current.forEach(item => {
                  if (item.isActive) {
                      item.node.classList.remove('active');
                      item.isActive = false;
                  }
              });
          }
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
      
      window.addEventListener('globalTimeUpdate', handleTime);
      return () => window.removeEventListener('globalTimeUpdate', handleTime);
  }, [isPlayingCurrentSong]);

  if (adlibsToRender.length === 0) return null;
  return (
      <div className="focused-adlibs-container" ref={containerRef}>
          {adlibsToRender.map(item => (
              <div 
                  key={item.key} 
                  className={`focused-adlib-line ${item.initialClass}`}
                  data-start={item.start}
                  data-end={item.end}
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