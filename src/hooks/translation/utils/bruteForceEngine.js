/* --- src/hooks/translation/utils/bruteForceEngine.js --- */
import { fetchGoogleWithLang } from './translationApi';

export const isSpacelessScript = (char) => {
  return /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af\u0e00-\u0e7f\uff00-\uffef]/.test(char);
};

export const cleanPunctuationPythonStyle = (str) => {
  if (!str) return '';
  return str.replace(/['!"(),*+.:%;<!¬~=>?\[\\\]^_`।{|}~،؟¿¡”（）‘’？！\-♫\u266B]/g, '').trim();
};

export const extractPunctuationMap = (block) => {
  const punctuationRegex = /[\p{P}\p{S}\u3000-\u303f\uff00-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65]/u;
  let cleanText = '';
  let punctMap = [];
  let currentPrefix = '';

  for (let i = 0; i < block.length; i++) {
    const char = block[i];
    if (punctuationRegex.test(char)) {
      if (cleanText.length === 0) {
        currentPrefix += char;
      } else {
        if (!punctMap[cleanText.length - 1]) {
          punctMap[cleanText.length - 1] = { prefix: '', suffix: '' };
        }
        punctMap[cleanText.length - 1].suffix += char;
      }
    } else {
      cleanText += char;
      punctMap.push({ prefix: currentPrefix, suffix: '' });
      currentPrefix = '';
    }
  }

  if (cleanText.length === 0 && currentPrefix.length > 0) {
    return { cleanText: '', purePunctuation: currentPrefix, punctMap: [] };
  }

  return { cleanText, purePunctuation: null, punctMap };
};

/**
 * PRECISE PORT OF PYTHON chinese_and_japanese(line) BRUTE FORCE ALGORITHM
 * Uses \u266B as the context query delimiter.
 */
export const runBruteForceAlignment = async (line, fullPron, sl, cancelRef) => {
  let k = fullPron;
  if (!k) {
    const fetchResMain = await fetchGoogleWithLang(line.replace(/\s+/g, ''), sl);
    k = fetchResMain.transliteration || fetchResMain.translation || '';
  }

  let pronCleaned = cleanPunctuationPythonStyle(k.toLowerCase());
  let liner_main = pronCleaned.split(/\s+/).filter(t => t.length > 0).reverse();

  let w = '';
  let character = '';
  let add_to = [];
  let word_gotten = 0;
  let p = '';

  const lineChars = Array.from(line).reverse();

  for (let char of lineChars) {
    if (cancelRef && cancelRef.current) break;

    character = char;
    w = character + w;

    // CONTEXT QUERY USING MUSIC NOTE SYMBOL (\u266B)
    let contextStr = `(${line}) \u266B ${w}`;
    let fetchRes = await fetchGoogleWithLang(contextStr, sl);
    let rawP = fetchRes.transliteration || fetchRes.translation || '';

    let parts = rawP.toLowerCase().split(/\s*[\u266B♫]\s*/);
    let lastSegment = parts[parts.length - 1].replace(/^[-.,_]+/, '').trim();
    p = cleanPunctuationPythonStyle(lastSegment);

    let liner = liner_main.slice(word_gotten, word_gotten + 1);

    // --- TYPE 1: Natural match ---
    if (liner.length > 0 && p === liner[0]) {
      add_to.unshift({ text: w, pron: liner[0] });
      w = '';
      word_gotten++;
      continue;
    }

    // --- TYPE 2: Separately match ---
    if (liner.length > 0 && p.replace(/\s+/g, '') === liner[0]) {
      add_to.unshift({ text: w, pron: liner[0] });
      w = '';
      word_gotten++;
      continue;
    }

    // --- TYPE Y: Residual trailing match ---
    if (liner.length === 0) {
      if (add_to.length > 0) {
        add_to[0].text = w + add_to[0].text;
      } else {
        add_to.unshift({ text: w, pron: '' });
      }
      w = '';
      continue;
    }

    // --- TYPE 4 & TYPE 5: Multiple words returned in p ---
    let pSplit = p.split(/\s+/).filter(x => x.length > 0);
    if (pSplit.length > 1) {
      if (pSplit.length === 2 && w.length === 2 && liner.length > 0 && pSplit[pSplit.length - 1] === liner[0]) {
        add_to.unshift({ text: w.substring(1), pron: liner[0] });
        w = w[0];
        word_gotten++;
      }

      let linerCurrent = liner_main.slice(word_gotten, word_gotten + 1);
      if (linerCurrent.length > 0 && pSplit[0] === linerCurrent[0]) {
        add_to.unshift({ text: w, pron: linerCurrent[0] });
        w = '';
        word_gotten++;
        continue;
      } else {
        continue;
      }
    }
  }

  // --- POST-LOOP RESIDUAL HANDLING ---
  if (w !== '') {
    w = w.trim();
    let wSplit = w.split(/\s+/).filter(x => x.length > 0);

    if (wSplit.length === p.length) {
      for (let item of wSplit.slice().reverse()) {
        add_to.unshift({ text: w, pron: liner_main[word_gotten] || '' });
        word_gotten++;
      }
    } else {
      let line1 = w;
      let liner_main1 = liner_main.slice(word_gotten).reverse();

      let w1 = '';
      let character1 = '';
      let add_to1 = [];
      let word_gotten1 = 0;

      for (let char1 of Array.from(line1)) {
        if (cancelRef && cancelRef.current) break;
        character1 = char1;
        w1 = w1 + character1;

        let fetchRes11 = await fetchGoogleWithLang(`(${line1}) \u266B ${w1}`, sl);
        let rawP11 = fetchRes11.transliteration || fetchRes11.translation || '';
        let parts11 = rawP11.toLowerCase().split(/\s*[\u266B♫]\s*/);
        let lastSegment11 = parts11[parts11.length - 1].replace(/^[-.,_]+/, '').trim();
        let p11 = cleanPunctuationPythonStyle(lastSegment11);

        let liner1 = liner_main1.slice(word_gotten1, word_gotten1 + 1);

        if (liner1.length > 0 && p11 === liner1[0]) {
          add_to1.push({ text: w1, pron: liner1[0] });
          w1 = '';
          word_gotten1++;
          continue;
        }
      }

      if (w1 !== '') {
        add_to1.push({ text: w1, pron: liner_main1[word_gotten1] || '' });
      }

      add_to = add_to1.concat(add_to);
    }
  }

  return add_to;
};