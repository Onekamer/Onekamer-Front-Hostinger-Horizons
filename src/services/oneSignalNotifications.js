const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '')?.replace(/\/$/, '');
const PROVIDER = import.meta.env.VITE_NOTIFICATIONS_PROVIDER || 'supabase_light';

const resolveEndpoint = () => {
  if (!API_BASE_URL) {
    console.warn('Aucune URL API configurée pour l’envoi des notifications.');
    return null;
  }
  return `${API_BASE_URL}/notifications/dispatch`;
};

// Broadcast supabase_light: segment -> utilisateurs -> /notifications/dispatch
const resolveBroadcastEndpoint = () => {
  if (!API_BASE_URL) {
    console.warn('Aucune URL API configurée pour le broadcast des notifications.');
    return null;
  }
  return `${API_BASE_URL}/notifications/broadcast`;
};

const postBroadcast = async (payload = {}) => {
  const endpoint = resolveBroadcastEndpoint();
  if (!endpoint) return false;

  try {
    const { title, message, data, url, segment = 'subscribed_users' } = payload || {};
    const base = (typeof window !== 'undefined' && window.location?.origin) || 'https://onekamer.co';
    let absoluteUrl = '/';
    try {
      absoluteUrl = new URL(url || '/', base).href;
    } catch (_e) {
      absoluteUrl = `${base}/`;
    }

    const body = {
      title: title || 'Notification',
      message: message || '',
      data: data || {},
      url: absoluteUrl,
      segment,
    };

    // premier essai
    let response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const alt = endpoint.replace(/\/notifications\/broadcast$/, '/api/notifications/broadcast');
      response = await fetch(alt, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Échec broadcast notification:', response.status, errorText);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Impossible d’envoyer le broadcast notification:', error);
    return false;
  }
};

const resolveFallbackEndpoint = (endpoint) => {
  if (!endpoint) return null;
  // Bascule entre /notifications/dispatch et /api/notifications/dispatch
  if (/\/api\/notifications\/dispatch$/.test(endpoint)) {
    return endpoint.replace(/\/api\/notifications\/dispatch$/, '/notifications/dispatch');
  }
  return endpoint.replace(/\/notifications\/dispatch$/, '/api/notifications/dispatch');
};

const normalizeUserIds = (userIds = []) => {
  return Array.from(new Set(userIds.filter(Boolean)));
};

const clip = (s, n = 80) => {
  const t = (s || '').trim();
  return t.length > n ? `${t.slice(0, n)}...` : t;
};

const mediaLabel = (mt) => (mt === 'image' ? '🖼️ Image' : (mt === 'video' ? '🎬 Vidéo' : (mt === 'audio' ? '🎧 Fichier audio' : '')));

