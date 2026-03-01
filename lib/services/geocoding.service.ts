/**
 * Geocoding Service
 *
 * Professional wrapper around Google Maps Geocoding API
 * Handles forward geocoding, reverse geocoding, and Places API integration
 */

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.warn('⚠️ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set');
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  street: string;
  city: string;
  zip: string;
  state?: string;
  country?: string;
}

export interface ReverseGeocodingResult {
  street: string;
  city: string;
  zip: string;
  state?: string;
  country?: string;
  formattedAddress: string;
}

export interface PlaceDetails {
  placeId: string;
  formattedAddress: string;
  street: string;
  city: string;
  zip: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract address components from Google's address_components array
 */
function parseAddressComponents(components: AddressComponent[]) {
  let street = '';
  let city = '';
  let zip = '';
  let state = '';
  let country = '';

  components.forEach((component) => {
    const types = component.types;

    // Street number
    if (types.includes('street_number')) {
      street = component.long_name;
    }

    // Route (street name)
    if (types.includes('route')) {
      street = street ? `${street} ${component.long_name}` : component.long_name;
    }

    // City
    if (types.includes('locality')) {
      city = component.long_name;
    }
    // Fallback for city
    if (!city && types.includes('sublocality_level_1')) {
      city = component.long_name;
    }
    if (!city && types.includes('administrative_area_level_2')) {
      city = component.long_name;
    }

    // ZIP code
    if (types.includes('postal_code')) {
      zip = component.long_name;
    }

    // State
    if (types.includes('administrative_area_level_1')) {
      state = component.short_name;
    }

    // Country
    if (types.includes('country')) {
      country = component.short_name;
    }
  });

  return {
    street: street.trim(),
    city: city.trim(),
    zip: zip.trim(),
    state: state.trim(),
    country: country.trim(),
  };
}

// ============================================================================
// FORWARD GEOCODING
// ============================================================================

/**
 * Convert address to coordinates
 *
 * @example
 * const result = await geocodeAddress('123 Main St', 'Portland', '97201');
 * // { latitude: 45.5234, longitude: -122.6762, ... }
 */
export async function geocodeAddress(
  street: string,
  city: string,
  zip: string
): Promise<GeocodingResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('Google Maps API key not configured');
    return null;
  }

  if (!street || !city || !zip) {
    return null;
  }

  const address = `${street}, ${city}, ${zip}`;

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${GOOGLE_MAPS_API_KEY}`
    );

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results[0]) {
      const result = data.results[0];
      const { lat, lng } = result.geometry.location;
      const parsed = parseAddressComponents(result.address_components);

      return {
        latitude: lat,
        longitude: lng,
        formattedAddress: result.formatted_address,
        street: parsed.street || street,
        city: parsed.city || city,
        zip: parsed.zip || zip,
        state: parsed.state,
        country: parsed.country,
      };
    }

    if (data.status === 'ZERO_RESULTS') {
      console.warn('Geocoding: No results found for', address);
      return null;
    }

    console.error('Geocoding error:', data.status, data.error_message);
    return null;
  } catch (error) {
    console.error('Geocoding fetch error:', error);
    return null;
  }
}

// ============================================================================
// GOOGLE MAPS REVERSE GEOCODING (DEPRECATED - KEPT FOR ROLLBACK)
// ============================================================================
// Replaced by hereReverseGeocode() - see HERE MAPS REVERSE GEOCODING section
//
// /**
//  * Convert coordinates to address
//  *
//  * @example
//  * const result = await reverseGeocode(45.5234, -122.6762);
//  * // { street: '123 Main St', city: 'Portland', zip: '97201', ... }
//  */
// export async function reverseGeocode(
//   latitude: number,
//   longitude: number
// ): Promise<ReverseGeocodingResult | null> {
//   if (!GOOGLE_MAPS_API_KEY) {
//     console.error('Google Maps API key not configured');
//     return null;
//   }
//
//   if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
//     return null;
//   }
//
//   try {
//     const response = await fetch(
//       `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
//     );
//
//     const data = await response.json();
//
//     if (data.status === 'OK' && data.results && data.results[0]) {
//       const result = data.results[0];
//       const parsed = parseAddressComponents(result.address_components);
//
//       return {
//         street: parsed.street,
//         city: parsed.city,
//         zip: parsed.zip,
//         state: parsed.state,
//         country: parsed.country,
//         formattedAddress: result.formatted_address,
//       };
//     }
//
//     if (data.status === 'ZERO_RESULTS') {
//       console.warn('Reverse geocoding: No results found for', latitude, longitude);
//       return null;
//     }
//
//     console.error('Reverse geocoding error:', data.status, data.error_message);
//     return null;
//   } catch (error) {
//     console.error('Reverse geocoding fetch error:', error);
//     return null;
//   }
// }

// ============================================================================
// PLACES API
// ============================================================================

