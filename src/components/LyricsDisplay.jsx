/* --- src/components/LyricsDisplay.jsx --- */
import React, { useEffect, useRef } from 'react';
import { LyricLineWrapper } from './LyricsLineRenderer';
import { FocusedAdlibsTracker } from './FocusedAdlibsTracker';

const LyricsDisplay = ({
  isEditing, customData, handleDataChange, hasValidSyncData,
  lyricsViewMode, liveParsedLyrics, handleLineClick, selectedSong, masterPalette, currentTrack,
  isPlaying, settings
}) => {
  const containerRef = useRef(null);
  const cachedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);
  const eqBarsRef = useRef([]);

  const isPlayingCurrentSong = Boolean(currentTrack && selectedSong && currentTrack.trackId === selectedSong.trackId);

  // OPTIMIZED EQUALIZER: Throttled to ~30 FPS to prevent phone overheating
  useEffect(() => {
    let rafId;
    let lastEqDraw = 0;
    const fadeOutTime = settings?.eqFadeOutTime ?? 500;
    
    const renderEQ = (timestamp) => {
      if (isPlaying && isPlayingCurrentSong && window.globalAudioAnalyser && window.globalFreqData) {
        if (timestamp - lastEqDraw > 33) {
          window.globalAudioAnalyser.getByteFrequencyData(window.globalFreqData);
          const bars = eqBarsRef.current;
          for (let i = 0; i < bars.length; i++) {
            if (bars[i]) {
              const raw = window.globalFreqData[i];
              const scale = 0.05 + (raw / 255) * 0.95;
              
              bars[i].style.transition = 'transform 0.05s ease-out';
              bars[i].style.transform = `scaleY(${scale})`;
            }
          }
          lastEqDraw = timestamp;
        }
      } else {
        const bars = eqBarsRef.current;
        for (let i = 0; i < bars.length; i++) {
          if (bars[i] && bars[i].style.transform !== 'scaleY(0.05)') {
            bars[i].style.transition = `transform ${fadeOutTime}ms ease-out`;
            bars[i].style.transform = `scaleY(0.05)`;
          }
        }
      }
      rafId = requestAnimationFrame(renderEQ);
    };
    rafId = requestAnimationFrame(renderEQ);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isPlayingCurrentSong, settings?.eqFadeOutTime]);

  useEffect(() => {
    if (containerRef.current) {
        cachedLinesRef.current = Array.from(containerRef.current.querySelectorAll('.lyric-line-wrapper')).map(node => ({
            node,
            start: parseFloat(node.dataset.start),
            end: parseFloat(node.dataset.end),
            nextStart: parseFloat(node.dataset.nextStart),
            isActive: node.classList.contains('active')
        }));
        cachedAdlibsRef.current = Array.from(containerRef.current.querySelectorAll('.adlib-node')).map(node => ({
            node,
            start: parseFloat(node.dataset.start),
            end: parseFloat(node.dataset.end),
            state: node.classList.contains('adlib-active') ? 'active' : (node.classList.contains('adlib-visible') ? 'visible' : 'hidden')
        }));
    }
  }, [liveParsedLyrics, lyricsViewMode, selectedSong?.syncData]);

  useEffect(() => {
    if (lyricsViewMode !== 'live' && lyricsViewMode !== 'focused') return;

    const handleTime = (e) => {
        if (!isPlayingCurrentSong) return;
        const time = e.detail;
        const lines = cachedLinesRef.current;

        let newActiveIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const { start, end, nextStart } = lines[i];
            if (!isNaN(start) && time >= start) {
                const isBeforeEnd = isNaN(end) || time <= end;
                const isBeforeNext = isNaN(nextStart) || time < nextStart;
                if (isBeforeEnd && isBeforeNext) {
                    newActiveIndex = i;
                    break; 
                }
            }
        }

        for (let i = 0; i < lines.length; i++) {
            const item = lines[i];
            const shouldBeActive = (i === newActiveIndex);
            
            if (shouldBeActive && !item.isActive) {
                item.node.classList.add('active');
                item.isActive = true;
                
                if (lyricsViewMode === 'live' && containerRef.current) {
                    const offsetTop = item.node.offsetTop;
                    const scrollPos = offsetTop - (containerRef.current.clientHeight / 2) + (item.node.clientHeight / 2);
                    containerRef.current.scrollTo({ top: scrollPos, behavior: 'smooth' });
                }
            } else if (!shouldBeActive && item.isActive) {
                item.node.classList.remove('active');
                item.isActive = false;
            }
        }

        const adlibs = cachedAdlibsRef.current;
        for (let i = 0; i < adlibs.length; i++) {
            const item = adlibs[i];
            if (isNaN(item.start)) continue;

            let targetState = 'hidden';
            if (time >= item.start && time <= item.end) targetState = 'active';
            else if (time >= item.start) targetState = 'visible';

            if (item.state !== targetState) {
                const cl = item.node.classList;
                if (targetState === 'active') {
                    cl.add('adlib-active');
                    cl.remove('adlib-hidden', 'adlib-visible');
                } else if (targetState === 'visible') {
                    cl.add('adlib-visible');
                    cl.remove('adlib-hidden', 'adlib-active');
                } else {
                    cl.add('adlib-hidden');
                    cl.remove('adlib-active', 'adlib-visible');
                }
                item.state = targetState;
            }
        }
    };

    window.addEventListener('globalTimeUpdate', handleTime);
    
    if (isPlayingCurrentSong) {
        const initialTime = currentTrack ? (window.currentAudioTime || 0) : 0;
        handleTime({ detail: initialTime });
    } else {
        cachedLinesRef.current.forEach(item => {
            if (item.isActive) {
                item.node.classList.remove('active');
                item.isActive = false;
            }
        });
        cachedAdlibsRef.current.forEach(item => {
            if (item.state !== 'hidden') {
                item.node.classList.add('adlib-hidden');
                item.node.classList.remove('adlib-active', 'adlib-visible');
                item.state = 'hidden';
            }
        });
    }

    return () => window.removeEventListener('globalTimeUpdate', handleTime);
  }, [lyricsViewMode, isPlayingCurrentSong, currentTrack]);

  const handlePaste = (e) => {
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html.replace(/<o:p>&nbsp;<\/o:p>/g, '');
      
      const processNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\u00A0/g, ' ');
        if (node.nodeType === Node.ELEMENT_NODE) {
          let innerText = '';
          for (let child of node.childNodes) innerText += processNode(child);

          const tag = node.tagName.toLowerCase();
          const style = node.style || {};
          const fw = style.fontWeight || '';
          
          const isBold = tag === 'b' || tag === 'strong' || fw === 'bold' || fw === '700' || parseInt(fw) >= 600;
          const isItalic = tag === 'i' || tag === 'em' || style.fontStyle === 'italic';
          
          if (innerText.trim()) {
            const leadSpace = innerText.match(/^\s*/)[0];
            const trailSpace = innerText.match(/\s*$/)[0];
            let wrapped = innerText.trim();

            if (isItalic) wrapped = `_${wrapped}_`;
            if (isBold) wrapped = `**${wrapped}**`;

            innerText = `${leadSpace}${wrapped}${trailSpace}`;
          }

          if (['p', 'div', 'br', 'li', 'h1', 'h2', 'h3'].includes(tag) && !innerText.endsWith('\n')) innerText += '\n';
          return innerText;
        }
        return '';
      };
      
      let markdownText = processNode(tempDiv).replace(/\n{3,}/g, '\n\n').trim();

      const textarea = e.target;
      const newVal = (customData.lyrics || '').substring(0, textarea.selectionStart) + markdownText + (customData.lyrics || '').substring(textarea.selectionEnd);
      handleDataChange({ target: { name: 'lyrics', value: newVal } });
    }
  };

  return (
    <>
      {isEditing ? (
        <textarea 
          name="lyrics" 
          value={customData.lyrics}
          onChange={handleDataChange} 
          onPaste={handlePaste}
          className="lyrics-textarea"
          placeholder="Paste your lyrics here! Copying directly from Word or Google Docs will automatically convert Bold & Italics into Artist Tags!" 
        />
      ) : hasValidSyncData && lyricsViewMode === 'live' ? (
        <div 
          className="live-lyrics-preview" 
          ref={containerRef}
          style={{
            '--dyn-live-sync-gap': `${settings?.liveSyncLineGap ?? 16}px`
          }}
        >
          {liveParsedLyrics.map((line, i) => {
            let nextStart = 'NaN';
            const syncList = selectedSong?.syncData || [];
            for (let j = i + 1; j < syncList.length; j++) {
                if (syncList[j]?.start != null) {
                    nextStart = syncList[j].start;
                    break;
                }
            }
            return (
                <LyricLineWrapper
                  key={i}
                  lineObj={line}
                  savedNode={syncList[i]}
                  nextStart={nextStart}
                  viewMode="live"
                  handleLineClick={handleLineClick}
                  masterPalette={masterPalette}
                  isPlayingCurrentSong={isPlayingCurrentSong}
                />
            )
          })}
        </div>
      ) : hasValidSyncData && lyricsViewMode === 'focused' ? (
        <div className="focused-lyrics-preview" ref={containerRef}>
          {liveParsedLyrics.map((line, i) => {
             let nextStart = 'NaN';
             const syncList = selectedSong?.syncData || [];
             for (let j = i + 1; j < syncList.length; j++) {
                 if (syncList[j]?.start != null) {
                     nextStart = syncList[j].start;
                     break;
                 }
             }
             return (
                 <LyricLineWrapper
                     key={i}
                     lineObj={line}
                     savedNode={syncList[i]}
                     nextStart={nextStart}
                    viewMode="focused"
                    handleLineClick={handleLineClick}
                    masterPalette={masterPalette}
                    isPlayingCurrentSong={isPlayingCurrentSong}
                 />
             )
          })}
          
          <FocusedAdlibsTracker 
             syncData={selectedSong?.syncData}
             handleLineClick={handleLineClick}
             masterPalette={masterPalette}
             isPlayingCurrentSong={isPlayingCurrentSong}
          />
        </div>
      ) : (
        <div className="lyrics-display">
          {liveParsedLyrics.length > 0 ? (
            liveParsedLyrics.map((line, i) => (
              <div key={i} style={{ textAlign: 'left' }} dir="auto">
                {line.segments ? line.segments.map((seg, idx) => {
                    let inlineColor = seg.color;
                    let inlineIsGradient = seg.isGradient;
                    let inlineGradient = seg.gradient;
                    
                    if (seg.artists && seg.artists.length > 0) {
                      if (seg.artists.length > 1) {
                          inlineIsGradient = true;
                          const c1 = masterPalette[seg.artists[0]] || '#ffffff';
                          const c2 = masterPalette[seg.artists[1]] || '#ffffff';
                          inlineGradient = `linear-gradient(90deg, ${c1}, ${c2})`;
                      } else {
                          inlineColor = masterPalette[seg.artists[0]] || '#ffffff';
                      }
                    }

                    return (
                      <span key={idx} style={inlineIsGradient ? { backgroundImage: inlineGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' } : { color: inlineColor }}>
                          {seg.text}
                      </span>
                    );
                }) : line.text}
              </div>
            ))
          ) : (
            <div className="no-lyrics-empty-state">
              <p>No lyrics found in your Vault.</p>
            </div>
          )}
        </div>
      )}

      {!isEditing && (
        <div className={`lyrics-equalizer`}>
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="eq-bar"
              ref={(el) => eqBarsRef.current[i] = el}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default LyricsDisplay;