const postNotification = async (payload = {}) => {
  const endpoint = resolveEndpoint();
  if (!endpoint) return false;

  try {
    const { title, message, targetUserIds, data, url } = payload || {};
    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      return false;
    }
    const base = (typeof window !== 'undefined' && window.location?.origin) || 'https://onekamer.co';
    let absoluteUrl = '/';
    try {
      absoluteUrl = new URL(url || '/', base).href;
    } catch (_e) {
      absoluteUrl = `${base}/`;
    }
    const body = {
      title: title || 'Notification',
      message: message || '',
      targetUserIds,
      data: data || {},
      url: absoluteUrl,
    };

    // Premier essai
    let response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Si échec HTTP → fallback sur l’alias /api/...
    if (!response.ok) {
      const alt = resolveFallbackEndpoint(endpoint);
      if (alt) {
        response = await fetch(alt, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Échec de l’envoi de notification:', response.status, errorText);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Impossible d’envoyer la notification:', error);
    return false;
  }
};

export const notifyMentions = async ({ mentionedUserIds = [], authorName, actorName, excerpt, postId, preview }) => {
  const targets = normalizeUserIds(mentionedUserIds);
  if (!targets.length) return false;

  const name = actorName || authorName || 'Un membre';
  const raw = (excerpt || preview?.text80 || '').trim();
  const mediaType = (preview && preview.mediaType) || null;
  let l3 = '';
  if (mediaType === 'audio') l3 = '🎧 Message audio';
  else if (mediaType === 'video') l3 = '🎬 Message vidéo';
  else if (mediaType === 'image') l3 = '🖼️ Message image';
  else if (raw) {
    const addDots = raw.length > 60;
    l3 = raw.length > 80 ? raw.slice(0, 80) : raw;
    if (addDots && !/\.\.\.$/.test(l3)) l3 = `${l3}...`;
  }

  const isAudio = (preview?.mediaType || '').toLowerCase() === 'audio';
  const url = postId ? (isAudio ? `/echange?audioId=${postId}` : `/echange?postId=${postId}`) : '/echange';
  const data = {
    type: 'mention',
    actorName: name,
    preview: {
      text80: raw ? clip(raw, 80) : '',
      mediaType: preview?.mediaType || null,
      mediaUrl: preview?.mediaUrl || null,
    },
  };
  if (postId) {
    if (isAudio) data.audioId = postId; else data.postId = postId;
  }

  return postNotification({
    title: 'La Place du Kwat',
    message: `${name} vous a mentionné${l3 ? `\n${l3}` : ''}`.trim(),
    targetUserIds: targets,
    url,
    data,
  });
};

export const notifyUserFollow = async ({ receiverId, actorName, followerId }) => {
  const targets = normalizeUserIds([receiverId]);
  if (!targets.length) return false;

  const name = (actorName || 'Un membre').trim();
  const url = followerId ? `/profil/${followerId}` : '/profil';

  return postNotification({
    title: 'La Place du Kwat',
    message: `${name} vous suit et sera notifié lorsque vous publiez un post.`,
    targetUserIds: targets,
    url,
    data: {
      type: 'user_follow',
      followerUserId: followerId || null,
      actorName: name,
    },
  });
};

// Groupes: nouveau message dans un groupe
export const notifyGroupMessage = async ({ recipientIds = [], actorName, groupName, groupId, messageId, excerpt }) => {
  const targets = normalizeUserIds(recipientIds);
  if (!targets.length) return false;

  const name = actorName || 'Un membre';
  const groupLabel = (groupName || 'Espace groupes').trim();
  const safeExcerpt = (excerpt || '').trim();
  const preview = safeExcerpt.length > 120 ? `${safeExcerpt.slice(0, 117)}...` : safeExcerpt;

  const baseUrl = groupId ? `/groupes/${groupId}` : '/groupes';
  const url = messageId ? `${baseUrl}?messageId=${messageId}` : baseUrl;

  // Option B médias pour cross-canaux
  const raw = (preview || safeExcerpt || '').trim();
  let l3 = '';
  if (/\.(png|jpg|jpeg|gif|webp|avif)(\?|$)/i.test(raw)) l3 = '🖼️ Message image';
  else if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(raw)) l3 = '🎬 Message vidéo';
  else if (/\.(webm|ogg|m4a|mp3)(\?|$)/i.test(raw)) l3 = '🎧 Message audio';
  else if (/message image/i.test(raw)) l3 = '🖼️ Message image';
  else if (/message vid[ée]o/i.test(raw)) l3 = '🎬 Message vidéo';
  else if (/message audio/i.test(raw)) l3 = '🎧 Message audio';
  else if (raw) {
    const addDots = raw.length > 60;
    l3 = raw.length > 80 ? raw.slice(0, 80) : raw;
    if (addDots && !/\.\.\.$/.test(l3)) l3 = `${l3}...`;
  }

  return postNotification({
    title: 'Groupes',
    message: `${groupLabel}${name ? `\n${name}${l3 ? ` : "${l3}"` : ''}` : ''}`.trim(),
    targetUserIds: targets,
    url,
    data: {
      type: 'group_message',
      groupId,
      messageId,
      actorName: name,
      preview: { text80: l3 || (preview || '') },
    },
  });
};