/**
 * Get detailed information about a place from Place ID
 * (from Google Places Autocomplete selection)
 *
 * @example
 * const details = await getPlaceDetails('ChIJN1t_tDeuEmsRUsoyG83frY4');
 * // { street: '123 Main St', city: 'Portland', latitude: 45.5234, ... }
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('Google Maps API key not configured');
    return null;
  }

  if (!placeId) {
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components,formatted_address,geometry&key=${GOOGLE_MAPS_API_KEY}`
    );

    const data = await response.json();

    if (data.status === 'OK' && data.result) {
      const place = data.result;
      const parsed = parseAddressComponents(place.address_components);
      const { lat, lng } = place.geometry.location;

      return {
        placeId,
        formattedAddress: place.formatted_address,
        street: parsed.street,
        city: parsed.city,
        zip: parsed.zip,
        state: parsed.state,
        country: parsed.country,
        latitude: lat,
        longitude: lng,
      };
    }

    console.error('Place details error:', data.status, data.error_message);
    return null;
  } catch (error) {
    console.error('Place details fetch error:', error);
    return null;
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Geocode multiple addresses in parallel (with rate limiting)
 *
 * @example
 * const results = await batchGeocode([
 *   { street: '123 Main St', city: 'Portland', zip: '97201' },
 *   { street: '456 Oak Ave', city: 'Seattle', zip: '98101' }
 * ]);
 */
