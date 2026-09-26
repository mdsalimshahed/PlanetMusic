const isWordCharacter = (character) => Boolean(character && /[\p{L}\p{N}]/u.test(character));
const isOpeningBoundary = (character) => !character || /[\s([{\u2014\u2013-]/u.test(character);

export const toSmartPunctuation = (value) => {
  const characters = Array.from(String(value ?? ''));

  return characters.map((character, index) => {
    if (character !== "'" && character !== '"') return character;

    const previous = characters[index - 1] || '';
    const next = characters[index + 1] || '';

    if (character === "'") {
      if (isWordCharacter(previous) && isWordCharacter(next)) return '\u2019';
      if ((!previous || /\s/u.test(previous)) && /\d/u.test(next)) return '\u2019';
      return isOpeningBoundary(previous) ? '\u2018' : '\u2019';
    }

    return isOpeningBoundary(previous) ? '\u201c' : '\u201d';
  }).join('');
};