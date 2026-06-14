/* --- src/components/LyricsDisplay.jsx --- */
import React from 'react';

const LyricsDisplay = ({
  isEditing, customData, handleDataChange, hasValidSyncData,
  lyricsViewMode, liveParsedLyrics, activePreviewIndex,
  activePreviewRef, handleLineClick, selectedSong, globalProgress,
  debugInfo // <-- Passed down
}) => {
  return (
    <>
      {isEditing ? (
        <textarea 
          name="lyrics" 
          value={customData.lyrics}
          onChange={handleDataChange} 
          className="lyrics-textarea"
          placeholder="Paste your raw lyrics here! Full support for Genius headings and nested formatting tags included." 
        />
      ) : hasValidSyncData && lyricsViewMode === 'debug' ? (
        <div className="debug-lyrics-preview">
          <h3 style={{ color: 'white', marginBottom: '8px' }}>
            SOURCE: <span style={{ color: '#fbbf24' }}>{debugInfo.source}</span>
          </h3>
          
          <h4 style={{ color: '#b388eb', marginTop: '16px', marginBottom: '8px' }}>RAW API DATA:</h4>
          <pre className="debug-json" style={{ color: '#9ca3af' }}>
            {JSON.stringify(debugInfo.rawData, null, 2)}
          </pre>
          
          <h4 style={{ color: '#b388eb', marginTop: '24px', marginBottom: '8px' }}>PARSED SYNCDATA OUTPUT:</h4>
          <pre className="debug-json" style={{ color: '#4ade80' }}>
            {JSON.stringify(selectedSong.syncData, null, 2)}
          </pre>
        </div>
      ) : hasValidSyncData && lyricsViewMode === 'karaoke' ? (
        <div className="live-lyrics-preview">
          {liveParsedLyrics.map((line, i) => {
            const isActive = i === activePreviewIndex;
            const savedNode = selectedSong.syncData[i];
            const seekTarget = savedNode ? savedNode.start : null;
            const hasWordSync = savedNode?.wordSync && savedNode.wordSync.length > 0;
            
            const renderKaraokeText = () => {
              if (hasWordSync) {
                return savedNode.wordSync.map((word, idx) => {
                  const isWordActive = globalProgress >= word.start;
                  return (
                    <span key={idx} style={{ 
                      color: isWordActive ? line.color : 'rgba(255, 255, 255, 0.2)',
                      textShadow: isWordActive ? `0 0 20px ${line.color}` : 'none',
                      transition: 'color 0.1s ease, text-shadow 0.1s ease',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {word.text}
                    </span>
                  );
                });
              }
              // Fallback if line doesn't have words
              return <span style={{ color: isActive ? line.color : 'rgba(255, 255, 255, 0.2)', whiteSpace: 'pre-wrap' }}>{line.text}</span>;
            };

            return (
              <div 
                key={i} 
                ref={isActive ? activePreviewRef : null}
                className={`preview-line ${isActive ? 'active' : ''}`}
                onClick={() => handleLineClick(seekTarget)}
                style={{ cursor: seekTarget !== null ? 'pointer' : 'default' }}
              >
                <span className="primary-text" style={isActive && !hasWordSync && line.isGradient ? { backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.3))' } : {}}>
                  {renderKaraokeText()}
                </span>
                {savedNode?.pronunciation && !Array.isArray(savedNode.pronunciation) && <rt className="pronunciation-text">{savedNode.pronunciation}</rt>}
              </div>
            );
          })}
        </div>
      ) : hasValidSyncData && lyricsViewMode === 'live' ? (
        <div className="live-lyrics-preview">
          {liveParsedLyrics.map((line, i) => {
            const isActive = i === activePreviewIndex;
            const savedNode = selectedSong.syncData[i];
            const seekTarget = savedNode ? savedNode.start : null;

            return (
              <div 
                key={i} 
                ref={isActive ? activePreviewRef : null}
                className={`preview-line ${isActive ? 'active' : ''}`}
                onClick={() => handleLineClick(seekTarget)}
                style={{ cursor: seekTarget !== null ? 'pointer' : 'default' }}
              >
                {Array.isArray(savedNode?.pronunciation) ? (
                  <span className="sync-text-chunks">
                    {savedNode.pronunciation.map((chunk, idx) => (
                      <ruby key={idx} className="lyric-chunk">
                        <span className="primary-text" style={isActive ? (line.isGradient ? { backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.3))' } : { color: line.color, textShadow: `0 0 20px ${line.color}80` }) : {}}>
                          {chunk.text}
                        </span>
                        {chunk.pron && <rt className="pronunciation-text">{chunk.pron}</rt>}
                      </ruby>
                    ))}
                  </span>
                ) : (
                  <ruby className="lyric-chunk">
                    <span className="primary-text" style={isActive ? (line.isGradient ? { backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.3))' } : { color: line.color, textShadow: `0 0 20px ${line.color}80` }) : {}}>
                      {line.text}
                    </span>
                    {savedNode?.pronunciation && !Array.isArray(savedNode.pronunciation) && <rt className="pronunciation-text">{savedNode.pronunciation}</rt>}
                  </ruby>
                )}
              </div>
            );
          })}
        </div>
      ) : hasValidSyncData && lyricsViewMode === 'focused' ? (
        <div className="focused-lyrics-preview">
          {liveParsedLyrics.map((line, i) => {
            const isActive = i === activePreviewIndex;
            const savedNode = selectedSong.syncData[i];
            const seekTarget = savedNode ? savedNode.start : null;

            return (
              <div 
                key={i} 
                ref={isActive ? activePreviewRef : null}
                className={`focused-line ${isActive ? 'active' : ''}`}
                onClick={() => handleLineClick(seekTarget)}
              >
                {Array.isArray(savedNode?.pronunciation) ? (
                  <span className="sync-text-chunks">
                    {savedNode.pronunciation.map((chunk, idx) => (
                      <ruby key={idx} className="lyric-chunk">
                        <span className="primary-text" style={isActive ? (line.isGradient ? { backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.4))' } : { color: line.color, textShadow: `0 0 30px ${line.color}80` }) : {}}>
                          {chunk.text}
                        </span>
                        {chunk.pron && <rt className="pronunciation-text">{chunk.pron}</rt>}
                      </ruby>
                    ))}
                  </span>
                ) : (
                  <ruby className="lyric-chunk">
                    <span className="primary-text" style={isActive ? (line.isGradient ? { backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.4))' } : { color: line.color, textShadow: `0 0 30px ${line.color}80` }) : {}}>
                      {line.text}
                    </span>
                    {savedNode?.pronunciation && !Array.isArray(savedNode.pronunciation) && <rt className="pronunciation-text">{savedNode.pronunciation}</rt>}
                  </ruby>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="lyrics-display">
          {liveParsedLyrics.length > 0 ? (
            liveParsedLyrics.map((line, i) => (
              <div key={i} style={line.isGradient ? { backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: line.singer !== selectedSong.artistName ? line.color : '#fff' }}>
                {line.text}
              </div>
            ))
          ) : (
            <div className="no-lyrics-empty-state">
              <p>No lyrics found in your Vault.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default LyricsDisplay;