export const notifyNewAnnonce = async ({ annonceId, title, authorName, price, categoryName, body }) => {
  const l1 = 'Annonces';
  const l2 = (categoryName || 'Catégorie').trim();
  const l3 = (title || '').trim();
  const raw = (body || '').trim();
  const addDots = raw.length > 60;
  let l4 = raw.length > 80 ? raw.slice(0, 80) : raw;
  if (addDots && !/\.\.\.$/.test(l4)) l4 = `${l4}...`;
  const msg = [l2, l3, l4].filter(Boolean).join('\n');

  return postBroadcast({
    title: l1,
    message: msg,
    url: annonceId ? `/annonces?annonceId=${annonceId}` : '/annonces',
    data: {
      type: 'annonces',
      contentId: annonceId,
      categoryName: l2,
      titleStr: l3,
      body80: l4,
      price: typeof price === 'number' ? price : null,
    },
  });
};

export const notifyNewEvenement = async ({ eventId, title, date, time, location, authorName, categoryName }) => {
  const l1 = 'Evenements';
  const l2 = (categoryName || 'Catégorie').trim();
  const l3 = (title || '').trim();
  const l4 = [location || '', date || '', time || ''].filter(Boolean).join(' · ');
  const msg = [l2, l3, l4].filter(Boolean).join('\n');

  return postBroadcast({
    title: l1,
    message: msg,
    url: eventId ? `/evenements?eventId=${eventId}` : '/evenements',
    data: {
      type: 'evenements',
      contentId: eventId,
      categoryName: l2,
      titleStr: l3,
      details: l4,
    },
  });
};

export const notifyNewPartenaire = async ({ partnerId, name, city, authorName }) => {
  return postNotification({
    title: '🤝 Nouveau partenaire',
    message: `${authorName || 'Un membre'} recommande ${name}${city ? ` à ${city}` : ''}.`,
    targetSegment: 'subscribed_users',
    url: partnerId ? `/partenaires?partnerId=${partnerId}` : '/partenaires',
    data: {
      type: 'partenaire',
      partnerId,
    },
  });
};

export const notifyNewFaitDivers = async ({ articleId, title, authorName, categoryName, excerpt }) => {
  const l1 = 'Faits Divers';
  const l2 = (categoryName || 'Catégorie').trim();
  const l3 = (title || '').trim();
  const raw = (excerpt || '').trim();
  const addDots = raw.length > 60;
  let l4 = raw.length > 80 ? raw.slice(0, 80) : raw;
  if (addDots && !/\.\.\.$/.test(l4)) l4 = `${l4}...`;
  const msg = [l2, l3, l4].filter(Boolean).join('\n');

  return postBroadcast({
    title: l1,
    message: msg,
    url: articleId ? `/faits-divers?articleId=${articleId}` : '/faits-divers',
    data: {
      type: 'faits_divers',
      contentId: articleId,
      categoryName: l2,
      titleStr: l3,
      body80: l4,
    },
  });
};

export const notifyDonationReceived = async ({ receiverId, senderName, amount }) => {
  const targets = normalizeUserIds([receiverId]);
  if (!targets.length) return false;

  return postNotification({
    title: '💚 Nouveau don reçu',
    message: `${senderName || 'Un membre'} t’a envoyé ${amount} OKCoins !`,
    targetUserIds: targets,
    url: '/ok-coins',
    data: {
      type: 'donation',
    },
  });
};

