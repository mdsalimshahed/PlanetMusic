/* --- src/components/Workspaces/Lyrics/Views/EditLyricsView.jsx --- */
import React, { useMemo } from 'react';
import { parseLyrics } from '../../../../utils/songHelpers.js';
import { getGraphemes } from '../../../../../components/LyricsRenderer/textUtils.js';
import './EditLyricsView.css';

const EditLyricsView = ({ customData, handleDataChange, selectedSong, masterPalette }) => {
  const editParsedLyrics = useMemo(() => {
    if (!customData.lyrics) return [];
    return parseLyrics(customData.lyrics, selectedSong?.artistName, masterPalette);
  }, [customData.lyrics, selectedSong?.artistName, masterPalette]);

  const getBorderAccentColor = (line) => {
    let artists = line.artists || [];
    if (artists.length === 0 && line.singer) {
      artists = line.singer.split(/\s*(?:&|,|\band\b|\+)\s*/i).filter(Boolean).map(a => a.trim());
    }
    if (artists.length > 0) {
      return masterPalette[artists[0]] || '#ffffff';
    }
    return line.color || '#ffffff';
  };

  const editGroupedLyrics = useMemo(() => {
    if (!customData.lyrics) return [];

    const groups = [];
    let currentGroup = null;

    editParsedLyrics.forEach((line, i) => {
      const effectiveSinger = line.singer || 'Uncredited';

      if (!currentGroup || line.sectionHeader || effectiveSinger !== currentGroup.singer) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          id: `edit-group-${i}`,
          sectionHeader: line.sectionHeader,
          singer: effectiveSinger,
          borderColor: getBorderAccentColor(line),
          lines: []
        };
      }
      currentGroup.lines.push(line);
    });

    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [editParsedLyrics, selectedSong?.artistName, masterPalette, customData.lyrics]);

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
      const gradientColors = artists.map(artist => masterPalette[artist] || '#ffffff').join(', ');
      gradientStyle = `linear-gradient(90deg, ${gradientColors})`;
    } else if (artists.length === 1) {
      activeColor = masterPalette[artists[0]] || item.color || '#ffffff';
    } else if (item.isGradient && item.gradient) {
      isGradient = true;
      gradientStyle = item.gradient;
    } else {
      activeColor = item.color || '#ffffff';
    }

    // Apply the gradient or solid color to the SEGMENT parent wrapper
    let parentStyle = {};
    if (isGradient) {
      parentStyle = {
         backgroundImage: gradientStyle,
         WebkitBackgroundClip: 'text',
         WebkitTextFillColor: 'transparent',
        display: 'inline' // Preserves natural text wrapping
      };
    } else {
      parentStyle = { color: activeColor };
    }

    const chars = getGraphemes(item.text || '');
    const renderedChars = chars.map((char, cIdx) => {
      const isPunct = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(char);
      let childStyle = {};

      if (isPunct && char.trim() !== '') {
        // Punches through the parent gradient with a solid opaque color
        childStyle = {
           color: '#fbbf24',
           WebkitTextFillColor: '#fbbf24',
           textShadow: '0 0 10px rgba(251, 191, 36, 0.6)',
          backgroundImage: 'none'
        };
      }

      // If it has a special style (punctuation), wrap it. Otherwise, return raw text to inherit the gradient mask.
      return Object.keys(childStyle).length > 0 ? (
        <span key={cIdx} style={childStyle}>{char}</span>
      ) : (
        <React.Fragment key={cIdx}>{char}</React.Fragment>
      );
    });

    // Wrap the entire segment
    return <span style={parentStyle}>{renderedChars}</span>;
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
      
      if (document.queryCommandSupported('insertText')) {
        document.execCommand('insertText', false, markdownText);
      } else {
        const textarea = e.target;
        const newVal = (customData.lyrics || '').substring(0, textarea.selectionStart) + markdownText + (customData.lyrics || '').substring(textarea.selectionEnd);
        handleDataChange({ target: { name: 'lyrics', value: newVal } });
      }
    }
  };

  return (
    <div className="edit-lyrics-container">
      <div className="lyrics-textarea-wrapper">
        <textarea
          name="lyrics"
          value={customData.lyrics}
          onChange={handleDataChange}
          onPaste={handlePaste}
          className="lyrics-textarea"
          placeholder="Paste your lyrics here! Format lines using [Artist Name:] tags or *italics* / **bold** formatting."
        />
      </div>
      
      <div className="artist-preview-pane">
        <div className="artist-preview-header">
          <span className="artist-preview-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Artist Tag Preview
          </span>
          <span className="artist-preview-badge">{editParsedLyrics.length} lines</span>
        </div>
        
        <div className="artist-preview-scroll">
          {editGroupedLyrics.length > 0 ? (
            editGroupedLyrics.map((group, idx) => {
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
                    <div className="plain-section-header" style={{ marginTop: idx === 0 ? '0' : '24px', fontSize: '11px', paddingBottom: '4px', marginBottom: '8px' }}>
                      {displayHeader}
                    </div>
                  )}
                  <div className="preview-line-row" style={{ borderLeftColor: group.borderColor, display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    <span className="preview-line-singer">
                      {renderColoredSingerHeader(group.singer)}
                    </span>
                    <div className="preview-line-text-group" style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                      {group.lines.map((line, lIdx) => (
                        <div key={lIdx} className="preview-line-text" dir="auto">
                          {line.segments && line.segments.length > 0 ? (
                            line.segments.map((seg, sIdx) => (
                              <React.Fragment key={sIdx}>
                                {renderPlainColoredText(seg)}
                              </React.Fragment>
                            ))
                          ) : (
                            renderPlainColoredText(line)
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          ) : (
            <div className="preview-empty-text">Type lyrics on the left to see live artist separation...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditLyricsView;