// Minimalist & Industrial-Grade Vietnamese Telex Engine
// 100% self-contained, zero-dependency, O(1) performance

const VOWEL_MAP: Record<string, Record<string, string>> = {
  // Base vowels with tones: [ngang, sac, huyen, hoi, nga, nang]
  'a': { s: 'á', f: 'à', r: 'ả', x: 'ã', j: 'ạ' },
  'ă': { s: 'ắ', f: 'ằ', r: 'ẳ', x: 'ẵ', j: 'ặ' },
  'â': { s: 'ấ', f: 'ầ', r: 'ẩ', x: 'ẫ', j: 'ậ' },
  'e': { s: 'é', f: 'è', r: 'ẻ', x: 'ẽ', j: 'ẹ' },
  'ê': { s: 'ế', f: 'ề', r: 'ể', x: 'ễ', j: 'ệ' },
  'i': { s: 'í', f: 'ì', r: 'ỉ', x: 'ĩ', j: 'ị' },
  'o': { s: 'ó', f: 'ò', r: 'ỏ', x: 'õ', j: 'ọ' },
  'ô': { s: 'ố', f: 'ồ', r: 'ổ', x: 'ỗ', j: 'ộ' },
  'ơ': { s: 'ớ', f: 'ờ', r: 'ở', x: 'ỡ', j: 'ợ' },
  'u': { s: 'ú', f: 'ù', r: 'ủ', x: 'ũ', j: 'ụ' },
  'ư': { s: 'ứ', f: 'ừ', r: 'ử', x: 'ữ', j: 'ự' },
  'y': { s: 'ý', f: 'ỳ', r: 'ỷ', x: 'ỹ', j: 'ỵ' },
};

// Map with tone stripping
const BASE_VOWELS: Record<string, string> = {};
const TONE_CHAR_TO_TYPE: Record<string, string> = {};

for (const [base, tones] of Object.entries(VOWEL_MAP)) {
  for (const [toneKey, accentedChar] of Object.entries(tones)) {
    BASE_VOWELS[accentedChar] = base;
    TONE_CHAR_TO_TYPE[accentedChar] = toneKey;
    // Uppercase
    BASE_VOWELS[accentedChar.toUpperCase()] = base.toUpperCase();
    TONE_CHAR_TO_TYPE[accentedChar.toUpperCase()] = toneKey;
  }
}

// Check if char is vowel
function isVowel(c: string): boolean {
  const lower = c.toLowerCase();
  return lower in VOWEL_MAP || lower in BASE_VOWELS || ['a','e','i','o','u','y','ă','â','ê','ô','ơ','ư'].includes(lower);
}

