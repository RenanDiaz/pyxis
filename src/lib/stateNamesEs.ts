/**
 * Mapping of US state names to their Spanish equivalents.
 * Only includes states where the Spanish name differs from English.
 */
export const STATE_NAMES_ES: Record<string, string> = {
  'California': 'California',
  'Colorado': 'Colorado',
  'Connecticut': 'Connecticut',
  'Delaware': 'Delaware',
  'Florida': 'Florida',
  'Georgia': 'Georgia',
  'Hawaii': 'Hawái',
  'Idaho': 'Idaho',
  'Illinois': 'Illinois',
  'Indiana': 'Indiana',
  'Iowa': 'Iowa',
  'Kansas': 'Kansas',
  'Louisiana': 'Luisiana',
  'Maine': 'Maine',
  'Maryland': 'Maryland',
  'Michigan': 'Míchigan',
  'Minnesota': 'Minnesota',
  'Mississippi': 'Misisipi',
  'Missouri': 'Misuri',
  'Montana': 'Montana',
  'Nebraska': 'Nebraska',
  'Nevada': 'Nevada',
  'New Hampshire': 'Nueva Hampshire',
  'New Jersey': 'Nueva Jersey',
  'New Mexico': 'Nuevo México',
  'New York': 'Nueva York',
  'North Carolina': 'Carolina del Norte',
  'North Dakota': 'Dakota del Norte',
  'Ohio': 'Ohio',
  'Oklahoma': 'Oklahoma',
  'Oregon': 'Oregón',
  'Pennsylvania': 'Pensilvania',
  'Rhode Island': 'Rhode Island',
  'South Carolina': 'Carolina del Sur',
  'South Dakota': 'Dakota del Sur',
  'Tennessee': 'Tennessee',
  'Texas': 'Texas',
  'Utah': 'Utah',
  'Vermont': 'Vermont',
  'Virginia': 'Virginia',
  'Washington': 'Washington',
  'West Virginia': 'Virginia Occidental',
  'Wisconsin': 'Wisconsin',
  'Wyoming': 'Wyoming',
  'Alabama': 'Alabama',
  'Alaska': 'Alaska',
  'Arizona': 'Arizona',
  'Arkansas': 'Arkansas',
  'Kentucky': 'Kentucky',
  'Massachusetts': 'Massachusetts',
}

export function getSpanishName(englishName: string): string | null {
  const es = STATE_NAMES_ES[englishName]
  if (!es || es === englishName) return null
  return es
}
