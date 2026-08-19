/* --- src/utils/markdownUtils.jsx --- */
import React from 'react';

// Vibrant bold text colors palette
const BOLD_COLORS = [
  '#fbbf24', // Amber Gold
  '#1DB954', // Spotify Green
  '#38bdf8', // Neon Sky Blue
  '#a855f7', // Electric Purple
  '#f43f5e', // Rose Coral
  '#34d399', // Mint Emerald
  '#fb923c', // Bright Orange
  '#c084fc'  // Lavender
];

// Dynamic linear gradient mixes for Title Headings
const GRADIENTS = [
  'linear-gradient(135deg, #fbbf24 0%, #f43f5e 100%)',
  'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)',
  'linear-gradient(135deg, #1DB954 0%, #38bdf8 100%)',
  'linear-gradient(135deg, #c084fc 0%, #f43f5e 100%)',
  'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #34d399 0%, #38bdf8 100%)',
  'linear-gradient(135deg, #f43f5e 0%, #a855f7 100%)'
];

export const getRandomColor = () => {
  return BOLD_COLORS[Math.floor(Math.random() * BOLD_COLORS.length)];
};

export const getRandomGradient = () => {
  return GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
};

const getGradientStyle = () => ({
  backgroundImage: getRandomGradient(),
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  display: 'inline-block',
  maxWidth: '100%'
});

export const renderMarkdown = (text) => {
  if (!text) return null;

  const blocks = text.split(/\n\n+/);

  return blocks.map((block, idx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (/^(---|[*]{3})$/.test(trimmed)) {
      return <hr key={idx} className="blog-divider" />;
    }

    if (trimmed.includes('---')) {
      const subParts = trimmed.split(/\n?---\n?/);
      if (subParts.length > 1) {
        return (
          <React.Fragment key={idx}>
            {subParts.map((part, pIdx) => {
              const partTrimmed = part.trim();
              if (!partTrimmed) return null;
              return (
                <React.Fragment key={pIdx}>
                  {pIdx > 0 && <hr className="blog-divider" />}
                  {renderBlockUnit(partTrimmed, `${idx}-${pIdx}`)}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      }
    }

    return renderBlockUnit(trimmed, idx);
  });
};

const renderBlockUnit = (trimmed, key) => {
  if (trimmed.startsWith('### ')) {
    const content = trimmed.replace(/^###\s+/, '');
    return <h3 key={key} style={getGradientStyle()}>{parseInline(content)}</h3>;
  }
  if (trimmed.startsWith('## ')) {
    const content = trimmed.replace(/^##\s+/, '');
    return <h2 key={key} style={getGradientStyle()}>{parseInline(content)}</h2>;
  }
  if (trimmed.startsWith('# ')) {
    const content = trimmed.replace(/^#\s+/, '');
    return <h1 key={key} style={getGradientStyle()}>{parseInline(content)}</h1>;
  }

  if (trimmed.startsWith('> ')) {
    const quoteText = trimmed.split('\n').map(l => l.replace(/^>\s*/, '')).join(' ');
    return <blockquote key={key} className="blog-tip-box">{parseInline(quoteText)}</blockquote>;
  }

  if (trimmed.startsWith('```')) {
    const code = trimmed.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
    return (
      <pre key={key} className="blog-code-block">
        <code>{code}</code>
      </pre>
    );
  }

  if (/^[-*]\s+/m.test(trimmed)) {
    const items = trimmed.split('\n').filter(l => /^[-*]\s+/.test(l.trim()));
    return (
      <ul key={key}>
        {items.map((it, i) => (
          <li key={i}>{parseInline(it.replace(/^[-*]\s+/, ''))}</li>
        ))}
      </ul>
    );
  }

  const lines = trimmed.split('\n');
  return (
    <p key={key}>
      {lines.map((line, lIdx) => (
        <React.Fragment key={lIdx}>
          {parseInline(line)}
          {lIdx < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </p>
  );
};

const parseInline = (text) => {
  if (!text) return '';
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      const boldColor = getRandomColor();
      return (
        <strong key={i} style={{ color: boldColor, fontWeight: 800 }}>
          {boldText}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
};