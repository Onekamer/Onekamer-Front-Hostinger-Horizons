export const extractUniqueMentions = (text = '') => {
  // Autorise les pseudos avec espaces: '@' au début ou précédé d'un espace, puis jusqu'à 30 caractères (hors '@' et saut de ligne)
  const mentionRegex = /(?:^|\s)@([^@\n]{1,30})/g;
  const matches = new Set();
  if (!text) return [];

  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    matches.add(match[1]);
  }

  return Array.from(matches);
};

export default extractUniqueMentions;
