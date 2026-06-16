/* --- src/components/SyncWorkspace.jsx --- */
import React from 'react';
import { formatPreciseTime } from '../utils/songHelpers';

const SyncWorkspace = ({
  syncData, activeSyncIndex, setActiveSyncIndex, syncProgress, syncDuration, setSyncDuration,
  isSyncPlaying, toggleSyncPlay, handleSyncSeek, playbackRate, handleSpeedChange,
  syncAudioRef, syncAudioSrc, handleSyncTimeUpdate, setIsSyncPlaying, activeLineRef
}) => {
  
  const handleAudioLoaded = (e) => {
    if (e.target.readyState > 0) {
      setSyncDuration(e.target.duration || 0);
    }
  };

  const englishRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~‘’“”\–\—]+$/;

  const renderWorkspaceLine = (line) => {
    const pronString = line.pronunciation;
    const pronWords = pronString && typeof pronString === 'string' ? pronString.trim().split(/\s+/).filter(Boolean) : [];
    const segments = line.segments || [];

    const pronStyle = { 
        fontSize: '0.55em', 
        color: '#ffffff', 
        opacity: 1, 
        textShadow: 'none', 
        fontWeight: '800', 
        textTransform: 'uppercase', 
        letterSpacing: '0.5px',
        textAlign: 'center',
        marginTop: '4px'
    };

    const chars = [];
    segments.forEach(seg => {
        for (let char of seg.text) {
            chars.push({ char, seg });
        }
    });

    const tokens = [];
    let currentToken = [];
    let isSpace = false;
    
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        const charIsSpace = /\s/.test(c.char);
        if (i === 0) isSpace = charIsSpace;
        
        if (charIsSpace === isSpace) {
            currentToken.push(c);
        } else {
            tokens.push({ type: isSpace ? 'space' : 'word', data: currentToken, text: currentToken.map(x=>x.char).join('') });
            currentToken = [c];
            isSpace = charIsSpace;
        }
    }
    if (currentToken.length > 0) tokens.push({ type: isSpace ? 'space' : 'word', data: currentToken, text: currentToken.map(x=>x.char).join('') });

    const actualWordsCount = tokens.filter(t => t.type === 'word').length;
    const canAlignWords = pronWords.length > 0 && pronWords.length === actualWordsCount;

    if (canAlignWords) {
        let pronIdx = 0;
        const renderedTokens = tokens.map((token, tIdx) => {
            const renderedChars = token.data.map((c, cIdx) => {
                const isPunct = /([.,!?;:"'()\[\]{}\-—–~¿¡«»“”‘’]+)/.test(c.char);
                const activeColor = isPunct ? '#fbbf24' : (c.seg.color || '#ffffff');
                const isGradient = !isPunct && c.seg.isGradient;

                const style = isGradient ? { backgroundImage: c.seg.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: activeColor };
                return <span key={cIdx} style={style}>{c.char}</span>;
            });

            if (token.type === 'space') {
                return <span key={tIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>{renderedChars}</span>;
            } else {
                const isEnglishWord = englishRegex.test(token.text);
                
                let p = null;
                // Always increment the index so the pointer stays aligned
                if (pronIdx < pronWords.length) {
                    p = pronWords[pronIdx];
                    pronIdx++;
                }

                // Erase the pronunciation for English words
                if (isEnglishWord) {
                    p = null;
                }

                if (p) {
                    return (
                        <span key={tIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'top' }}>
                            <span style={{ display: 'inline-block' }}>{renderedChars}</span>
                            <span style={pronStyle}>{p}</span>
                        </span>
                    );
                } else {
                    return <span key={tIdx} style={{ verticalAlign: 'top' }}>{renderedChars}</span>;
                }
            }
        });

        return (
            <div style={{ textAlign: 'left', width: '100%' }}>
                <span className="sync-text" style={{ whiteSpace: 'pre-wrap', display: 'inline-block' }}>{renderedTokens}</span>
            </div>
        );
    } else {
        const renderedChars = chars.map((c, cIdx) => {
            const isPunct = /([.,!?;:"'()\[\]{}\-—–~¿¡«»“”‘’]+)/.test(c.char);
            const activeColor = isPunct ? '#fbbf24' : (c.seg.color || '#ffffff');
            const isGradient = !isPunct && c.seg.isGradient;

            const style = isGradient ? { backgroundImage: c.seg.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: activeColor };
            return <span key={cIdx} style={style}>{c.char}</span>;
        });

        const blockPronStyle = { ...pronStyle, marginTop: '8px', display: 'block', textAlign: 'left', wordSpacing: '4px', lineHeight: '1.4' };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
                <span className="sync-text" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{renderedChars}</span>
                {pronString && <div style={blockPronStyle}>{pronString}</div>}
            </div>
        );
    }
  };

  return (
    <div className="sync-mode-container">
      <div className="sync-player glass-panel">
        <button className="sync-play-btn" onClick={toggleSyncPlay}>{isSyncPlaying ? '⏸' : '▶'}</button>
        <span className="precise-time">{formatPreciseTime(syncProgress)}</span>
        <input 
          type="range" className="custom-slider sync-slider" 
          min="0" max={syncDuration || 1} step="0.001" 
          value={syncProgress} onChange={handleSyncSeek} 
        />
        <span className="precise-time">{formatPreciseTime(syncDuration)}</span>
      </div>

      <div className="sync-speed-deck glass-panel">
        <div className="speed-label-container">
          <span>Speed: <strong>{playbackRate.toFixed(2)}x</strong></span>
          {playbackRate !== 1.0 && (
            <button className="speed-reset-btn" onClick={() => handleSpeedChange({ target: { value: 1.0 }})}>Reset</button>
          )}
        </div>
        <input 
          type="range" className="custom-slider speed-slider" 
          min="0.5" max="2.0" step="0.05" 
          value={playbackRate} onChange={handleSpeedChange} 
        />
        <div className="speed-ticks">
          <span>0.5x</span><span>1.0x</span><span>1.5x</span><span>2.0x</span>
        </div>
      </div>

      <div className="sync-lines-container">
        {syncData.map((line, i) => {
          const isRecording = line.start !== null && line.end === null;
          const isSynced = line.start !== null && line.end !== null;
          const isActive = i === activeSyncIndex;
          
          return (
            <div 
              key={i}
              ref={isActive ? activeLineRef : null}
              className={`sync-line ${isActive ? 'active' : ''} ${isRecording ? 'recording' : ''} ${isSynced ? 'synced' : ''}`}
              onClick={() => {
                setActiveSyncIndex(i);
                if (line.start !== null && syncAudioRef.current) syncAudioRef.current.currentTime = line.start;
              }}
            >
              <div className="sync-text-wrapper" style={{ flex: 1, minWidth: 0, paddingRight: '16px' }}>
                {renderWorkspaceLine(line)}
              </div>
              <span className="sync-time">{formatPreciseTime(line.start)} - {formatPreciseTime(line.end)}</span>
            </div>
          );
        })}
      </div>

      <audio 
        ref={syncAudioRef} 
        src={syncAudioSrc}
        onTimeUpdate={handleSyncTimeUpdate}
        onLoadedMetadata={handleAudioLoaded}
        onDurationChange={handleAudioLoaded}
        onEnded={() => setIsSyncPlaying(false)}
        onPlay={() => setIsSyncPlaying(true)}
        onPause={() => setIsSyncPlaying(false)}
      />
    </div>
  );
};

export default SyncWorkspace;