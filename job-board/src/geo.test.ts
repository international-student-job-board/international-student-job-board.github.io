import { postcodeOf, clusterCompanies, placeFor, stateOfPostcode, POSTCODE_PLACES } from './geo';
import { Company } from './types';

const company = (name: string, address: string, state = 'Victoria'): Company =>
  ({ name, state, hqAddress: address, website: `https://${name}.test`, openings: 1 } as Company);

describe('postcodeOf', () => {
  test('finds the postcode in a full address', () => {
    expect(
      postcodeOf('Victoria Street, Carlton, Melbourne, Victoria, 3053, Australia')
    ).toBe('3053');
  });

  test('finds it when it leads the suburb, as half this file does', () => {
    expect(postcodeOf('40, Albert Road, 3205 Melbourne, Australia')).toBe('3205');
  });

  test('takes the last code, since an address ends with its postcode', () => {
    // A street number leads an address. While every postcode began with a 3 the
    // first match was safe; nationally 1200 is a real NSW postcode, so position
    // is what separates the two.
    expect(postcodeOf('1200 Nepean Highway, Melbourne VIC 3004')).toBe('3004');
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

  test('a company without a mapped postcode falls back to its capital', () => {
    // Only Melbourne has suburb coordinates in this file, so the rest of the
    // country is placed to its capital rather than dropped off the map.
    const { clusters, unplaced } = clusterCompanies([
      company('known', '1 Collins St, 3000 Melbourne'),
      company('vague', 'Melbourne, Australia'),
      company('interstate', '1 Sussex St, Sydney NSW 2000', 'New South Wales'),
    ]);

    expect(unplaced).toHaveLength(0);
    expect(clusters.map((c) => c.suburb).sort()).toEqual(['Melbourne', 'Melbourne CBD', 'Sydney']);
  });

  test('a company with nothing to place it by is reported, never silently dropped', () => {
    const { clusters, unplaced } = clusterCompanies([
      company('known', '1 Collins St, 3000 Melbourne'),
      company('nowhere', 'somewhere unknowable', ''),
    ]);
    expect(clusters).toHaveLength(1);
    expect(unplaced.map((c) => c.name)).toEqual(['nowhere']);
  });
});

describe('placing an employer nationally', () => {
  test('a mapped Melbourne postcode is placed to its suburb', () => {
    const found = placeFor('1 Collins St, 3000 Melbourne', 'Victoria');
    expect(found).toEqual({ place: POSTCODE_PLACES['3000'], exact: true });
  });

  test('everywhere else lands on its capital, and says it is not exact', () => {
    const found = placeFor('1 Sussex St, Sydney NSW 2000', 'New South Wales');
    expect(found?.place.suburb).toBe('Sydney');
    expect(found?.exact).toBe(false);
  });

  test('a postcode that contradicts the state column is discarded', () => {
    // This is the street-number misread: 1200 reads as a NSW postcode, but the
    // row says Victoria, so the column wins and the pin stays in Melbourne.
    const found = placeFor('1200 Nepean Highway, Melbourne', 'Victoria');
    expect(found?.place.suburb).toBe('Melbourne');
  });

  test('the state column alone is enough', () => {
    expect(placeFor('no postcode here', 'Queensland')?.place.suburb).toBe('Brisbane');
  });

  test('postcode ranges map to their state', () => {
    expect(stateOfPostcode('3000')).toBe('VIC');
    expect(stateOfPostcode('2000')).toBe('NSW');
    expect(stateOfPostcode('4000')).toBe('QLD');
    expect(stateOfPostcode('6000')).toBe('WA');
    expect(stateOfPostcode('0000')).toBeUndefined();
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
