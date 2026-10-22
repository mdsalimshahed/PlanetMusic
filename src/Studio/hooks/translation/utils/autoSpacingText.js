const cjkCharacterPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const combiningMarkPattern = /\p{M}/u;

export const splitAutoSpacingBlocks = (text) => {
  const blocks = [];

  for (const character of text) {
    const previousBlock = blocks.at(-1);
    const mode = cjkCharacterPattern.test(character)
      || (combiningMarkPattern.test(character) && previousBlock?.mode === 'cjk')
      ? 'cjk'
      : 'latin';

    if (previousBlock?.mode === mode) {
      previousBlock.text += character;
    } else {
      blocks.push({ mode, text: character });
    }
  }

  return blocks;
};
