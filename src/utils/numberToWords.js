/* --- src/utils/numberToWords.js --- */
const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

const convertTens = (num) => {
  if (num < 10) return ones[num];
  else if (num >= 10 && num < 20) return teens[num - 10];
  else {
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + ones[num % 10] : "");
  }
};

const convertHundreds = (num) => {
  if (num > 99) {
    return ones[Math.floor(num / 100)] + " hundred" + (num % 100 !== 0 ? " " + convertTens(num % 100) : "");
  } else {
    return convertTens(num);
  }
};

export const numberToEnglishWords = (num) => {
  if (num === 0 || num === "0") return "zero";
  if (!num || isNaN(num)) return "";
  let n = parseInt(num, 10);
  if (n < 0) return "minus " + numberToEnglishWords(-n);
  if (n >= 1e9) return n.toString(); // Fallback for massive numbers

  let word = "";
  if (n >= 1e6) {
    word += convertHundreds(Math.floor(n / 1e6)) + " million ";
    n %= 1e6;
  }
  if (n >= 1e3) {
    word += convertHundreds(Math.floor(n / 1e3)) + " thousand ";
    n %= 1e3;
  }
  if (n > 0) {
    word += convertHundreds(n);
  }
  return word.trim();
};