/* --- src/components/LyricsRenderer/LanguageEngines/CJKEngine.jsx --- */
import React from 'react';
import { normalizeTrans, parsePronunciation, getGraphemes, isCJ } from '../textUtils';
import { buildChunkElements, renderFormattedTranslation, getDisplayTranslation } from './EngineUtils';

const CJKEngine = ({ chars, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct }) => {
    const { parsedChunks, fullTrans } = parsePronunciation(pronunciation);
    let alignedChunks = [];

    if (isOnlyPunct) {
        alignedChunks.push({ type: 'main', trans: '', chars });
    } else {
        let canDo1to1 = false;
        let spacedWordsBlocks = [];
        let pronWords = [];

        if (hasSpacingText && fullTrans) {
            let currentBlock = [];
            chars.forEach(c => {
                if (/\s/.test(c.char)) {
                    if (currentBlock.length > 0) {
                        spacedWordsBlocks.push(currentBlock);
                        currentBlock = [];
                    }
                } else {
                    currentBlock.push(c);
                }
            });
            if (currentBlock.length > 0) spacedWordsBlocks.push(currentBlock);

            pronWords = fullTrans.split(/\s+/).filter(Boolean);
            if (spacedWordsBlocks.length === pronWords.length && spacedWordsBlocks.length > 0) {
                canDo1to1 = true;
            }
        }

        if (canDo1to1) {
            let tIdx = 0;
            let currentBlock = [];
            chars.forEach(c => {
                if (/\s/.test(c.char)) {
                    if (currentBlock.length > 0) {
                        const textStr = currentBlock.map(x => x.char).join('');
                        const isLatin = /^[\p{Script=Latin}\d\s' ".,!?:\-&()\[\]]+$/u.test(textStr);
                        const isOnlyP = /^[\p{P}\p{S}]+$/u.test(textStr);
                        
                        if (isOnlyP || isLatin) alignedChunks.push({ type: 'main', trans: '', chars: currentBlock });
                        else alignedChunks.push({ type: 'main', trans: pronWords[tIdx] || '', chars: currentBlock });
                        
                        tIdx++;
                        currentBlock = [];
                    }
                    alignedChunks.push({ type: 'space', trans: '', chars: [c] });
                } else {
                    currentBlock.push(c);
                }
            });
            if (currentBlock.length > 0) {
                const textStr = currentBlock.map(x => x.char).join('');
                const isLatin = /^[\p{Script=Latin}\d\s' ".,!?:\-&()\[\]]+$/u.test(textStr);
                const isOnlyP = /^[\p{P}\p{S}]+$/u.test(textStr);
                
                if (isOnlyP || isLatin) alignedChunks.push({ type: 'main', trans: '', chars: currentBlock });
                else alignedChunks.push({ type: 'main', trans: pronWords[tIdx] || '', chars: currentBlock });
            }
        } else if (parsedChunks && Array.isArray(parsedChunks)) {
            let charIdxPointer = 0;
            parsedChunks.forEach((chunk) => {
                const chunkText = chunk.text || '';
                const nonSpaceGraphemes = getGraphemes(chunkText.replace(/\s+/g, ''));
                let charsToConsume = 0;
                let tempPointer = charIdxPointer;

                if (nonSpaceGraphemes.length > 0) {
                    let matched = 0;
                    while (matched < nonSpaceGraphemes.length && tempPointer < chars.length) {
                        if (!/\s/.test(chars[tempPointer].char)) matched++;
                        charsToConsume++;
                        tempPointer++;
                    }
                } else {
                    while (tempPointer < chars.length && /\s/.test(chars[tempPointer].char)) {
                        charsToConsume++;
                        tempPointer++;
                    }
                }

                const chunkChars = chars.slice(charIdxPointer, charIdxPointer + charsToConsume);
                charIdxPointer += charsToConsume;

                if (chunkChars.length > 0) {
                    const cClean = chunkText.toLowerCase().replace(/[\W_]+/g, '');
                    const tClean = (chunk.trans || '').toLowerCase().replace(/[\W_]+/g, '');
                    
                    if (chunk.type === 'en' || (cClean && cClean === tClean)) {
                        alignedChunks.push({ type: 'en', trans: '', chars: chunkChars });
                    } else {
                        alignedChunks.push({ type: chunk.type || 'foreign', trans: chunk.trans, chars: chunkChars });
                    }
                }
            });
            
            if (charIdxPointer < chars.length) {
                alignedChunks.push({ type: 'main', trans: '', chars: chars.slice(charIdxPointer) });
            }
        } else {
            const transString = fullTrans || '';
            let blocks = [];
            let currentBlock = [];
            let isLatinMode = null;
            
            chars.forEach(c => {
                const isLatin = /^[\p{Script=Latin}\d\s' ".,!?:\-&()\[\]]+$/u.test(c.char);
                if (isLatinMode === null) {
                    isLatinMode = isLatin;
                    currentBlock.push(c);
                } else if (isLatinMode === isLatin) {
                    currentBlock.push(c);
                } else {
                    blocks.push({ isLatin: isLatinMode, chars: currentBlock });
                    isLatinMode = isLatin;
                    currentBlock = [c];
                }
            });
            if (currentBlock.length > 0) blocks.push({ isLatin: isLatinMode, chars: currentBlock });

            const transWords = transString.split(/\s+/).filter(Boolean);
            let tIdx = 0;
            
            blocks.forEach(b => {
                const blockStr = b.chars.map(c => c.char).join('');
                if (b.isLatin && blockStr.trim().length > 0) {
                    const latinWords = blockStr.split(/\s+/).filter(Boolean);
                    latinWords.forEach(lw => {
                        const lwClean = lw.toLowerCase().replace(/[\W_]+/g, '');
                        if (tIdx < transWords.length) {
                           const twClean = transWords[tIdx].toLowerCase().replace(/[\W_]+/g, '');
                           if (twClean === lwClean || twClean.includes(lwClean) || lwClean.includes(twClean)) {
                               tIdx++;
                           }
                        }
                    });
                    alignedChunks.push({ type: 'en', trans: '', chars: b.chars });
                } else if (!b.isLatin) {
                    let cjkTrans = [];
                    const nextLatinBlock = blocks.find(nb => nb.isLatin && nb !== b && blocks.indexOf(nb) > blocks.indexOf(b) && nb.chars.map(c=>c.char).join('').trim().length > 0);
                    const nextLatinFirstWord = nextLatinBlock ? nextLatinBlock.chars.map(c=>c.char).join('').split(/\s+/).filter(Boolean)[0] : null;
                    const nlwClean = nextLatinFirstWord ? nextLatinFirstWord.toLowerCase().replace(/[\W_]+/g, '') : '';

                    while (tIdx < transWords.length) {
                        if (nlwClean) {
                            let matchFound = false;
                            let lookAhead = '';
                            for (let i = tIdx; i < Math.min(tIdx + 4, transWords.length); i++) {
                                lookAhead += transWords[i].toLowerCase().replace(/[\W_]+/g, '');
                                if (lookAhead === nlwClean) {
                                    matchFound = true;
                                    break;
                                }
                            }
                            if (matchFound) break;
                        }
                        cjkTrans.push(transWords[tIdx]);
                        tIdx++;
                    }
                    alignedChunks.push({ type: 'main', trans: cjkTrans.join(' '), chars: b.chars });
                } else {
                    alignedChunks.push({ type: 'en', trans: '', chars: b.chars });
                }
            });
        }
    }

    const hasInlinePronunciation = alignedChunks.some(chunk => chunk.type !== 'en' && chunk.trans && chunk.trans.trim());
    const hasVisibleNonPronunciation = alignedChunks.some(chunk => (chunk.type === 'en' || !chunk.trans || !chunk.trans.trim()) && chunk.chars.some(c => c.char.trim() !== ''));
    const isHybridLine = hasInlinePronunciation && hasVisibleNonPronunciation;

    const mainJSX = buildChunkElements(alignedChunks, masterPalette, isFocused, hasSpacingText, false, isHybridLine);

    let displayPronString = null;
    if (pronunciation && !pronunciation.startsWith('{') && !pronunciation.startsWith('[')) {
        displayPronString = normalizeTrans(pronunciation);
    }

    const displayTrans = getDisplayTranslation(originalText, translation);
    const transJSX = displayTrans ? renderFormattedTranslation(displayTrans, isFocused) : null;
    const pronJSX = displayPronString ? renderFormattedTranslation(displayPronString, isFocused) : null;

    return { mainJSX, translationJSX: transJSX, pronunciationJSX: pronJSX };
};

export default CJKEngine;