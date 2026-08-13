import { prettyLabel, prettyLabels } from './labels';

describe('reading a tag as a label', () => {
  test('a lowercase tag is capitalised', () => {
    expect(prettyLabel('manufacturing')).toBe('Manufacturing');
    expect(prettyLabel('early stage')).toBe('Early Stage');
    expect(prettyLabel('machine learning')).toBe('Machine Learning');
  });

  test('acronyms are spelled the way people write them', () => {
    expect(prettyLabel('saas')).toBe('SaaS');
    expect(prettyLabel('ai')).toBe('AI');
  });

  test('the run-together ones are separated', () => {
    expect(prettyLabel('iot internetofthings')).toBe('Internet of Things');
    expect(prettyLabel('3d technology')).toBe('3D Technology');
  });

  test('an acronym inside a longer tag is still spelled properly', () => {
    expect(prettyLabel('mobile saas')).toBe('Mobile SaaS');
  });

  test('a tag already written properly is left alone', () => {
    // The job-type column is written by hand and is already correct; re-casing
    // it would turn right names into wrong ones.
    expect(prettyLabel('CSM & Support')).toBe('CSM & Support');
    expect(prettyLabel('iOS Development')).toBe('iOS Development');
    expect(prettyLabel('Backend development')).toBe('Backend Development');
  });

  test('an ampersand does not become a word to capitalise', () => {
    expect(prettyLabel('autonomous & sensor tech')).toBe('Autonomous & Sensor Tech');
  });

  test('a blank tag stays blank, so the caller can label the gap itself', () => {
    expect(prettyLabel('')).toBe('');
    expect(prettyLabel('   ')).toBe('');
  });

  test('a list comes back in order', () => {
    expect(prettyLabels(['saas', 'fintech'])).toEqual(['SaaS', 'Fintech']);
  });
});
