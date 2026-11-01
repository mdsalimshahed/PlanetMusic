const latinConfusableChars = new Set(
  'АВЕКМНОРСТУХаеорсухіјѕΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεηικνορτυχϲ'
);

export const isLatinLikeToken = token => {
  let latinLetterCount = 0;
  let confusableLetterCount = 0;

  for (const char of token) {
    const normalized = char.normalize('NFKD');
    if (/^[\p{Script=Latin}\p{M}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(normalized)) {
      latinLetterCount += Array.from(normalized).filter(
        part => /\p{Script=Latin}/u.test(part)
      ).length;
    } else if (latinConfusableChars.has(char)) {
      confusableLetterCount++;
    } else {
      return false;
    }
  }

  return latinLetterCount > confusableLetterCount;
};

export const isLatinLikeText = text => {
  const tokens = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;

  const hasLatinLetter = tokens.some(token => Array.from(token).some(
    char => /\p{Script=Latin}/u.test(char.normalize('NFKD'))
  ));

  return hasLatinLetter && tokens.every(token => (
    isLatinLikeToken(token) || /^[\p{P}\p{S}]+$/u.test(token)
  ));
};
