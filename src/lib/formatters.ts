export function capitalizeWords(text: string | undefined | null): string {
  if (!text) return '';

  // Remove commas and trim
  const cleaned = text.replace(/,/g, '').trim();

  // Business suffixes that should be all caps
  const allCapsWords = ['LLC', 'LLP', 'PC', 'PA', 'INC', 'CORP', 'LP'];

  return cleaned
    .toLowerCase()
    .split(' ')
    .map(word => {
      const upperWord = word.toUpperCase();
      if (allCapsWords.includes(upperWord)) {
        return upperWord;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Handle different lengths
  if (cleaned.length === 10) {
    // Format as xxx-xxx-xxxx
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // Handle numbers starting with 1 (US country code)
    return `${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length > 10) {
    // For longer numbers, format the last 10 digits
    return `${cleaned.slice(-10, -7)}-${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`;
  }

  // Return original if it doesn't match expected format
  return phone;
}

export function capitalizeAddress(address: string | undefined | null): string {
  if (!address) return '';

  // Remove commas and trim
  let formatted = address.replace(/,/g, '').trim();

  // Expand common abbreviations to full words
  const abbreviationExpansions: Record<string, string> = {
    // Street types - expand abbreviated forms
    '\\bst\\b\\.?': 'Street',
    '\\bave\\b\\.?': 'Avenue',
    '\\brd\\b\\.?': 'Road',
    '\\bdr\\b\\.?': 'Drive',
    '\\bln\\b\\.?': 'Lane',
    '\\bblvd\\b\\.?': 'Boulevard',
    '\\bct\\b\\.?': 'Court',
    '\\bpl\\b\\.?': 'Place',
    '\\bpkwy\\b\\.?': 'Parkway',
    '\\bcir\\b\\.?': 'Circle',
    '\\bter\\b\\.?': 'Terrace',
    '\\btrl\\b\\.?': 'Trail',
    '\\bhwy\\b\\.?': 'Highway',

    // Unit types
    '\\bste\\b\\.?': 'Suite',
    '\\bapt\\b\\.?': 'Apt',
    '\\bunit\\b\\.?': 'Unit',
    '\\bfl\\b\\.?': 'Floor',
    '\\bbldg\\b\\.?': 'Building',

    // Directions
    '\\bn\\b\\.?': 'North',
    '\\bs\\b\\.?': 'South',
    '\\be\\b\\.?': 'East',
    '\\bw\\b\\.?': 'West',
    '\\bne\\b\\.?': 'Northeast',
    '\\bnw\\b\\.?': 'Northwest',
    '\\bse\\b\\.?': 'Southeast',
    '\\bsw\\b\\.?': 'Southwest',
  };

  // Apply expansions (case-insensitive)
  for (const [pattern, replacement] of Object.entries(abbreviationExpansions)) {
    const regex = new RegExp(pattern, 'gi');
    formatted = formatted.replace(regex, replacement);
  }

  // Capitalize each word
  formatted = capitalizeWords(formatted);

  // Uppercase state abbreviations
  const stateAbbreviations = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
  ];

  for (const state of stateAbbreviations) {
    const regex = new RegExp(`\\b${state}\\b`, 'gi');
    formatted = formatted.replace(regex, state);
  }

  return formatted;
}

export function capitalizeState(state: string | undefined | null): string {
  if (!state) return '';
  return state.toUpperCase();
}

export function formatContactData(data: any): any {
  const formatted = { ...data };

  // Preserve name formatting as entered (e.g., LoCascio stays LoCascio)
  // Names are not automatically capitalized

  if (formatted.company) {
    formatted.company = capitalizeWords(formatted.company);
  }

  if (formatted.phone) {
    formatted.phone = formatPhoneNumber(formatted.phone);
  }

  if (formatted.cell_phone) {
    formatted.cell_phone = formatPhoneNumber(formatted.cell_phone);
  }

  // Branch is left as-is since it's a dropdown with specific values (ETA 1, ETA 2, ETA 3)

  if (formatted.address) {
    formatted.address = capitalizeAddress(formatted.address);
  }

  // Preserve name formatting for all name fields
  // (preferred_surveyor, preferred_uw, preferred_closer, client_paralegal_processor, evident_paralegal)
  // Names are not automatically capitalized to preserve custom formatting

  return formatted;
}