// Échanges: like sur un post
export const notifyPostLiked = async ({ receiverId, actorName, postId, excerpt, preview }) => {
  const targets = normalizeUserIds([receiverId]);
  if (!targets.length) return false;

  const name = actorName || 'Un membre';
  const raw = (excerpt || preview?.text80 || '').trim();
  const mediaType = (preview && preview.mediaType) || null;
  let l3 = '';
  if (mediaType === 'audio') l3 = '🎧 Message audio';
  else if (mediaType === 'video') l3 = '🎬 Message vidéo';
  else if (mediaType === 'image') l3 = '🖼️ Message image';
  else if (raw) {
    const addDots = raw.length > 60;
    l3 = raw.length > 80 ? raw.slice(0, 80) : raw;
    if (addDots && !/\.\.\.$/.test(l3)) l3 = `${l3}...`;
  }

  return postNotification({
    title: 'La Place du Kwat',
    message: `${name} a liké${l3 ? `\n${l3}` : ''}`.trim(),
    targetUserIds: targets,
    url: postId ? `/echange?postId=${postId}` : '/echange',
    data: {
      type: 'like',
      postId,
      actorName: name,
      preview: {
        text80: raw ? clip(raw, 80) : '',
        mediaType: preview?.mediaType || null,
        mediaUrl: preview?.mediaUrl || null,
      },
    },
  });
};

// Échanges: commentaire sur un post
export const notifyPostCommented = async ({ receiverId, actorName, postId, excerpt, commentId, preview }) => {
  const targets = normalizeUserIds([receiverId]);
  if (!targets.length) return false;

  const name = actorName || 'Un membre';
  const raw = (excerpt || preview?.text80 || '').trim();
  const mediaType = (preview && preview.mediaType) || null;
  let l3 = '';
  if (mediaType === 'audio') l3 = '🎧 Message audio';
  else if (mediaType === 'video') l3 = '🎬 Message vidéo';
  else if (mediaType === 'image') l3 = '🖼️ Message image';
  else if (raw) {
    const addDots = raw.length > 60;
    l3 = raw.length > 80 ? raw.slice(0, 80) : raw;
    if (addDots && !/\.\.\.$/.test(l3)) l3 = `${l3}...`;
  }

  return postNotification({
    title: 'La Place du Kwat',
    message: `${name} a commenté${l3 ? `\n${l3}` : ''}`.trim(),
    targetUserIds: targets,
    url: postId ? `/echange?postId=${postId}${commentId ? `&commentId=${commentId}` : ''}` : '/echange',
    data: {
      type: 'comment',
      postId,
      commentId: commentId || null,
      actorName: name,
      preview: {
        text80: raw ? clip(raw, 80) : '',
        mediaType: preview?.mediaType || null,
        mediaUrl: preview?.mediaUrl || null,
      },
    },
  });
};

export const notifyRencontreMatch = async ({ userIds = [], names = [], matchId }) => {
  const targets = normalizeUserIds(userIds);
  if (!targets.length) return false;

  const baseUrl = matchId ? `/rencontre/messages/${matchId}` : '/rencontre/messages';

  // Si on peut aligner userIds et names (même longueur), on envoie un message personnalisé par cible
  if (Array.isArray(userIds) && Array.isArray(names) && userIds.length === names.length && userIds.length >= 2) {
    const results = await Promise.all(userIds.map((uid, i) => {
      const otherIdx = (i + 1) % userIds.length;
      const otherName = (names[otherIdx] || 'Un membre').trim();
      return postNotification({
        title: 'Rencontres',
        message: `Nouveau match avec ${otherName}\nCommencez à discutez dès maintenant !`,
        targetUserIds: [uid],
        url: baseUrl,
        data: {
          type: 'rencontre_match',
          matchId,
        },
      });
    }));
    return results.some(Boolean);
  }

  // Fallback générique (nom indisponible)
  return postNotification({
    title: 'Rencontres',
    message: `Nouveau match\nCommencez à discutez dès maintenant !`,
    targetUserIds: targets,
    url: baseUrl,
    data: {
      type: 'rencontre_match',
      matchId,
    },
  });
};

