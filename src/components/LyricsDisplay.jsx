/* --- src/components/LyricsDisplay.jsx --- */
import React from 'react';

const LyricsDisplay = ({
  isEditing, customData, handleDataChange, hasValidSyncData,
  lyricsViewMode, liveParsedLyrics, activePreviewIndex,
  activePreviewRef, handleLineClick, selectedSong
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
                    {savedNode?.pronunciation && <rt className="pronunciation-text">{savedNode.pronunciation}</rt>}
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
                    {savedNode?.pronunciation && <rt className="pronunciation-text">{savedNode.pronunciation}</rt>}
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