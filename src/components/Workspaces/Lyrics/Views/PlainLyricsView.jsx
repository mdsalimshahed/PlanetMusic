/* --- src/components/Workspaces/Lyrics/Views/PlainLyricsView.jsx --- */
import React, { useMemo } from 'react';
import { getGraphemes } from '../../../LyricsRenderer/textUtils';

const PlainLyricsView = ({ liveParsedLyrics, selectedSong, masterPalette }) => {

  const groupedPlainLyrics = useMemo(() => {
    const groups = [];
    let currentGroup = null;

    liveParsedLyrics.forEach((line, i) => {
      const effectiveSinger = line.singer || 'Uncredited';
      if (!currentGroup || line.sectionHeader || effectiveSinger !== currentGroup.singer) {
        if (currentGroup) groups.push(currentGroup);
        
        let borderColor = line.color || '#ffffff';
        if (line.isGradient) {
          const firstArtist = effectiveSinger.split(/\s*(?:&|,|\band\b|\+)\s*/i).filter(Boolean)[0]?.trim();
          borderColor = masterPalette[firstArtist] || '#ffffff';
        } else if (!line.singer) {
          borderColor = '#ffffff';
        }

        currentGroup = {
          id: `group-${i}`,
          sectionHeader: line.sectionHeader,
          singer: effectiveSinger,
          color: line.color,
          borderColor: borderColor,
          gradient: line.gradient,
          isGradient: line.isGradient,
          lines: []
        };
      }
      currentGroup.lines.push(line);
    });
    
    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [liveParsedLyrics, selectedSong?.artistName, masterPalette]);

  const renderPlainColoredText = (item) => {
    let artists = item.artists || [];
    if (artists.length === 0 && item.singer) {
      artists = item.singer.split(/\s*(?:&|,|\band\b|\+)\s*/i).filter(Boolean).map(a => a.trim());
    }
    let isGradient = false;
    let gradientStyle = '';
    let activeColor = '#ffffff';

    if (artists.length > 1) {
      isGradient = true;
      const c1 = masterPalette[artists[0]] || '#ffffff';
      const c2 = masterPalette[artists[1]] || '#ffffff';
      gradientStyle = `linear-gradient(90deg, ${c1}, ${c2})`;
    } else if (artists.length === 1) {
      activeColor = masterPalette[artists[0]] || item.color || '#ffffff';
    } else if (item.isGradient && item.gradient) {
      isGradient = true;
      gradientStyle = item.gradient;
    } else {
      activeColor = item.color || '#ffffff';
    }

    const chars = getGraphemes(item.text || '');
    return chars.map((char, cIdx) => {
      const isPunct = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(char);
      let style = {};
      if (isPunct && char.trim() !== '') {
        style = { color: '#fbbf24', WebkitTextFillColor: '#fbbf24', textShadow: '0 0 10px rgba(251, 191, 36, 0.6)' };
      } else if (isGradient) {
        style = { backgroundImage: gradientStyle, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
      } else {
        style = { color: activeColor };
      }
      return <span key={cIdx} style={style}>{char}</span>;
    });
  };

  const renderColoredSingerHeader = (singerString) => {
    if (!singerString) {
      const defaultSinger = selectedSong?.artistName || 'Default Artist';
      return <span style={{ color: masterPalette[defaultSinger] || '#ffffff' }}>{defaultSinger}</span>;
    }
    const artists = singerString.split(/\s*(?:&|,|\band\b|\+)\s*/i).filter(Boolean).map(a => a.trim());
    return artists.map((artist, aIdx) => {
      const artistColor = masterPalette[artist] || '#ffffff';
      return (
        <React.Fragment key={aIdx}>
          <span style={{ color: artistColor }}>{artist}</span>
          {aIdx < artists.length - 1 && <span style={{ color: 'rgba(255, 255, 255, 0.4)', margin: '0 4px' }}>, </span>}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="lyrics-display">
      {groupedPlainLyrics.length > 0 ? (
        groupedPlainLyrics.map((group, gIdx) => {
          let displayHeader = '';
          if (group.sectionHeader) {
            displayHeader = group.sectionHeader.replace(/[\[\]]/g, '');
            if (displayHeader.includes(':')) {
              displayHeader = displayHeader.split(':')[0].trim();
            }
          }
          return (
          <React.Fragment key={group.id}>
            {group.sectionHeader && (
              <div className="plain-section-header" style={{ marginTop: gIdx === 0 ? '0' : '32px' }}>
                {displayHeader}
              </div>
            )}
            
            <div 
              className="plain-artist-block"
              style={{ borderLeftColor: group.borderColor }}
            >
              <div className="plain-artist-name">
                {renderColoredSingerHeader(group.singer)}
              </div>
              <div className="plain-block-lines">
                {group.lines.map((line, lIdx) => (
                  <div key={lIdx} className="plain-lyric-line" dir="auto">
                    <div style={{ textAlign: 'left' }}>
                      {line.segments ? line.segments.map((seg, sIdx) => (
                        <React.Fragment key={sIdx}>
                          {renderPlainColoredText(seg)}
                        </React.Fragment>
                      )) : (
                        renderPlainColoredText(line)
                      )}
                    </div>
                    {line.translation && (
                      <span className="plain-lyric-translation" dir="ltr">{line.translation}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </React.Fragment>
        )})
      ) : (
        <div className="no-lyrics-empty-state">
          <p>No lyrics found in your Vault.</p>
        </div>
      )}
    </div>
  );
};

export default PlainLyricsView;