/* --- src/components/LyricsRenderer/LanguageEngines/RTLEngine.jsx --- */
import React from 'react';
import { normalizeTrans, parsePronunciation } from '../textUtils.js';
import { buildChunkElements, renderFormattedTranslation, getDisplayTranslation } from './EngineUtils.jsx';

const RTLEngine = ({ chars, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct, isAdlib }) => {
    const { parsedChunks, fullTrans } = parsePronunciation(pronunciation);
    let alignedChunks = [];

    // 1. Group characters by segment colors without 1:1 mapping for RTL
    let currentSeg = null;
    let currentChars = [];

    chars.forEach(c => {
        if (currentSeg === null) currentSeg = c.seg;
        if (currentSeg === c.seg) {
            currentChars.push(c);
        } else {
            alignedChunks.push({ type: 'main', trans: '', chars: currentChars });
            currentChars = [c];
            currentSeg = c.seg;
        }
    });

    if (currentChars.length > 0) {
        alignedChunks.push({ type: 'main', trans: '', chars: currentChars });
    }

    const mainJSX = buildChunkElements(alignedChunks, masterPalette, isFocused, hasSpacingText, true, false);

    // 2. BLOCK PRONUNCIATION
    // For RTL: If the line is an adlib OR contains adlibs, omit parentheses from the pronunciation block.
    // Parentheses are kept only if it's a main line without adlib parts.
    const shouldKeepParens = !isAdlib;
    let displayPronString = null;

    if (fullTrans) {
        displayPronString = normalizeTrans(fullTrans, shouldKeepParens);
    } else if (parsedChunks) {
        displayPronString = parsedChunks
            .map(c => normalizeTrans(c.trans || c.text, shouldKeepParens))
            .filter(Boolean)
            .join(' ');
    } else if (pronunciation && typeof pronunciation === 'string') {
        displayPronString = normalizeTrans(pronunciation, shouldKeepParens);
    }

    // Always ensure parens are completely stripped if rendering an adlib unit
    if (isAdlib && displayPronString) {
        displayPronString = displayPronString.replace(/[()\[\]{}]/g, '').trim();
    }

    const displayTrans = getDisplayTranslation(originalText, translation);
    const transJSX = displayTrans ? renderFormattedTranslation(displayTrans, isFocused) : null;
    
    // Explicitly set fontFamily to var(--font-family) for the Latin pronunciation block
    const pronJSX = displayPronString ? (
        <span style={{ display: 'block', textAlign: 'center', width: '100%', fontFamily: 'var(--font-family)' }}>
            {renderFormattedTranslation(displayPronString, isFocused)}
        </span>
    ) : null;

    return { mainJSX, translationJSX: transJSX, pronunciationJSX: pronJSX };
};

export default RTLEngine;