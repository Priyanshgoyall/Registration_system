/**
 * Speech-to-text normalization utilities.
 * Converts spoken phrases into structured format for each field.
 */

// ─── Word → digit mappings ────────────────────────────────────────────────────
const WORD_DIGITS = {
  zero: '0', oh: '0', o: '0',
  one: '1', won: '1',
  two: '2', to: '2', too: '2',
  three: '3',
  four: '4', for: '4', fore: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8', ate: '8',
  nine: '9', nein: '9',
};

const KNOWN_ACRONYMS = new Set(['DPS', 'KV', 'CBSE', 'ICSE', 'IIT', 'NIT', 'BIT', 'ST', 'JNV', 'IIIT']);

function stripPrefix(text, patterns) {
  let result = text.trim();
  for (const pattern of patterns) {
    result = result.replace(pattern, '').trim();
  }
  return result;
}

/**
 * Capitalize words properly.
 */
function titleCase(str) {
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => {
      if (!w) return '';
      const upper = w.toUpperCase();
      if (KNOWN_ACRONYMS.has(upper)) return upper;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Normalize spoken Name.
 * "My name is Mr priyansh goyal" → "Priyansh Goyal"
 * "My name is Mr. Priyansh Goyal" → "Priyansh Goyal"
 */
export function normalizeName(transcript) {
  if (!transcript || typeof transcript !== 'string') return '';

  let text = stripPrefix(transcript.trim(), [
    /^my name is\s+/i,
    /^my name's\s+/i,
    /^i am\s+/i,
    /^i'm\s+/i,
    /^this is\s+/i,
    /^call me\s+/i,
    /^name is\s+/i,
    /^name\s+/i,
  ]);

  // Strip honorific titles (Mr., Mr, Mrs., Mrs, Ms., Ms, Miss, Shri, Smt, Dr., Dr) at the start of name
  text = text.replace(/^(mr\.|mr|mrs\.|mrs|ms\.|ms|miss|shri|smt|dr\.|dr|prof\.|prof)\b\s*/i, '');

  // Remove unwanted punctuation except hyphens/spaces
  text = text.replace(/[^\w\s-]/g, '').trim();

  return titleCase(text) || titleCase(transcript);
}

/**
 * Normalize spoken Email ID.
 * Strictly requires complete username @ domain.tld structure spoken by user.
 * "priyansh 1 2 3 at the rate juetguna dot in" → "priyansh123@juetguna.in"
 * "priyanshgoyal 1 2 3 at the rate gmail dot com" → "priyanshgoyal123@gmail.com"
 * NO AUTO-APPENDING OF DEFAULT DOMAINS.
 */
export function normalizeEmail(transcript) {
  if (!transcript || typeof transcript !== 'string') return '';

  let text = stripPrefix(transcript.trim().toLowerCase(), [
    /^my gmail id is\s+/,
    /^my gmail is\s+/,
    /^my email id is\s+/,
    /^my email is\s+/,
    /^my mail id is\s+/,
    /^my mail is\s+/,
    /^gmail id is\s+/,
    /^gmail is\s+/,
    /^email id is\s+/,
    /^email is\s+/,
    /^mail is\s+/,
    /^gmail\s+/,
    /^email\s+/,
  ]);

  // Replace spoken terms for @ and .
  text = text
    .replace(/at the rate of/g, '@')
    .replace(/at the rate/g, '@')
    .replace(/at rate/g, '@')
    .replace(/\b(at)\b/g, '@')
    .replace(/\bdot\b/g, '.')
    .replace(/\bpoint\b/g, '.')
    .replace(/\bdash\b/g, '-')
    .replace(/\bunderscore\b/g, '_');

  // Convert digit words to numbers (e.g. "one two three" -> "123")
  const words = text.split(/\s+/);
  const processed = words.map((w) => (WORD_DIGITS[w] !== undefined ? WORD_DIGITS[w] : w));
  text = processed.join('');

  // Remove spaces
  let email = text.replace(/\s+/g, '').toLowerCase();

  // Verify against strict email regex (username@domain.ext). No auto-filling domain!
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(email)) {
    return email;
  }

  // Return empty string if domain was not spoken completely
  return '';
}

/**
 * Normalize spoken phone number into a 10-digit string.
 * Strictly extracts digits only; returns empty string if no valid digits found.
 */
export function normalizePhone(transcript) {
  if (!transcript || typeof transcript !== 'string') return '';

  const text = stripPrefix(transcript.toLowerCase(), [
    /^my phone(?: number)? is\s+/,
    /^my number is\s+/,
    /^call me (?:at|on)\s+/,
    /^phone(?: number)? is\s+/,
    /^number is\s+/,
    /^it is\s+/,
    /^it's\s+/,
  ]);

  const words = text
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let digits = '';
  for (const word of words) {
    if (/^\d+$/.test(word)) {
      digits += word;
    } else if (WORD_DIGITS[word] !== undefined) {
      digits += WORD_DIGITS[word];
    }
  }

  digits = digits.replace(/\D/g, '');

  // Strictly return digits only; if no valid digits, return empty string (NEVER return transcript fallback!)
  if (!digits || digits.length < 5) {
    return '';
  }

  return digits.slice(0, 10);
}

/**
 * Normalize spoken school name.
 */
export function normalizeSchool(transcript) {
  const text = stripPrefix(transcript.trim(), [
    /^my school(?: name)? is\s+/i,
    /^i study at\s+/i,
    /^i go to\s+/i,
    /^i am from\s+/i,
    /^i'm from\s+/i,
    /^school is\s+/i,
    /^school name is\s+/i,
    /^school\s+/i,
    /^i am studying at\s+/i,
    /^i'm studying at\s+/i,
  ]);

  return titleCase(text) || transcript;
}

/**
 * Normalize spoken City.
 * "My city is Bhopal" → "Bhopal"
 * "I live in New Delhi" → "New Delhi"
 */
export function normalizeCity(transcript) {
  const text = stripPrefix(transcript.trim(), [
    /^my city is\s+/i,
    /^my location is\s+/i,
    /^i live in\s+/i,
    /^i am from\s+/i,
    /^i'm from\s+/i,
    /^city is\s+/i,
    /^city\s+/i,
    /^from\s+/i,
  ]);

  return titleCase(text) || transcript;
}
