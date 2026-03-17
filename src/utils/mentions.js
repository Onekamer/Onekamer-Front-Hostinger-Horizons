export const extractUniqueMentions = (text = '') => {
  // '@' précédé d'un séparateur (début ou non-mot, pas un autre '@'), et suivi d'une borne (fin, espace, ponctuation)
  const mentionRegex = /(?:^|[^\w@])@([A-Za-z0-9À-ÖØ-öø-ÿ'’._-]{1,30})(?=$|[^A-Za-z0-9À-ÖØ-öø-ÿ'’._-])/g;
  const matches = new Set();
  if (!text) return [];

  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    matches.add(match[1]);
  }

  return Array.from(matches);
};

export default extractUniqueMentions;
