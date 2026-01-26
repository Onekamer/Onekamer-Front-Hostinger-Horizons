const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const PROVIDER = import.meta.env.VITE_NOTIFICATIONS_PROVIDER || 'onesignal';

const resolveEndpoint = () => {
  if (!API_BASE_URL) {
    console.warn('Aucune URL API configurée pour l’envoi des notifications.');
    return null;
  }
  if (PROVIDER === 'supabase_light') return `${API_BASE_URL}/notifications/dispatch`;
  return `${API_BASE_URL}/notifications/onesignal`;
};

const normalizeUserIds = (userIds = []) => {
  return Array.from(new Set(userIds.filter(Boolean)));
};

const postNotification = async (payload = {}) => {
  const endpoint = resolveEndpoint();
  if (!endpoint) return false;

  try {
    // Adaptation légère du payload pour le mode natif supabase_light
    const body = (PROVIDER === 'supabase_light')
      ? (() => {
          const { title, message, targetUserIds, data, url } = payload || {};
          if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
            // Pas d'audience explicite: on évite une 400 côté serveur natif
            return null;
          }
          // Normalise l'URL en absolue pour les deep-links (PWA, FCM, APNs)
          const base = (typeof window !== 'undefined' && window.location?.origin) || 'https://onekamer.co';
          let absoluteUrl = '/';
          try {
            absoluteUrl = new URL(url || '/', base).href;
          } catch (_e) {
            absoluteUrl = `${base}/`;
          }
          return {
            title: title || 'Notification',
            message: message || '',
            targetUserIds,
            data: data || {},
            url: absoluteUrl,
          };
        })()
      : payload;

    if (PROVIDER === 'supabase_light' && !body) return false;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Échec de l’appel API OneSignal:', response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Impossible d’envoyer la notification OneSignal:', error);
    return false;
  }
};

export const notifyMentions = async ({ mentionedUserIds = [], authorName, excerpt, postId }) => {
  const targets = normalizeUserIds(mentionedUserIds);
  if (!targets.length) return false;

  const safeExcerpt = (excerpt || '').trim();
  const message = safeExcerpt.length > 120 ? `${safeExcerpt.slice(0, 117)}...` : safeExcerpt;

  return postNotification({
    title: '📣 Nouvelle mention',
    message: `${authorName || 'Un membre'} t’a mentionné${message ? ` : ${message}` : ''}`,
    targetUserIds: targets,
    url: postId ? `/echange?postId=${postId}` : '/echange',
    data: {
      type: 'mention',
      postId,
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
export const notifyPostLiked = async ({ receiverId, actorName, postId }) => {
  const targets = normalizeUserIds([receiverId]);
  if (!targets.length) return false;

  return postNotification({
    title: '❤️ Nouveau like',
    message: `${actorName || 'Un membre'} a aimé votre publication.`,
    targetUserIds: targets,
    url: postId ? `/echange?postId=${postId}` : '/echange',
    data: {
      type: 'like',
      postId,
    },
  });
};

// Échanges: commentaire sur un post
export const notifyPostCommented = async ({ receiverId, actorName, postId }) => {
  const targets = normalizeUserIds([receiverId]);
  if (!targets.length) return false;

  return postNotification({
    title: '💬 Nouveau commentaire',
    message: `${actorName || 'Un membre'} a commenté votre publication.`,
    targetUserIds: targets,
    url: postId ? `/echange?postId=${postId}` : '/echange',
    data: {
      type: 'comment',
      postId,
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

  return postNotification({
    title: '💬 Nouveau message',
    message: `${senderName || 'Un membre'} t’a écrit${preview ? ` : "${preview}"` : ''}.`,
    targetUserIds: targets,
    data: {
      type: 'rencontre_message',
      matchId,
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
  notifyMentionInComment,
};
