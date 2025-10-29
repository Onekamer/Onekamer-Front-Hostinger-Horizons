export const extractUniqueMentions = (text = '') => {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const matches = new Set();
  if (!text) return [];

  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    matches.add(match[1]);
  }

  return Array.from(matches);
};

export default extractUniqueMentions;
