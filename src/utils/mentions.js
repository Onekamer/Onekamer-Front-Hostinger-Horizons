export const extractUniqueMentions = (text = '') => {
  // Autorise espaces, underscore, point et tiret dans les pseudos
  const mentionRegex = /@([A-Za-z0-9][A-Za-z0-9 _.-]{0,30})/g;
  const matches = new Set();
  if (!text) return [];

  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    matches.add(match[1].trim());
  }

  return Array.from(matches);
};

export default extractUniqueMentions;
