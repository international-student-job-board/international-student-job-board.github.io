import { FilterSelect, SelectOption } from './FilterSelect';
import { NOT_SPECIFIED } from '../format';
import { RATING_NOTE } from '../references';

/** `minRating` sentinel: show only employers we couldn't match on Glassdoor. */
export const RATING_UNSPECIFIED = -1;

/** The minimum-rating rungs offered, out of 5. */
export const RATING_RUNGS = [3, 3.5, 4, 4.5];

/** The option values the filter can hold, as strings — the rungs plus "not rated". */
export const RATING_VALUES = [
  ...RATING_RUNGS.map(String),
  String(RATING_UNSPECIFIED),
];

interface Props {
  /** 0 = any, -1 = only unrated, otherwise the minimum rating. */
  value: number;
  onChange: (next: number) => void;
  /** Result counts per option value, same as the other filters carry. */
  counts?: Map<string, number>;
  /** Float the panel (inside the scrolling modal). */
  overlay?: boolean;
}

/**
 * "Employer rating" — a single-choice filter: a minimum star rating, or the
 * employers with no Glassdoor match at all. Each choice shows how many results
 * it would leave, like every other filter.
 */
export function RatingFilter({ value, onChange, counts, overlay }: Props) {
  const options: SelectOption[] = [
    ...RATING_RUNGS.map((rung) => ({
      value: String(rung),
      label: `${rung.toFixed(1)} and up`,
      count: counts?.get(String(rung)) ?? 0,
    })),
    {
      value: String(RATING_UNSPECIFIED),
      label: NOT_SPECIFIED,
      count: counts?.get(String(RATING_UNSPECIFIED)) ?? 0,
    },
  ];

  return (
    <FilterSelect
      label="Employer rating"
      multiple={false}
      searchable={false}
      overlay={overlay}
      tooltip={RATING_NOTE}
      options={options}
      selected={value !== 0 ? [String(value)] : []}
      onChange={(next) => onChange(Number(next[0] ?? 0))}
    />
  );
}

/** The chip label for a set rating filter. */
export const ratingChipLabel = (value: number) =>
  value === RATING_UNSPECIFIED ? NOT_SPECIFIED : `${value.toFixed(1)} and up`;
