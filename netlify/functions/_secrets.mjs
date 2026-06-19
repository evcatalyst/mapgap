const PLACEHOLDER_PATTERNS = [
  /^your[_-]/i,
  /^replace[_-]/i,
  /^changeme$/i,
  /^todo$/i,
  /^<.*>$/,
  /placeholder/i,
  /\.\.\./,
];

export function getConfiguredSecret(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    return "";
  }

  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) {
    return "";
  }

  return value;
}

export function hasConfiguredSecret(name) {
  return Boolean(getConfiguredSecret(name));
}
