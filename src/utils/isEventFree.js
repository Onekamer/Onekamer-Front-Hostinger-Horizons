export function isEventFree(event) {
  if (!event || typeof event !== 'object') return false;
  const amount = event.price_amount;
  if (typeof amount === 'number') {
    if (amount > 0) return false;
    return true;
  }
  const priceStr = (event.price || event.price_label || '').toString().trim().toLowerCase();
  if (priceStr) {
    if (priceStr.includes('gratuit') || priceStr.includes('free')) return true;
    const zeroLike = /(^|\s)0+([.,]0+)?(\s|$)/.test(priceStr);
    if (zeroLike) return true;
  }
  return false;
}
