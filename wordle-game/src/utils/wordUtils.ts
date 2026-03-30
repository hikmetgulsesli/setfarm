/**
 * Normalizes Turkish characters for comparison
 * Handles the Turkish 'i' issue: I → İ, ı → i
 */
export function normalizeTurkishChar(char: string): string {
  const upper = char.toUpperCase();
  if (upper === 'I') return 'İ';
  if (upper === 'İ') return 'İ';
  return char.toUpperCase();
}

/**
 * Normalizes a full word with Turkish character handling
 */
export function normalizeTurkishWord(word: string): string {
  return word
    .split('')
    .map(normalizeTurkishChar)
    .join('')
    .toLocaleUpperCase('tr-TR');
}

/**
 * Checks if a character is a valid Turkish letter
 */
export function isValidLetter(char: string): boolean {
  const validLetters = /^[a-zA-ZçÇğĞıİöÖşŞüÜ]$/;
  return validLetters.test(char);
}

/**
 * List of valid 5-letter Turkish words for the game
 * This is a sample list - in production, this would be more comprehensive
 */
export const VALID_WORDS: string[] = [
  'KİTAP', 'KALEM', 'SİNEK', 'KÖPEK', 'KEDİ',
  'EVLER', 'OKUL', 'SOKAK', 'BİLGİ', 'KÜTÜK',
  'ÇİÇEK', 'GÜNEŞ', 'BULUT', 'YAĞMUR', 'KARLI',
  'DENİZ', 'ORMAN', 'DAĞLAR', 'ŞEHİR', 'ÜLKE',
  'DÜNYA', 'AYDIN', 'IŞIK', 'KARAN', 'GECE',
  'GÜNDÜZ', 'SABAH', 'AKŞAM', 'ÖĞLEN', 'VAKİT',
  'SAAT', 'DAKİKA', 'SANİYE', 'HAFTA', 'AYLIK',
  'YILLIK', 'GÜNLÜK', 'ANLIK', 'HIZLI', 'YAVAŞ',
  'BÜYÜK', 'KÜÇÜK', 'ORTA', 'DARAL', 'GENİŞ',
  'YUKSEK', 'ALÇAK', 'DERİN', 'SIĞ', 'UZUN',
  'KISA', 'AĞIR', 'HAFİF', 'SICAK', 'SOĞUK',
  'ILIK', 'TEMİZ', 'KİRLİ', 'YENİ', 'ESKİ',
  'GÜZEL', 'ÇİRKİN', 'KOLAY', 'ZOR', 'AÇIK',
  'KAPALI', 'DOĞRU', 'YANLIŞ', 'HAKLI', 'HAKSIZ',
];

/**
 * Target words for daily challenges
 */
export const TARGET_WORDS: string[] = [
  'KİTAP', 'KALEM', 'SİNEK', 'KÖPEK', 'KEDİ',
  'EVLER', 'OKUL', 'ÇİÇEK', 'GÜNEŞ', 'BULUT',
  'DENİZ', 'ORMAN', 'ŞEHİR', 'DÜNYA', 'AYDIN',
  'IŞIK', 'GECE', 'SABAH', 'AKŞAM', 'SAAT',
];

/**
 * Gets a random target word
 */
export function getRandomTargetWord(): string {
  const today = new Date();
  const index = today.getDate() % TARGET_WORDS.length;
  return TARGET_WORDS[index];
}

/**
 * Validates if a word is in the valid words list
 */
export function isValidGuess(word: string): boolean {
  const normalized = normalizeTurkishWord(word);
  return VALID_WORDS.includes(normalized);
}

/**
 * LocalStorage keys
 */
export const STORAGE_KEYS = {
  GAME_STATE: 'wordle-game-state',
  STATISTICS: 'wordle-statistics',
} as const;