// Turning the source files' tags into something worth reading.
//
// Both CSVs arrive lowercased and abbreviated — "saas", "early stage",
// "iot internetofthings" — which is fine as data and poor as a list of options
// to scan. Refactoring UI's chapter on personality makes the point that the
// words in an interface carry as much of its character as the visuals do; a
// filter full of "saas" reads as a database dump rather than as a product.
//
// The raw value stays the filter's value throughout — only the label changes —
// so nothing here can affect which roles match.

/**
 * Tags whose correct spelling isn't a capitalisation of the source.
 *
 * Acronyms mostly, plus the few the source ran together. Anything not listed
 * falls through to the general rule below, so this stays short rather than
 * trying to enumerate every tag in the files.
 */
const OVERRIDES: Record<string, string> = {
  saas: 'SaaS',
  paas: 'PaaS',
  iaas: 'IaaS',
  ai: 'AI',
  ar: 'AR',
  vr: 'VR',
  iot: 'IoT',
  'iot internetofthings': 'Internet of Things',
  nlp: 'NLP',
  b2b: 'B2B',
  b2c: 'B2C',
  hr: 'HR',
  it: 'IT',
  api: 'API',
  '3d technology': '3D Technology',
  '3d printing': '3D Printing',
  ecommerce: 'eCommerce',
  'marketplace & ecommerce': 'Marketplace & eCommerce',
  devops: 'DevOps',
  ios: 'iOS',
};

/**
 * One word, capitalised — unless it already carries a capital of its own.
 *
 * That exception is what keeps "CSM & Support", "DevOps" and "iOS Development"
 * intact: the job-type column is already written properly, and re-casing it
 * would turn correct names into wrong ones.
 */
const capitalise = (word: string) =>
  /[A-Z]/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1);

/** A tag as it should be read: "saas" -> "SaaS", "early stage" -> "Early Stage". */
export function prettyLabel(value: string): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';

  const override = OVERRIDES[raw.toLowerCase()];
  if (override) return override;

  return raw
    .split(/\s+/)
    .map((word) => OVERRIDES[word.toLowerCase()] ?? capitalise(word))
    .join(' ');
}

/** The same, for a list of tags. */
export const prettyLabels = (values: string[]): string[] => values.map(prettyLabel);