export const notifyRencontreMessage = async ({ recipientId, senderName, message, matchId, preview }) => {
  const targets = normalizeUserIds([recipientId]);
  if (!targets.length) return false;

  const name = (senderName || 'Un membre').trim();

  // Déterminer L3: label média prioritaire, sinon texte tronqué (80c) + '...' si longueur d'origine > 60
  const raw = (message || '').trim();
  let l3 = '';
  const mediaType = (preview && preview.mediaType) || null;
  if (mediaType === 'audio' || /message audio/i.test(raw)) l3 = '🎧 Message audio';
  else if (mediaType === 'video' || /message vid[ée]o/i.test(raw)) l3 = '🎬 Message vidéo';
  else if (mediaType === 'image' || /message image/i.test(raw)) l3 = '🖼️ Message image';
  else if (/m[ée]dia partag[ée]/i.test(raw)) l3 = 'Média partagé';
  else {
    const addDots = raw.length > 60;
    l3 = raw.length > 80 ? raw.slice(0, 80) : raw;
    if (addDots && !/\.\.\.$/.test(l3)) l3 = `${l3}...`;
    if (!l3) l3 = 'Message';
  }

  return postNotification({
    title: 'Rencontres',
    message: `${name}\n${l3}`,
    targetUserIds: targets,
    url: matchId ? `/rencontre/messages/${matchId}` : '/rencontre/messages',
    data: {
      type: 'rencontre_message',
      matchId,
    },
  });
};

export const notifyRencontreLike = async ({ receiverId, likerUserId, likerName }) => {
  const targets = normalizeUserIds([receiverId]);
  if (!targets.length) return false;

  const name = (likerName || 'Un membre').trim();
  const url = likerUserId ? `/rencontre?rid=${likerUserId}` : '/rencontre';

  return postNotification({
    title: 'Rencontres',
    message: `${name} vous a liké 💚\nCliquez pour regarder son profil`,
    targetUserIds: targets,
    url,
    data: {
      type: 'rencontre_like',
      likerUserId,
    },
  });
};

// Groupes: mention dans un message
export const notifyGroupMention = async ({ mentionedUserIds = [], actorName, groupId, messageExcerpt }) => {
  const targets = normalizeUserIds(mentionedUserIds);
  if (!targets.length) return false;

  const name = (actorName || 'Un membre').trim();
  const raw = (messageExcerpt || '').trim();
  let l3 = '';
  if (/\.(png|jpg|jpeg|gif|webp|avif)(\?|$)/i.test(raw)) l3 = '🖼️ Message image';
  else if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(raw)) l3 = '🎬 Message vidéo';
  else if (/\.(webm|ogg|m4a|mp3)(\?|$)/i.test(raw)) l3 = '🎧 Message audio';
  else if (/message image/i.test(raw)) l3 = '🖼️ Message image';
  else if (/message vid[ée]o/i.test(raw)) l3 = '🎬 Message vidéo';
  else if (/message audio/i.test(raw)) l3 = '🎧 Message audio';
  else if (raw) {
    const addDots = raw.length > 60;
    l3 = raw.length > 80 ? raw.slice(0, 80) : raw;
    if (addDots && !/\.\.\.$/.test(l3)) l3 = `${l3}...`;
  }

  return postNotification({
    title: 'Groupes',
    message: `${name} t’a mentionné${l3 ? `\n${l3}` : ''}`.trim(),
    targetUserIds: targets,
    url: groupId ? `/groupes/${groupId}` : '/groupes',
    data: {
      type: 'group_mention',
      groupId,
      actorName: name,
      preview: { text80: l3 || (raw ? clip(raw, 80) : '') },
    },
  });
};

export const notifyMentionInComment = async ({ mentionedUserIds = [], authorName, articleId }) => {
  const targets = normalizeUserIds(mentionedUserIds);
  if (!targets.length) return false;

  return postNotification({
    title: '💬 Mention en commentaire',
    message: `${authorName || 'Un membre'} t’a mentionné dans un commentaire.`,
    targetUserIds: targets,
    data: {
      type: 'comment_mention',
      articleId,
    },
  });
};

export default {
  notifyMentions,
  notifyNewAnnonce,
  notifyNewEvenement,
  notifyNewPartenaire,
  notifyNewFaitDivers,
  notifyDonationReceived,
  notifyPostLiked,
  notifyPostCommented,
  notifyRencontreMatch,
  notifyRencontreMessage,
  notifyRencontreLike,
  notifyMentionInComment,
  notifyGroupMention,
  notifyGroupMessage,
  notifyUserFollow,
};
