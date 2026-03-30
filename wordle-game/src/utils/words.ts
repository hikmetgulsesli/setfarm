// Turkish word list for the game
export const WORD_LIST = [
  'KİTAP', 'KALEM', 'SİNEK', 'KÖPEK', 'KEDİ', 'EVLER', 'OKUL', 'SOKAK',
  'BİLGİ', 'KÜTÜK', 'ÇİÇEK', 'GÜNEŞ', 'BULUT', 'YAĞMUR', 'KARLI', 'DENİZ',
  'ORMAN', 'DAĞLAR', 'ŞEHİR', 'ÜLKE', 'DÜNYA', 'AYDIN', 'IŞIK', 'KARAN',
  'GECE', 'GÜNDÜZ', 'SABAH', 'AKŞAM', 'ÖĞLEN', 'VAKİT', 'SAAT', 'DAKİKA',
  'SANİYE', 'HAFTA', 'AYLIK', 'YILLIK', 'GÜNLÜK', 'ANLIK', 'HIZLI', 'YAVAŞ',
  'BÜYÜK', 'KÜÇÜK', 'ORTA', 'DARAL', 'GENİŞ', 'YUKSEK', 'ALÇAK', 'DERİN',
  'SIĞ', 'UZUN', 'KISA', 'AĞIR', 'HAFİF', 'SICAK', 'SOĞUK', 'ILIK',
  'TEMİZ', 'KİRLİ', 'YENİ', 'ESKİ', 'GÜZEL', 'ÇİRKİN', 'KOLAY', 'ZOR',
  'AÇIK', 'KAPALI', 'DOĞRU', 'YANLIŞ', 'HAKLI', 'HAKSIZ',
];

// Daily word selection
export const DAILY_WORDS = [
  'KİTAP', 'KALEM', 'SİNEK', 'KÖPEK', 'KEDİ', 'EVLER', 'OKUL', 'ÇİÇEK',
  'GÜNEŞ', 'BULUT', 'DENİZ', 'ORMAN', 'ŞEHİR', 'DÜNYA', 'AYDIN', 'IŞIK',
  'GECE', 'SABAH', 'AKŞAM', 'SAAT',
];

export function normalizeTurkishLetter(letter: string): string {
  const upperLetter = letter.toUpperCase();
  // Handle Turkish dotted/dotless I correctly
  if (upperLetter === 'I') return 'I';
  if (upperLetter === 'İ') return 'İ';
  return upperLetter;
}

export function normalizeTurkishWord(word: string): string {
  return word
    .split('')
    .map((char) => {
      const upper = char.toUpperCase();
      // Handle Turkish I/i correctly
      if (upper === 'I' && char === 'i') return 'İ';
      if (upper === 'I' && char === 'I') return 'I';
      return upper;
    })
    .join('')
    .toLocaleUpperCase('tr-TR');
}

export function getDailyWord(): string {
  const dayIndex = new Date().getDate() % DAILY_WORDS.length;
  return DAILY_WORDS[dayIndex];
}

export function isValidWord(word: string): boolean {
  const normalized = normalizeTurkishWord(word);
  return WORD_LIST.includes(normalized) || DAILY_WORDS.includes(normalized);
}
