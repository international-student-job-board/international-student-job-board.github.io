// Enumerated pick-lists used by the local admin: job level, type, arrangement,
// education level, skills and skills-assessing authority.
//
// Fetched at start-up rather than imported. The admin appends to this file
// through the dev server, and while it lived in src/ every write changed a
// module webpack was watching — so adding one skill rebuilt the bundle and
// reloaded the page, emptying the half-filled form that had just added it.
// Nothing imports it now, so a write is invisible to the compiler.
//
// It is loaded once before the app renders, which keeps every caller below
// synchronous.

export type ConstantKey =
  | 'jobLevel'
  | 'type'
  | 'arrangement'
  | 'educationLevel'
  | 'assessment'
  | 'skills';

const EMPTY: Record<ConstantKey, string[]> = {
  jobLevel: [],
  type: [],
  arrangement: [],
  educationLevel: [],
  assessment: [],
  skills: [],
};

let CONSTANTS: Record<ConstantKey, string[]> = EMPTY;

export async function loadConstants(): Promise<void> {
  const res = await fetch(`${process.env.PUBLIC_URL || ''}/data/constants.json`);
  if (!res.ok) throw new Error(`Could not load constants (${res.status})`);
  CONSTANTS = { ...EMPTY, ...(await res.json()) };
}

/** Replaces the lists in place, for the admin after it appends to one. */
export function setConstants(next: Record<ConstantKey, string[]>): void {
  CONSTANTS = { ...EMPTY, ...next };
}

// A fresh (cloned) copy so callers can hold it as editable React state.
export function getConstants(): Record<ConstantKey, string[]> {
  return {
    jobLevel: [...CONSTANTS.jobLevel],
    type: [...CONSTANTS.type],
    arrangement: [...CONSTANTS.arrangement],
    educationLevel: [...CONSTANTS.educationLevel],
    assessment: [...CONSTANTS.assessment],
    skills: [...CONSTANTS.skills],
  };
}

export function getConstant(key: ConstantKey): string[] {
  return [...(CONSTANTS[key] ?? [])];
}

// jobs.json field key → its constant list key.
export const FIELD_CONSTANT: Record<string, ConstantKey> = {
  job_level: 'jobLevel',
  type: 'type',
  arrangement: 'arrangement',
  education_level: 'educationLevel',
  skill_assessment: 'assessment',
};
