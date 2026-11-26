export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N} _.'-]*$/u;

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
};

const BANNED_STEMS = [
  "connard",
  "connasse",
  "salope",
  "salaud",
  "putain",
  "encule",
  "batard",
  "couille",
  "niquetamere",
  "tamereenslip",
  "merde",
  "bougnoul",
  "negre",
  "negro",
  "nazi",
  "hitler",
  "pedophile",
  "tapette",
  "gouine",
  "fuck",
  "bitch",
  "cunt",
  "nigger",
  "nigga",
  "whore",
  "slut",
  "asshole",
  "faggot",
  "pussy",
];

const BANNED_WORDS = [
  "bite",
  "pute",
  "putes",
  "nique",
  "niquer",
  "pd",
  "ntm",
  "fdp",
  "tg",
  "con",
  "conne",
  "cul",
  "pedo",
  "shit",
  "dick",
  "cock",
  "fag",
  "kys",
  "bastard",
];

function dedupe(text: string): string {
  return text.replace(/(.)\1+/g, "$1");
}

const DEDUPED_STEMS = BANNED_STEMS.map(dedupe);

export function normalizeNickname(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function isNicknameValid(nickname: string): boolean {
  const length = [...nickname].length;
  return length >= NICKNAME_MIN_LENGTH && length <= NICKNAME_MAX_LENGTH && ALLOWED.test(nickname);
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[0134578@$!]/g, (char) => LEET[char] ?? char);
}

export function isNicknameForbidden(nickname: string): boolean {
  const folded = fold(nickname);
  const letters = folded.replace(/[^a-z]/g, "");
  const compact = dedupe(letters);
  if (DEDUPED_STEMS.some((stem) => compact.includes(stem))) {
    return true;
  }
  const words = folded.split(/[^a-z]+/).filter((word) => word.length > 0);
  const candidates = [...words, ...words.map(dedupe), letters, compact];
  return candidates.some((word) => BANNED_WORDS.includes(word));
}

export function nicknameKey(nickname: string): string {
  return nickname.normalize("NFC").toLocaleLowerCase("fr");
}
