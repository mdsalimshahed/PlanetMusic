/* --- src/utils/markdownUtils.jsx --- */
import React from 'react';

export const renderMarkdown = (text) => {
  if (!text) return null;

  // Split content into blocks by double line breaks
  const blocks = text.split(/\n\n+/);

  return blocks.map((block, idx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Headings
    if (trimmed.startsWith('### ')) {
      return <h3 key={idx}>{parseInline(trimmed.replace(/^###\s+/, ''))}</h3>;
    }
    if (trimmed.startsWith('## ')) {
      return <h2 key={idx}>{parseInline(trimmed.replace(/^##\s+/, ''))}</h2>;
    }
    if (trimmed.startsWith('# ')) {
      return <h1 key={idx}>{parseInline(trimmed.replace(/^#\s+/, ''))}</h1>;
    }

    // Blockquotes
    if (trimmed.startsWith('> ')) {
      const quoteText = trimmed.split('\n').map(l => l.replace(/^>\s*/, '')).join(' ');
      return <blockquote key={idx} className="blog-tip-box">{parseInline(quoteText)}</blockquote>;
    }

    // Code Blocks
    if (trimmed.startsWith('```')) {
      const code = trimmed.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
      return (
        <pre key={idx} className="blog-code-block">
          <code>{code}</code>
        </pre>
      );
    }

    // Unordered Lists
    if (/^[-*]\s+/m.test(trimmed)) {
      const items = trimmed.split('\n').filter(l => /^[-*]\s+/.test(l.trim()));
      return (
        <ul key={idx}>
          {items.map((it, i) => (
            <li key={i}>{parseInline(it.replace(/^[-*]\s+/, ''))}</li>
          ))}
        </ul>
      );
    }

    // Standard Paragraph with internal line breaks preserved
    const lines = trimmed.split('\n');
    return (
      <p key={idx}>
        {lines.map((line, lIdx) => (
          <React.Fragment key={lIdx}>
            {parseInline(line)}
            {lIdx < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  });
};

// Helper for inline formatting (**bold**, *italic*, `code`, [link](url))
const parseInline = (text) => {
  if (!text) return '';
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
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