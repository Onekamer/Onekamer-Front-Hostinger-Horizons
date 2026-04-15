export function isEventFree(event) {
  if (!event || typeof event !== 'object') return false;
  const amount = event.price_amount;
  if (typeof amount === 'number') {
    if (amount > 0) return false;
    return true;
  }
  const raw = (event.price || event.price_label || '').toString();
  const priceStr = raw.trim().toLowerCase();
  if (priceStr) {
    if (priceStr.includes('gratuit') || priceStr.includes('free')) return true;
    const cleaned = raw
      .toString()
      .replace(/[\s\u00A0\u202F]/g, '') // espaces, NBSP, espaces fines
      .replace(/[^0-9.,-]/g, '') // retire lettres/devise
      .replace(',', '.');
    if (cleaned) {
      const parts = cleaned.split('.');
      const normalized = parts.length > 2 ? (parts.slice(0, -1).join('') + '.' + parts[parts.length - 1]) : cleaned;
      const n = parseFloat(normalized);
      if (Number.isFinite(n)) {
        if (n === 0) return true;
        if (n > 0) return false;
      }
    }
  }
  return false;
}
