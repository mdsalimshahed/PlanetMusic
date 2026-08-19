/* --- src/components/LyricsRenderer/LanguageEngines/DefaultEngine.jsx --- */
import React from 'react';
import { normalizeTrans, parsePronunciation, getGraphemes, isCJ } from '../textUtils.js';
import { buildChunkElements, renderFormattedTranslation, getDisplayTranslation } from './EngineUtils.jsx';

const DefaultEngine = ({ chars, translation, pronunciation, hasSpacingText, isFocused, masterPalette, originalText, isOnlyPunct, isAdlib }) => {
    const { parsedChunks, fullTrans } = parsePronunciation(pronunciation);
    let alignedChunks = [];

    if (isOnlyPunct) {
        alignedChunks.push({ type: 'main', trans: '', chars });
    } else {
        let canDo1to1 = false;
        let spacedWordsBlocks = [];
        let pronWords = [];

        // 1. Group characters into word blocks by whitespace
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

        // 2. Clean raw pronunciation string and extract space-separated transliteration tokens
        const rawPronString = fullTrans || (typeof pronunciation === 'string' && !pronunciation.startsWith('{') && !pronunciation.startsWith('[') ? pronunciation : '');
        const cleanPronForWords = rawPronString ? rawPronString.replace(/[()\uff08\uff09]/g, '').trim() : '';
        pronWords = cleanPronForWords.split(/\s+/).filter(Boolean);

        // Filter out blocks that are strictly punctuation/parentheses to count meaningful words
        const meaningfulWordBlocks = spacedWordsBlocks.filter(b => {
            const str = b.map(x => x.char).join('').replace(/[\p{P}\p{S}]/gu, '').trim();
            return str.length > 0;
        });

        if (meaningfulWordBlocks.length > 0 && meaningfulWordBlocks.length === pronWords.length) {
            canDo1to1 = true;
        }

        if (canDo1to1) {
            let tIdx = 0;
            let currentBlockChars = [];

            chars.forEach(c => {
                if (/\s/.test(c.char)) {
                    if (currentBlockChars.length > 0) {
                        const textStr = currentBlockChars.map(x => x.char).join('');
                        const cleanStr = textStr.replace(/[\p{P}\p{S}]/gu, '').trim();
                        const isLatin = /^[\p{Script=Latin}\d\s' ".,!?:\-&()\[\]]+$/u.test(cleanStr);
                        const isOnlyP = /^[\p{P}\p{S}]+$/u.test(textStr);

                        if (isOnlyP) {
                            alignedChunks.push({ type: 'main', trans: '', chars: currentBlockChars });
                        } else if (isLatin && cleanStr.toLowerCase() === (pronWords[tIdx] || '').toLowerCase()) {
                            // English word matches transliteration -> muted transliteration
                            alignedChunks.push({ type: 'en', trans: '', chars: currentBlockChars });
                            tIdx++;
                        } else {
                            alignedChunks.push({ type: 'foreign', trans: pronWords[tIdx] || '', chars: currentBlockChars });
                            tIdx++;
                        }

                        currentBlockChars = [];
                    }
                    alignedChunks.push({ type: 'space', trans: '', chars: [c] });
                } else {
                    currentBlockChars.push(c);
                }
            });

            if (currentBlockChars.length > 0) {
                const textStr = currentBlockChars.map(x => x.char).join('');
                const cleanStr = textStr.replace(/[\p{P}\p{S}]/gu, '').trim();
                const isLatin = /^[\p{Script=Latin}\d\s' ".,!?:\-&()\[\]]+$/u.test(cleanStr);
                const isOnlyP = /^[\p{P}\p{S}]+$/u.test(textStr);

                if (isOnlyP) {
                    alignedChunks.push({ type: 'main', trans: '', chars: currentBlockChars });
                } else if (isLatin && cleanStr.toLowerCase() === (pronWords[tIdx] || '').toLowerCase()) {
                    alignedChunks.push({ type: 'en', trans: '', chars: currentBlockChars });
                } else {
                    alignedChunks.push({ type: 'foreign', trans: pronWords[tIdx] || '', chars: currentBlockChars });
                }
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
                    const cClean = chunkText.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
                    const tClean = (chunk.trans || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
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
                alignedChunks.push({ type: 'main', trans: fullTrans || '', chars: currentChars });
            }
        }
    }

    const hasInlinePronunciation = alignedChunks.some(chunk => chunk.type !== 'en' && chunk.trans && chunk.trans.trim());
    const hasVisibleNonPronunciation = alignedChunks.some(chunk => (chunk.type === 'en' || !chunk.trans || !chunk.trans.trim()) && chunk.chars.some(c => c.char.trim() !== ''));
    const isHybridLine = hasInlinePronunciation && hasVisibleNonPronunciation;

    const mainJSX = buildChunkElements(alignedChunks, masterPalette, isFocused, true, false, isHybridLine, isAdlib);

    let displayPronString = null;
    if (!hasInlinePronunciation && pronunciation && !pronunciation.startsWith('{') && !pronunciation.startsWith('[')) {
        const isCJKLine = chars.some(c => isCJ(c.char));
        if (!isCJKLine && !parsedChunks) {
            const cleanOrig = originalText.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
            const cleanPron = pronunciation.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
            if (cleanOrig !== cleanPron) {
                displayPronString = normalizeTrans(pronunciation, !isAdlib);
            }
        }
    }
    if (isAdlib && displayPronString) {
        displayPronString = displayPronString.replace(/[()\[\]{} ]/g, '').trim();
    }

    const displayTrans = getDisplayTranslation(originalText, translation);
    const transJSX = displayTrans ? renderFormattedTranslation(displayTrans, isFocused) : null;
    const pronJSX = displayPronString ? renderFormattedTranslation(displayPronString, isFocused) : null;

    return { mainJSX, translationJSX: transJSX, pronunciationJSX: pronJSX };
};

export default DefaultEngine;