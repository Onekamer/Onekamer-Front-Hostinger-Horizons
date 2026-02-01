const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '')?.replace(/\/$/, '');
const PROVIDER = import.meta.env.VITE_NOTIFICATIONS_PROVIDER || 'supabase_light';

const resolveEndpoint = () => {
  if (!API_BASE_URL) {
    console.warn('Aucune URL API configurée pour l’envoi des notifications.');
    return null;
  }
  return `${API_BASE_URL}/notifications/dispatch`;
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

    // Si le serveur répond "ignored" ou échec → fallback sur l’alias /api/...
    let ignored = false;
    try {
      const maybeJson = await response.clone().json();
      ignored = !!maybeJson?.ignored;
    } catch (_e) {}

    if (!response.ok || ignored) {
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
  const text80 = clip((preview?.text80 || excerpt || ''));
  const l3 = text80 || mediaLabel(preview?.mediaType);

  const isAudio = (preview?.mediaType || '').toLowerCase() === 'audio';
  const url = postId ? (isAudio ? `/echange?audioId=${postId}` : `/echange?postId=${postId}`) : '/echange';
  const data = {
    type: 'mention',
    actorName: name,
    preview: {
      text80,
      mediaType: preview?.mediaType || null,
      mediaUrl: preview?.mediaUrl || null,
    },
  };
  if (postId) {
    if (isAudio) data.audioId = postId; else data.postId = postId;
  }

  return postNotification({
    title: 'Echange communautaire',
    message: `${name} vous a mentionné${l3 ? ` — ${l3}` : ''}`.trim(),
    targetUserIds: targets,
    url,
    data,
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

  return postNotification({
    title: name,
    message: preview ? `${groupLabel}\n${preview}` : groupLabel,
    targetUserIds: targets,
    url,
    data: {
      type: 'group_message',
      groupId,
      messageId,
    },
  });
};

export const notifyNewAnnonce = async ({ annonceId, title, authorName, price }) => {
  return postNotification({
    title: '🛍️ Nouvelle annonce',
    message: `${authorName || 'Un membre'} vient de publier "${title}"${price ? ` à ${price}` : ''}.`,
    targetSegment: 'subscribed_users',
    url: annonceId ? `/annonces?annonceId=${annonceId}` : '/annonces',
    data: {
      type: 'annonce',
      annonceId,
    },
  });
};

export const notifyNewEvenement = async ({ eventId, title, date, authorName }) => {
  return postNotification({
    title: '🎉 Nouvel événement',
    message: `${authorName || 'Un membre'} organise ${title}${date ? ` le ${date}` : ''}.`,
    targetSegment: 'subscribed_users',
    url: eventId ? `/evenements?eventId=${eventId}` : '/evenements',
    data: {
      type: 'evenement',
      eventId,
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

export const notifyNewFaitDivers = async ({ articleId, title, authorName }) => {
  return postNotification({
    title: '📰 Nouveau fait divers',
    message: `${authorName || 'Un membre'} a publié "${title}".`,
    targetSegment: 'subscribed_users',
    url: articleId ? `/faits-divers?articleId=${articleId}` : '/faits-divers',
    data: {
      type: 'fait_divers',
      articleId,
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
  const text80 = clip((preview?.text80 || excerpt || ''));
  const l3 = text80 || mediaLabel(preview?.mediaType);

  return postNotification({
    title: 'Echange communautaire',
    message: `${name} a liké${l3 ? ` — ${l3}` : ''}`.trim(),
    targetUserIds: targets,
    url: postId ? `/echange?postId=${postId}` : '/echange',
    data: {
      type: 'like',
      postId,
      actorName: name,
      preview: {
        text80,
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
  const text80 = clip((preview?.text80 || excerpt || ''));
  const l3 = text80 || mediaLabel(preview?.mediaType);

  return postNotification({
    title: 'Echange communautaire',
    message: `${name} a commenté${l3 ? ` — ${l3}` : ''}`.trim(),
    targetUserIds: targets,
    url: postId ? `/echange?postId=${postId}${commentId ? `&commentId=${commentId}` : ''}` : '/echange',
    data: {
      type: 'comment',
      postId,
      commentId: commentId || null,
      actorName: name,
      preview: {
        text80,
        mediaType: preview?.mediaType || null,
        mediaUrl: preview?.mediaUrl || null,
      },
    },
  });
};

export const notifyRencontreMatch = async ({ userIds = [], names = [], matchId }) => {
  const targets = normalizeUserIds(userIds);
  if (!targets.length) return false;

  const label = names.filter(Boolean).join(' & ');

  return postNotification({
    title: '💞 Nouveau match',
    message: label ? `${label}, vous avez matché !` : 'Vous avez un nouveau match 🎉',
    targetUserIds: targets,
    url: matchId ? `/rencontre/messages/${matchId}` : '/rencontre/messages',
    data: {
      type: 'rencontre_match',
      matchId,
    },
  });
};

export const notifyRencontreMessage = async ({ recipientId, senderName, message, matchId }) => {
  const targets = normalizeUserIds([recipientId]);
  if (!targets.length) return false;

  const safeMessage = (message || '').trim();
  const preview = safeMessage.length > 80 ? `${safeMessage.slice(0, 77)}...` : safeMessage;
  const name = (senderName || 'Un membre').trim();
  const body = `Espace Rencontres -\n${name}${preview ? ` : "${preview}"` : ''}`;

  return postNotification({
    title: '💬 Nouveau message',
    message: body,
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
    title: 'Espace Rencontres',
    message: `🧡 ${name}\nvous a liké`,
    targetUserIds: targets,
    url,
    data: {
      type: 'rencontre_like',
      likerUserId,
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
  notifyGroupMessage,
};
