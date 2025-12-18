export const MARKETPLACE_CART_KEY = 'ok_marketplace_cart_v1';

export const readMarketplaceCart = () => {
  try {
    const raw = window.localStorage.getItem(MARKETPLACE_CART_KEY);
    if (!raw) return { partnerId: null, items: [] };
    const parsed = JSON.parse(raw);
    const partnerId = parsed?.partnerId ? String(parsed.partnerId) : null;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return {
      partnerId,
      items: items
        .map((it) => ({
          itemId: it?.itemId ? String(it.itemId) : null,
          title: it?.title ? String(it.title) : '',
          description: it?.description ? String(it.description) : '',
          base_price_amount: Number(it?.base_price_amount ?? 0),
          quantity: Math.max(parseInt(it?.quantity, 10) || 1, 1),
        }))
        .filter((it) => it.itemId),
    };
  } catch {
    return { partnerId: null, items: [] };
  }
};

export const writeMarketplaceCart = (cart) => {
  try {
    window.localStorage.setItem(MARKETPLACE_CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event('ok_marketplace_cart_updated'));
  } catch {
    // ignore
  }
};

export const clearMarketplaceCart = () => {
  try {
    window.localStorage.removeItem(MARKETPLACE_CART_KEY);
    window.dispatchEvent(new Event('ok_marketplace_cart_updated'));
  } catch {
    // ignore
  }
};

export const getMarketplaceCartCount = (cart) => {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  return items.reduce((sum, it) => sum + (parseInt(it?.quantity, 10) || 0), 0);
};

export const addToMarketplaceCart = ({ cart, partnerId, item }) => {
  const pid = partnerId ? String(partnerId) : null;
  const next = readMarketplaceCart();

  if (cart && typeof cart === 'object') {
    next.partnerId = cart.partnerId ? String(cart.partnerId) : null;
    next.items = Array.isArray(cart.items) ? cart.items : [];
  }

  if (!pid) return next;

  if (next.partnerId && next.partnerId !== pid) {
    return { conflict: true, cart: next };
  }

  const itemId = item?.id ? String(item.id) : null;
  if (!itemId) return next;

  next.partnerId = pid;

  const idx = next.items.findIndex((x) => String(x.itemId) === itemId);
  if (idx >= 0) {
    next.items[idx] = { ...next.items[idx], quantity: next.items[idx].quantity + 1 };
  } else {
    next.items.push({
      itemId,
      title: item?.title ? String(item.title) : '',
      description: item?.description ? String(item.description) : '',
      base_price_amount: Number(item?.base_price_amount ?? 0),
      quantity: 1,
    });
  }

  writeMarketplaceCart(next);
  return { conflict: false, cart: next };
};

export const updateMarketplaceCartQuantity = ({ cart, itemId, quantity }) => {
  const next = cart && typeof cart === 'object' ? { ...cart } : readMarketplaceCart();
  const id = itemId ? String(itemId) : null;
  if (!id) return next;

  const q = Math.max(parseInt(quantity, 10) || 1, 1);
  next.items = (Array.isArray(next.items) ? next.items : []).map((it) =>
    String(it.itemId) === id ? { ...it, quantity: q } : it
  );

  writeMarketplaceCart(next);
  return next;
};

export const removeMarketplaceCartItem = ({ cart, itemId }) => {
  const next = cart && typeof cart === 'object' ? { ...cart } : readMarketplaceCart();
  const id = itemId ? String(itemId) : null;
  if (!id) return next;

  next.items = (Array.isArray(next.items) ? next.items : []).filter((it) => String(it.itemId) !== id);
  if (next.items.length === 0) next.partnerId = null;

  writeMarketplaceCart(next);
  return next;
};
