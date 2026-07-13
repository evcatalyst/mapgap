/**
 * OpenFreeMap's Liberty style is a real OpenStreetMap-derived vector basemap.
 * It does not require an account, API key, access token, or provider secret.
 * Runtime map resources stay on the single origin allow-listed in netlify.toml.
 */
export const TOKEN_FREE_MAP_STYLE_ID = "mapgap-openfreemap-liberty";
export const TOKEN_FREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const TOKEN_FREE_MAP_ORIGIN = "https://tiles.openfreemap.org";

export const TOKEN_FREE_MAP_STYLE = {
  id: TOKEN_FREE_MAP_STYLE_ID,
  label: "OpenFreeMap Liberty",
  url: TOKEN_FREE_MAP_STYLE_URL,
  icon: "",
  layerGroups: [],
  custom: true,
};

export const TOKEN_FREE_MAP_STYLES = [TOKEN_FREE_MAP_STYLE];

export function isTokenFreeMapStyle(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();
  const credentialKey = /["'](?:access[_-]?token|api[_-]?key|token|key|secret|auth|authorization|signature|sig|x-amz-[^"']+)["']\s*:/;
  const credentialQuery = /[?&](?:access[_-]?token|api[_-]?key|token|key|secret|auth|authorization|signature|sig|x-amz-[^=&#]+)=/;
  const urlUserInfo = /https?:\/\/[^/"'\s@]+@/;
  return !/mapbox/.test(serialized) && !credentialKey.test(serialized) && !credentialQuery.test(serialized) && !urlUserInfo.test(serialized);
}