// Convert a single word with new key pressed
export function processTelexKey(currentWord: string, key: string): { replaced: boolean; newWord: string } {
  const k = key.toLowerCase();

  // 1. Double character transformation (aa -> â, ee -> ê, oo -> ô, dd -> đ)
  if (k === 'a' && currentWord.endsWith('a')) {
    return { replaced: true, newWord: currentWord.slice(0, -1) + 'â' };
  }
  if (k === 'a' && currentWord.endsWith('A')) {
    return { replaced: true, newWord: currentWord.slice(0, -1) + 'Â' };
  }
  if (k === 'e' && currentWord.endsWith('e')) {
    return { replaced: true, newWord: currentWord.slice(0, -1) + 'ê' };
  }
  if (k === 'e' && currentWord.endsWith('E')) {
    return { replaced: true, newWord: currentWord.slice(0, -1) + 'Ê' };
  }
  if (k === 'o' && currentWord.endsWith('o')) {
    return { replaced: true, newWord: currentWord.slice(0, -1) + 'ô' };
  }
  if (k === 'o' && currentWord.endsWith('O')) {
    return { replaced: true, newWord: currentWord.slice(0, -1) + 'Ô' };
  }
  if (k === 'd' && currentWord.toLowerCase().endsWith('d')) {
    const isUpper = currentWord[currentWord.length - 1] === 'D';
    return { replaced: true, newWord: currentWord.slice(0, -1) + (isUpper ? 'Đ' : 'đ') };
  }

  // 2. 'w' modifier (aw -> ă, ow -> ơ, uw -> ư, uow -> ươ)
  if (k === 'w') {
    if (currentWord.toLowerCase().endsWith('uo')) {
      const isUpper = currentWord.endsWith('UO');
      return { replaced: true, newWord: currentWord.slice(0, -2) + (isUpper ? 'ƯƠ' : 'ươ') };
    }
    if (currentWord.toLowerCase().endsWith('u')) {
      const isUpper = currentWord.endsWith('U');
      return { replaced: true, newWord: currentWord.slice(0, -1) + (isUpper ? 'Ư' : 'ư') };
    }
    if (currentWord.toLowerCase().endsWith('o')) {
      const isUpper = currentWord.endsWith('O');
      return { replaced: true, newWord: currentWord.slice(0, -1) + (isUpper ? 'Ơ' : 'ơ') };
    }
    if (currentWord.toLowerCase().endsWith('a')) {
      const isUpper = currentWord.endsWith('A');
      return { replaced: true, newWord: currentWord.slice(0, -1) + (isUpper ? 'Ă' : 'ă') };
    }
    // Standalone w
    return { replaced: false, newWord: currentWord + key };
  }

  // 3. Tone keys: s (sắc), f (huyền), r (hỏi), x (ngã), j (nặng)
  if (['s', 'f', 'r', 'x', 'j'].includes(k)) {
    // Find vowel position to apply tone (standard modern Vietnamese rules)
    let vowelIdx = -1;
    const chars = Array.from(currentWord);

    // Identify vowels
    const vowels: { idx: number; char: string; lower: string }[] = [];
    for (let i = 0; i < chars.length; i++) {
      if (isVowel(chars[i])) {
        vowels.push({ idx: i, char: chars[i], lower: chars[i].toLowerCase() });
      }
    }

    if (vowels.length === 0) {
      return { replaced: false, newWord: currentWord + key };
    }

    // Modern tone placement rule:
    // If 1 vowel -> that vowel
    // If 2 vowels:
    //   - ends with consonant -> 2nd vowel (e.g. "hoán", "toán")
    //   - ends with vowel -> 1st vowel (e.g. "hóa", "thỏa") unless "oa", "oe", "uy"
    // If 3 vowels -> middle vowel (e.g. "khoèo")
    if (vowels.length === 1) {
      vowelIdx = vowels[0].idx;
    } else if (vowels.length === 2) {
      const lastChar = chars[chars.length - 1];
      const hasEndingConsonant = !isVowel(lastChar);
      if (hasEndingConsonant) {
        vowelIdx = vowels[1].idx;
      } else {
        const pair = vowels.map(v => v.lower).join('');
        if (['oa', 'oe', 'uy', 'ue'].includes(pair)) {
          vowelIdx = vowels[1].idx;
        } else {
          vowelIdx = vowels[0].idx;
        }
      }
    } else {
      vowelIdx = vowels[1].idx; // middle
    }

    const targetChar = chars[vowelIdx];
    const targetLower = targetChar.toLowerCase();
    const base = BASE_VOWELS[targetChar] || targetLower;
    const isUpper = targetChar === targetChar.toUpperCase();

    // Check if same tone already applied -> undo tone
    if (TONE_CHAR_TO_TYPE[targetChar] === k) {
      chars[vowelIdx] = isUpper ? base.toUpperCase() : base;
      return { replaced: true, newWord: chars.join('') + key };
    }

    const toneTable = VOWEL_MAP[base];
    if (toneTable && toneTable[k]) {
      const accented = toneTable[k];
      chars[vowelIdx] = isUpper ? accented.toUpperCase() : accented;
      return { replaced: true, newWord: chars.join('') };
    }
  }

  return { replaced: false, newWord: currentWord + key };
}
