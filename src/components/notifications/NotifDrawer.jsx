import React from 'react'
import { Button } from '@/components/ui/button'

function routeForNotification(n) {
  // 1) Si un deeplink précis est présent, on le privilégie
  if (n?.deeplink && n.deeplink !== '/') return n.deeplink

  const t = (n?.type || '').toLowerCase()
  const postId = n?.postId || (n?.contentType === 'post' ? n?.contentId : null)
  const audioId = n?.audioId || (n?.contentType === 'echange' && n?.isAudio ? n?.contentId : null)
  const commentId = n?.commentId || n?.replyId || null

  // 2) Redirections précises Échange (posts / audio / commentaires)
  if (['echange', 'post', 'post_like', 'post_comment', 'comment', 'mentions', 'echange_audio', 'audio_post', 'audio_comment'].includes(t)) {
    if (postId) {
      return `/echange?postId=${encodeURIComponent(postId)}${commentId ? `&commentId=${encodeURIComponent(commentId)}` : ''}`
    }
    if (audioId) {
      return `/echange?audioId=${encodeURIComponent(audioId)}${commentId ? `&commentId=${encodeURIComponent(commentId)}` : ''}`
    }
    // fallback échange sans id
    return '/echange'
  }

  switch (t) {
    case 'annonce':
    case 'annonces':
      if (n?.contentId) return `/annonces?annonceId=${n.contentId}`
      return '/annonces'
    case 'evenement':
    case 'evenements':
      return '/evenements'
    case 'systeme':
      return '/aide'
    case 'partenaire':
    case 'partenaires':
      return '/partenaires'
    case 'fait_divers':
    case 'faits_divers':
      return '/faits-divers'
    case 'groupes':
      return '/groupes'
    case 'rencontre':
      return '/rencontre/profil'
    case 'rencontre_match':
    case 'rencontre_message':
      return '/rencontre/messages'
    case 'donation':
      return '/ok-coins'
    default:
      return '/'
  }
}

export default function NotifDrawer({ open, setOpen, items, loading, hasMore, fetchMore, markRead, markAllRead, onNavigate }) {
  if (!open) return null

  return (
    <div className="fixed top-16 top-safe-16 right-0 z-[60] w-full sm:w-[380px] bg-white shadow-xl border-l border-gray-200">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="text-lg font-semibold">Notifications</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => markAllRead()}>Tout marquer lu</Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Fermer</Button>
        </div>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        <ul className="divide-y">
          {items && items.length === 0 && (
            <li className="p-4 text-sm text-gray-500">Aucune notification.</li>
          )}
          {items && items.map((n) => (
            <li key={n.id} className="p-4 flex items-start gap-3">
              <div className={`mt-1 h-2 w-2 rounded-full ${n.is_read ? 'bg-gray-300' : 'bg-[#2BA84A]'}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${n.is_read ? 'font-normal text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title || 'Notification'}</div>
                {n.body && <div className="text-xs text-gray-600 line-clamp-2">{n.body}</div>}
                <div className="mt-1 text-[11px] text-gray-400">{new Date(n.created_at).toLocaleString('fr-FR')}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-[#2BA84A] text-white"
                    onClick={async () => {
                      await markRead(n.id)
                      const to = routeForNotification(n)
                      onNavigate(to)
                    }}
                  >
                    Ouvrir
                  </Button>
                  {!n.is_read && (
                    <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>
                      Marquer lu
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="p-4">
          {hasMore && (
            <Button className="w-full bg-[#2BA84A] text-white" disabled={loading} onClick={fetchMore}>
              {loading ? 'Chargement…' : 'Charger plus'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
