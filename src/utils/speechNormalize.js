/**
 * Speech-to-text normalization utilities.
 * Converts spoken phrases into structured format for each field.
 * Optimized for Indian accents, phonetic variations, honorifics, and smart defaults.
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

const KNOWN_ACRONYMS = new Set(['DPS', 'KV', 'CBSE', 'ICSE', 'IIT', 'NIT', 'BIT', 'ST', 'JNV', 'IIIT', 'JUET']);

// ─── Phonetic Correction Map for Common STT Misinterpretations ──────────────────
const PHONETIC_CORRECTIONS = [
  [/\bfree\s*ansh\b/gi, 'Priyansh'],
  [/\bpriya\s*ansh\b/gi, 'Priyansh'],
  [/\bpriyan\s*sh\b/gi, 'Priyansh'],
  [/\bgoel\b/gi, 'Goyal'],
  [/\bgoyel\b/gi, 'Goyal'],
  [/\bshubam\b/gi, 'Shubham'],
  [/\baggarwal\b/gi, 'Agarwal'],
  [/\bagrawal\b/gi, 'Agarwal'],
  [/\bchoudary\b/gi, 'Choudhary'],
  [/\bchoudhari\b/gi, 'Choudhary'],
  [/\bchowdhury\b/gi, 'Choudhary'],
  [/\bsing\b/gi, 'Singh'],
  [/\bverma\b/gi, 'Verma'],
  [/\bbarma\b/gi, 'Verma'],
  [/\bguptha\b/gi, 'Gupta'],
  [/\bsarma\b/gi, 'Sharma'],
  [/\btakur\b/gi, 'Thakur'],
  [/\bmisra\b/gi, 'Mishra'],
  [/\bjadav\b/gi, 'Yadav'],
  [/\bjapee\b/gi, 'Jaypee'],
  [/\bragogarh\b/gi, 'Raghogarh'],
  [/\bgoona\b/gi, 'Guna'],
];

function applyPhoneticCorrections(text) {
  let result = text;
  for (const [pattern, replacement] of PHONETIC_CORRECTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

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
 * Normalize spoken Name with Honorific Title Support.
 * Preserves & standardizes titles: Mr., Mrs., Ms., Miss, Shri, Smt., Dr., Prof., Kumari
 * "My name is Mister Priyansh Goyal" → "Mr. Priyansh Goyal"
 * "Shrimati Priya Sharma" → "Smt. Priya Sharma"
 * "Dr Priyansh Goyal" → "Dr. Priyansh Goyal"
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

  // Standardize & preserve honorific titles at the start of name
  let titlePrefix = '';
  const honorificMatch = text.match(/^(mister|mr\.|mr|mrs\.|mrs|ms\.|ms|miss|shrimati|shree|shri|smt\.|smt|doctor|dr\.|dr|professor|prof\.|prof|kumari)\b\s*/i);

  if (honorificMatch) {
    const rawTitle = honorificMatch[1].toLowerCase();
    text = text.slice(honorificMatch[0].length);

    if (rawTitle === 'mr' || rawTitle === 'mr.' || rawTitle === 'mister') titlePrefix = 'Mr.';
    else if (rawTitle === 'mrs' || rawTitle === 'mrs.') titlePrefix = 'Mrs.';
    else if (rawTitle === 'ms' || rawTitle === 'ms.') titlePrefix = 'Ms.';
    else if (rawTitle === 'miss') titlePrefix = 'Miss';
    else if (rawTitle === 'shri' || rawTitle === 'shree') titlePrefix = 'Shri';
    else if (rawTitle === 'smt' || rawTitle === 'smt.' || rawTitle === 'shrimati') titlePrefix = 'Smt.';
    else if (rawTitle === 'dr' || rawTitle === 'dr.' || rawTitle === 'doctor') titlePrefix = 'Dr.';
    else if (rawTitle === 'prof' || rawTitle === 'prof.' || rawTitle === 'professor') titlePrefix = 'Prof.';
    else if (rawTitle === 'kumari') titlePrefix = 'Kumari';
  }

  // Apply phonetic map for common misheard names
  text = applyPhoneticCorrections(text);

  // Remove unwanted punctuation except hyphens/spaces
  text = text.replace(/[^\w\s-]/g, '').trim();

  const formattedName = titleCase(text) || titleCase(transcript);
  return titlePrefix ? `${titlePrefix} ${formattedName}` : formattedName;
}

/**
 * Normalize spoken Email ID.
 * - Spoken full email (e.g. "priyanshgoyal123 at gmail dot com") → "priyanshgoyal123@gmail.com"
 * - Spoken custom domain (e.g. "priyansh 1 2 3 at juetguna dot in") → "priyansh123@juetguna.in"
 * - Spoken partial username (e.g. "priyanshgoyal123") → auto appends "@gmail.com" → "priyanshgoyal123@gmail.com"
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

  // 1. Full spoken email with valid extension (e.g. username@domain.ext)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(email)) {
    return email;
  }

  // 2. Domain spoken without extension (e.g. "priyanshgoyal123@gmail") -> append ".com"
  if (email.includes('@') && !email.includes('.')) {
    email += '.com';
    if (emailRegex.test(email)) return email;
  }

  // 3. Partial username spoken without @ (e.g. "priyanshgoyal123") -> smart auto-append "@gmail.com"
  if (!email.includes('@')) {
    const cleanUsername = email.replace(/[^a-zA-Z0-9._-]/g, '');
    if (cleanUsername.length >= 2) {
      return `${cleanUsername}@gmail.com`;
    }
  }

  return email;
}

/**
 * Normalize spoken phone number into a 10-digit string.
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

  if (!digits || digits.length < 5) {
    return '';
  }

  return digits.slice(0, 10);
}

/**
 * Normalize spoken school name.
 */
export function normalizeSchool(transcript) {
  let text = stripPrefix(transcript.trim(), [
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

  text = applyPhoneticCorrections(text);
  return titleCase(text) || transcript;
}

/**
 * Normalize spoken City.
 */
export function normalizeCity(transcript) {
  let text = stripPrefix(transcript.trim(), [
    /^my city is\s+/i,
    /^my location is\s+/i,
    /^i live in\s+/i,
    /^i am from\s+/i,
    /^i'm from\s+/i,
    /^city is\s+/i,
    /^city\s+/i,
    /^from\s+/i,
  ]);

  text = applyPhoneticCorrections(text);
  return titleCase(text) || transcript;
}
