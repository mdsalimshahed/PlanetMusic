/* --- src/utils/markdownUtils.jsx --- */
import React from 'react';
import { toSmartPunctuation } from '../../utils/smartPunctuation.js';
import { getProceduralColor, getProceduralGradient } from '../../utils/proceduralColors.js';

const getGradientStyle = (nextColorIndex) => ({
  backgroundImage: getProceduralGradient(nextColorIndex()),
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  display: 'inline-block',
  maxWidth: '100%'
});

export const renderMarkdown = (text, colorScope) => {
  if (!text) return null;

  let colorIndex = 0;
  const nextColorIndex = () => `${colorScope}:${colorIndex++}`;
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
                  {renderBlockUnit(partTrimmed, `${idx}-${pIdx}`, nextColorIndex)}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      }
    }

    return renderBlockUnit(trimmed, idx, nextColorIndex);
  });
};

const renderBlockUnit = (trimmed, key, nextColorIndex) => {
  if (trimmed.startsWith('### ')) {
    const content = trimmed.replace(/^###\s+/, '');
    return <h3 key={key} style={getGradientStyle(nextColorIndex)}>{parseInline(content, nextColorIndex)}</h3>;
  }
  if (trimmed.startsWith('## ')) {
    const content = trimmed.replace(/^##\s+/, '');
    return <h2 key={key} style={getGradientStyle(nextColorIndex)}>{parseInline(content, nextColorIndex)}</h2>;
  }
  if (trimmed.startsWith('# ')) {
    const content = trimmed.replace(/^#\s+/, '');
    return <h1 key={key} style={getGradientStyle(nextColorIndex)}>{parseInline(content, nextColorIndex)}</h1>;
  }

  if (trimmed.startsWith('> ')) {
    const quoteText = trimmed.split('\n').map(l => l.replace(/^>\s*/, '')).join(' ');
    return <blockquote key={key} className="blog-tip-box">{parseInline(quoteText, nextColorIndex)}</blockquote>;
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
    const items = trimmed.split('\n')
      .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))
      .map(line => line.trim().slice(2));
    return (
      <ul key={key}>
        {items.map((it, i) => (
          <li key={i}>{parseInline(it, nextColorIndex)}</li>
        ))}
      </ul>
    );
  }

  const lines = trimmed.split('\n');
  return (
    <p key={key}>
      {lines.map((line, lIdx) => (
        <React.Fragment key={lIdx}>
          {parseInline(line, nextColorIndex)}
          {lIdx < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </p>
  );
};

const parseInline = (text, nextColorIndex) => {
  if (!text) return '';
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      const boldColor = getProceduralColor(nextColorIndex());
      return (
        <strong key={i} style={{ color: boldColor, fontWeight: 800 }}>
          {toSmartPunctuation(boldText)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{toSmartPunctuation(part.slice(1, -1))}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
          {toSmartPunctuation(linkMatch[1])}
        </a>
      );
    }
    return toSmartPunctuation(part);
  });
};