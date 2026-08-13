// Turning the source files' tags into something worth reading.

/** Tags whose correct spelling isn't a capitalisation of the source. */
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

/** One word, capitalised — unless it already carries a capital of its own. */
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
