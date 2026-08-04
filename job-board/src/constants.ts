// Enumerated pick-lists shared by the Post-a-job form and the local admin:
// job level, type, arrangement, education level and skills-assessing authority.
// The local admin can append new values (written to src/data/constants.json by
// the dev server); the public form just picks from what's here.
import data from './data/constants.json';

export type ConstantKey =
  | 'jobLevel'
  | 'type'
  | 'arrangement'
  | 'educationLevel'
  | 'assessment'
  | 'skills';

const CONSTANTS = data as Record<ConstantKey, string[]>;

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
