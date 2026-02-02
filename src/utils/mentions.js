export const extractUniqueMentions = (text = '') => {
  // Détection sûre: '@' au début ou précédé d'un espace, puis [a-z0-9._-] (max ~30)
  const mentionRegex = /(?:^|\s)@([A-Za-z0-9][A-Za-z0-9._-]{0,30})/g;
  const matches = new Set();
  if (!text) return [];

  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    matches.add(match[1]);
  }

  return Array.from(matches);
};

export default extractUniqueMentions;