export async function batchGeocode(
  addresses: Array<{ street: string; city: string; zip: string }>
): Promise<Array<GeocodingResult | null>> {
  // Batch with delay to respect rate limits
  const results: Array<GeocodingResult | null> = [];

  for (let i = 0; i < addresses.length; i++) {
    const { street, city, zip } = addresses[i];
    const result = await geocodeAddress(street, city, zip);
    results.push(result);

    // Add small delay between requests (10 requests/second limit)
    if (i < addresses.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Reverse geocode multiple coordinates in parallel (with rate limiting)
 * Now uses HERE Maps reverse geocoding
 */
export async function batchReverseGeocode(
  coordinates: Array<{ latitude: number; longitude: number }>
): Promise<Array<ReverseGeocodingResult | null>> {
  const results: Array<ReverseGeocodingResult | null> = [];

  for (let i = 0; i < coordinates.length; i++) {
    const { latitude, longitude } = coordinates[i];
    const result = await hereReverseGeocode(latitude, longitude);
    results.push(result);

    // Add small delay between requests
    if (i < coordinates.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

// ============================================================================
// HERE MAPS AUTOCOMPLETE (NEW)
// ============================================================================

const HERE_API_KEY = process.env.NEXT_PUBLIC_HERE_API_KEY;

if (!HERE_API_KEY) {
  console.warn('⚠️ NEXT_PUBLIC_HERE_API_KEY is not set');
}

/**
 * HERE Maps autosuggest suggestion item
 */
export interface HereSuggestion {
  id: string;
  title: string;
  resultType: string;
  address?: {
    label: string;
  };
}

/**
 * HERE Maps place details (from lookup endpoint)
 */
export interface HerePlaceDetails {
  street: string;
  city: string;
  zip: string;
  state?: string;
  country?: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

/**
 * Get autocomplete suggestions from HERE Maps
 *
 * @example
 * const suggestions = await hereAutosuggest('123 Main', { lat: 37.7749, lng: -122.4194 });
 * // Returns array of suggestions with id, title, address
 */
export async function hereAutosuggest(
  query: string,
  userLocation?: { lat: number; lng: number },
  limit: number = 5
): Promise<HereSuggestion[]> {
  if (!HERE_API_KEY) {
    console.error('🚨 HERE MAPS SERVICE: API key not configured!');
    return [];
  }

  if (!query || query.length < 3) {
    return [];
  }

  console.log('🌍 HERE MAPS SERVICE: Calling autosuggest API...');
  console.log('   Query:', query);
  console.log('   Limit:', limit);

  try {
    // Use provided location or default to US center (Kansas City, MO)
    const location = userLocation || { lat: 39.0997, lng: -94.5786 };

    const params = new URLSearchParams({
      q: query,
      at: `${location.lat},${location.lng}`, // Required: location context
      limit: limit.toString(),
      lang: 'en',
      apiKey: HERE_API_KEY,
    });

    console.log('   Location:', location);

    const url = `https://autosuggest.search.hereapi.com/v1/autosuggest?${params.toString()}`;
    console.log('   API URL:', url.replace(HERE_API_KEY, 'API_KEY_HIDDEN'));

    const response = await fetch(url);

    console.log('   Response status:', response.status, response.statusText);

    if (!response.ok) {
      // Get the error details from HERE API
      const errorText = await response.text();
      console.error('❌ HERE MAPS SERVICE: Autosuggest error:', response.status, response.statusText);
      console.error('   Error details:', errorText);
      return [];
    }

    const data = await response.json();

    if (data.items && Array.isArray(data.items)) {
      console.log('✅ HERE MAPS SERVICE: Got', data.items.length, 'suggestions');
      return data.items.map((item: any) => ({
        id: item.id,
        title: item.title,
        resultType: item.resultType,
        address: item.address,
      }));
    }

    console.warn('⚠️ HERE MAPS SERVICE: No items in response');
    return [];
  } catch (error) {
    console.error('❌ HERE MAPS SERVICE: Fetch error:', error);
    return [];
  }
}

/**
 * Get full place details from HERE Maps by ID
 *
 * @example
 * const details = await hereLookup('here:pds:place:...');
 * // Returns { street, city, zip, latitude, longitude, ... }
 */
export async function hereLookup(hereId: string): Promise<HerePlaceDetails | null> {
  if (!HERE_API_KEY) {
    console.error('🚨 HERE MAPS SERVICE: API key not configured!');
    return null;
  }

  if (!hereId) {
    console.warn('⚠️ HERE MAPS SERVICE: No place ID provided');
    return null;
  }

  console.log('🔍 HERE MAPS SERVICE: Looking up place details...');
  console.log('   Place ID:', hereId);

  try {
    const params = new URLSearchParams({
      id: hereId,
      apiKey: HERE_API_KEY,
    });

    const url = `https://lookup.search.hereapi.com/v1/lookup?${params.toString()}`;
    console.log('   API URL:', url.replace(HERE_API_KEY, 'API_KEY_HIDDEN'));

    const response = await fetch(url);

    console.log('   Response status:', response.status, response.statusText);

    if (!response.ok) {
      // Get the error details from HERE API
      const errorText = await response.text();
      console.error('❌ HERE MAPS SERVICE: Lookup error:', response.status, response.statusText);
      console.error('   Error details:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('   Response data:', data);

    if (data && data.address && data.position) {
      // Parse address components from HERE response
      const address = data.address;

      // Extract street (combine street number and street name if available)
      let street = '';
      if (address.houseNumber && address.street) {
        street = `${address.houseNumber} ${address.street}`;
      } else if (address.street) {
        street = address.street;
      }

      const result = {
        street: street.trim(),
        city: address.city || '',
        zip: address.postalCode || '',
        state: address.stateCode || address.state || '',
        country: address.countryCode || address.countryName || '',
        latitude: data.position.lat,
        longitude: data.position.lng,
        formattedAddress: address.label || '',
      };

      console.log('✅ HERE MAPS SERVICE: Place details retrieved successfully');
      console.log('   Street:', result.street);
      console.log('   City:', result.city);
      console.log('   ZIP:', result.zip);
      console.log('   Coordinates:', result.latitude, result.longitude);

      return result;
    }

    console.warn('⚠️ HERE MAPS SERVICE: Invalid response format');
    return null;
  } catch (error) {
    console.error('❌ HERE MAPS SERVICE: Fetch error:', error);
    return null;
  }
}

// ============================================================================
// HERE MAPS REVERSE GEOCODING
// ============================================================================

/**
 * Reverse geocode coordinates to address using HERE Maps
 *
 * @example
 * const result = await hereReverseGeocode(37.7749, -122.4194);
 * // Returns: { street: '..', city: 'San Francisco', zip: '94102', ... }
 */
export async function hereReverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodingResult | null> {
  if (!HERE_API_KEY) {
    console.error('🚨 HERE MAPS SERVICE: API key not configured!');
    return null;
  }

  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    console.warn('⚠️ HERE MAPS SERVICE: Invalid coordinates provided');
    return null;
  }

  console.log('🔄 HERE MAPS SERVICE: Calling revgeocode API...');
  console.log('   Coordinates:', latitude, longitude);

  try {
    const params = new URLSearchParams({
      at: `${latitude},${longitude}`,
      lang: 'en',
      limit: '1',
      apiKey: HERE_API_KEY,
    });

    const url = `https://revgeocode.search.hereapi.com/v1/revgeocode?${params.toString()}`;
    console.log('   API URL:', url.replace(HERE_API_KEY, 'API_KEY_HIDDEN'));

    const response = await fetch(url);

    console.log('   Response status:', response.status, response.statusText);

    if (!response.ok) {
      // Get the error details from HERE API
      const errorText = await response.text();
      console.error('❌ HERE MAPS SERVICE: Revgeocode error:', response.status, response.statusText);
      console.error('   Error details:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('   Response data:', data);

    if (data && data.items && data.items.length > 0) {
      const item = data.items[0];
      const address = item.address;

      // Parse address components from HERE response
      let street = '';
      if (address.houseNumber && address.street) {
        street = `${address.houseNumber} ${address.street}`;
      } else if (address.street) {
        street = address.street;
      }

      const result = {
        street: street.trim(),
        city: address.city || '',
        zip: address.postalCode || '',
        state: address.stateCode || address.state || '',
        country: address.countryCode || address.countryName || '',
        formattedAddress: address.label || '',
      };

      console.log('✅ HERE MAPS SERVICE: Reverse geocoding successful');
      console.log('   Street:', result.street);
      console.log('   City:', result.city);
      console.log('   ZIP:', result.zip);

      return result;
    }

    console.warn('⚠️ HERE MAPS SERVICE: No results found for coordinates');
    return null;
  } catch (error) {
    console.error('❌ HERE MAPS SERVICE: Fetch error:', error);
    return null;
  }
}
