const BUNNY_HOST_CORRECTIONS = {
  // Remap uniquement l'ancien domaine vers l'actuel
  "cdn.onekamer.co": "onekamer-media-cdn.b-cdn.net",
};

const collapseDuplicateSlashes = (value) => {
  if (!value) {
    return value;
  }

  const [protocolPart, rest] = value.split('://');
  if (rest === undefined) {
    return value.replace(/\/{2,}/g, '/');
  }

  return `${protocolPart}://${rest.replace(/\/{2,}/g, '/')}`;
};

const looksLikeDomain = (value) => /[^\/]+\.[^\/]+/.test(value);

export const normalizeMediaUrl = (rawUrl) => {
  if (!rawUrl) {
    return rawUrl;
  }

  let url = typeof rawUrl === "string" ? rawUrl.trim() : String(rawUrl);
  if (!url) {
    return url;
  }

  const hasProtocol = /^https?:\/\//i.test(url);
  const cleaned = url.replace(/^\/+/, '');

  if (!hasProtocol && !looksLikeDomain(cleaned)) {
    return collapseDuplicateSlashes(cleaned);
  }

  const candidate = hasProtocol
    ? url
    : `https://${cleaned}`;

  try {
    const parsed = new URL(candidate);
    const correctedHost = BUNNY_HOST_CORRECTIONS[parsed.hostname] || parsed.hostname;
    parsed.hostname = correctedHost;
    parsed.protocol = 'https:';
    parsed.pathname = collapseDuplicateSlashes(parsed.pathname);
    return parsed.toString();
  } catch (error) {
    let corrected = candidate
      .replace(
        'cdn.onekamer.co',
        BUNNY_HOST_CORRECTIONS['cdn.onekamer.co'] ||
          'onekamer-media-cdn.b-cdn.net'
      );
    return collapseDuplicateSlashes(corrected);
  }
};

export const normalizeMediaArray = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeMediaUrl(value))
    .filter((value) => typeof value === 'string' && value.length > 0);
};
