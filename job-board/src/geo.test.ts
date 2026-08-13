import { postcodeOf, clusterCompanies, POSTCODE_PLACES } from './geo';
import { Company } from './types';

const company = (name: string, address: string): Company =>
  ({ name, hqAddress: address, website: `https://${name}.test`, openings: 1 } as Company);

describe('postcodeOf', () => {
  test('finds the postcode in a full address', () => {
    expect(
      postcodeOf('Victoria Street, Carlton, Melbourne, Victoria, 3053, Australia')
    ).toBe('3053');
  });

  test('finds it when it leads the suburb, as half this file does', () => {
    expect(postcodeOf('40, Albert Road, 3205 Melbourne, Australia')).toBe('3205');
  });

  test('ignores a street number that happens to be four digits', () => {
    // 1200 is not a Victorian postcode, so it must not be mistaken for one.
    expect(postcodeOf('1200 Nepean Highway, Melbourne, Australia')).toBeUndefined();
  });

  test('an address with no postcode yields nothing rather than a guess', () => {
    expect(postcodeOf('Melbourne, Australia')).toBeUndefined();
    expect(postcodeOf('')).toBeUndefined();
  });
});

describe('clusterCompanies', () => {
  test('companies in one postcode share a single marker', () => {
    const { clusters } = clusterCompanies([
      company('a', '1 Collins St, 3000 Melbourne'),
      company('b', '2 Collins St, 3000 Melbourne'),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].suburb).toBe('Melbourne CBD');
    expect(clusters[0].companies.map((c) => c.name)).toEqual(['a', 'b']);
  });

  test('busiest areas come first, so they draw on top', () => {
    const { clusters } = clusterCompanies([
      company('solo', '1 Swan St, 3121 Richmond'),
      company('a', '1 Collins St, 3000 Melbourne'),
      company('b', '2 Collins St, 3000 Melbourne'),
    ]);
    expect(clusters[0].postcode).toBe('3000');
  });

  test('a company we cannot place is reported, never silently dropped', () => {
    const { clusters, unplaced } = clusterCompanies([
      company('known', '1 Collins St, 3000 Melbourne'),
      company('nowhere', 'Melbourne, Australia'),
      company('unmapped postcode', '3999 Somewhere'),
    ]);

    expect(clusters).toHaveLength(1);
    expect(unplaced.map((c) => c.name)).toEqual(['nowhere', 'unmapped postcode']);
  });
});

test('every mapped postcode sits inside greater Melbourne', () => {
  // A transposed or mistyped coordinate would put a pin in the ocean; this pins the whole
  // table inside a sane bounding box.
  Object.entries(POSTCODE_PLACES).forEach(([postcode, place]) => {
    expect(place.lat).toBeGreaterThan(-38.5);
    expect(place.lat).toBeLessThan(-37.4);
    expect(place.lng).toBeGreaterThan(144.5);
    expect(place.lng).toBeLessThan(145.5);
    expect(postcode).toMatch(/^3\d{3}$/);
    expect(place.suburb).not.toBe('');
  });
});
