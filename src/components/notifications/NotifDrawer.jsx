import React from 'react'
import { Button } from '@/components/ui/button'

function routeForNotification(n) {
  // 1) Si un deeplink précis est présent, on le privilégie
  if (n?.deeplink && n.deeplink !== '/') return n.deeplink

  if (n?.url && n.url !== '/') {
    try {
      const u = new URL(n.url, window.location.origin)
      if (u.origin === window.location.origin) {
        return `${u.pathname}${u.search}${u.hash}` || '/'
      }
      return u.href
    } catch (_) {
      if (typeof n.url === 'string' && n.url.startsWith('/')) return n.url
    }
  }
  if (n?.data?.deeplink && n.data.deeplink !== '/') return n.data.deeplink
  if (n?.data?.url && n.data.url !== '/') {
    try {
      const u2 = new URL(n.data.url, window.location.origin)
      if (u2.origin === window.location.origin) {
        return `${u2.pathname}${u2.search}${u2.hash}` || '/'
      }
      return u2.href
    } catch (_) {
      if (typeof n.data.url === 'string' && n.data.url.startsWith('/')) return n.data.url
    }
  }

  const t = ((n?.type || (n?.data && n.data.type) || '') + '').toLowerCase()
  const data = n?.data || {}
  const postId = n?.postId || data?.postId || data?.post_id || (((n?.contentType || data?.contentType) === 'post') ? (n?.contentId || data?.contentId) : null)
  const audioId = n?.audioId || data?.audioId || data?.audio_id || (((n?.contentType || data?.contentType) === 'echange' && (n?.isAudio || data?.isAudio)) ? (n?.contentId || data?.contentId) : null)
  const commentId = n?.commentId || n?.replyId || data?.commentId || data?.replyId || data?.comment_id || null

  // 2) Redirections précises Échange (posts / audio / commentaires)
  if (['echange', 'post', 'post_like', 'post_comment', 'comment', 'like', 'mention', 'mentions', 'echange_audio', 'audio_post', 'audio_comment', 'audio_like'].includes(t)) {
    if (postId) {
      return `/echange?postId=${encodeURIComponent(postId)}${commentId ? `&commentId=${encodeURIComponent(commentId)}` : ''}`
    }
    if (audioId) {
      return `/echange?audioId=${encodeURIComponent(audioId)}${commentId ? `&commentId=${encodeURIComponent(commentId)}` : ''}`
    }
    // fallback échange sans id
    return '/echange'
  }

  if (/(market|commande|order)/.test(t)) {
    const orderId = n?.orderId || data?.orderId || data?.order_id || (/(order|commande)/.test(t) ? (n?.contentId || data?.id) : null)
    if (orderId) return `/market/orders/${encodeURIComponent(orderId)}`
    return '/market/orders'
  }
  if (/(review|avis)/.test(t)) {
    return '/marketplace/ma-boutique'
  }
  if (/(group|groupe)/.test(t) || t === 'group_message' || t === 'groupes_message') {
    const groupId = n?.groupId || n?.group_id || data?.groupId || data?.group_id || n?.contentId
    const messageId = n?.messageId || data?.messageId || data?.id
    if (groupId) {
      const qp = messageId ? `?messageId=${encodeURIComponent(messageId)}` : ''
      return `/groupes/${encodeURIComponent(groupId)}${qp}`
    }
    return '/groupes'
  }

  switch (t) {
    case 'annonce':
    case 'annonces':
      if (n?.contentId) return `/annonces?annonceId=${n.contentId}`
      return '/annonces'
    case 'evenement':
    case 'evenements':
      if (n?.contentId) return `/evenements?eventId=${n.contentId}`
      return '/evenements'
    case 'systeme':
      return '/aide'
    case 'partenaire':
    case 'partenaires':
      if (n?.contentId) return `/partenaires?partnerId=${n.contentId}`
      return '/partenaires'
    case 'fait_divers':
    case 'faits_divers':
      if (n?.contentId) return `/faits-divers?articleId=${n.contentId}`
      return '/faits-divers'
    case 'groupes':
      return '/groupes'
    case 'rencontre':
      return '/rencontre/profil'
    case 'rencontre_match':
    case 'rencontre_message':
      {
        const matchId = n?.matchId || data?.matchId || n?.contentId
        if (matchId) return `/rencontre/messages/${encodeURIComponent(matchId)}`
        return '/rencontre/messages'
      }
    case 'rencontre_like':
      {
        const likerUserId = n?.likerUserId || data?.likerUserId
        if (likerUserId) return `/rencontre?rid=${encodeURIComponent(likerUserId)}`
        return '/rencontre'
      }
    case 'donation':
      return '/ok-coins'
    default:
      return '/'
  }
}

export default function NotifDrawer({ open, setOpen, items, loading, hasMore, fetchMore, markRead, markAllRead, onNavigate }) {
  if (!open) return null

  const clip = (s, n = 80) => {
    const t = (s || '').trim()
    return t.length > n ? `${t.slice(0, n)}...` : t
  }

  const formatGroup = (n) => {
    const data = n?.data || {}
    const t = ((n?.type || data.type || '') + '').toLowerCase()
    const isGroup = /(group|groupe)/.test(t) || t === 'group_message' || t === 'groupes_message' || t === 'group_mention'
    if (!isGroup) return null

    const pv = data?.preview || {}
    let groupName = data.groupName || data.group || n?.groupName || n?.group || ''
    if (!groupName && typeof n?.body === 'string') {
      const firstLine = (n.body.split('\n')[0] || '').trim()
      if (firstLine) groupName = firstLine
    }
    groupName = (groupName || 'Espace Groupes').trim()

    let actor = (data?.actorName || n?.actorName || '').trim()
    if (!actor) {
      if (t === 'group_message' || t === 'groupes_message') {
        actor = (n?.title || 'Un membre').trim()
      } else if (t === 'group_mention') {
        if (typeof n?.body === 'string' && n.body) {
          const m = n.body
          const re = /(.*?)(?:\s+t[’']a mentionn\u00e9|\s+vous a mentionn\u00e9)/i
          const match = m.match(re)
          if (match && match[1]) {
            actor = match[1].trim()
          }
        }
        if (!actor) actor = 'Un membre'
      } else {
        actor = (n?.title || 'Un membre').trim()
      }
    }

    let text = pv?.text80 || ''
    if (!text && typeof n?.body === 'string') {
      const lines = n.body.split('\n')
      if (lines.length > 1) {
        text = lines.slice(1).join(' ').trim()
      }
    }

    const mediaType = pv?.mediaType || data?.mediaType || null
    const mediaUrl = pv?.mediaUrl || data?.mediaUrl || null
    if (mediaType) {
      const mediaLabel = mediaType === 'image' ? '🖼️ Fichier image'
        : mediaType === 'video' ? '🎬 Fichier vidéo'
        : mediaType === 'audio' ? '🎧 Fichier audio'
        : ''
      if (!text) {
        text = mediaLabel
      } else if (mediaLabel) {
        text = `${text} — ${mediaLabel}`
      }
    }
    text = clip(text, 80)

    let thumb = null
    if (mediaType === 'image' && typeof mediaUrl === 'string' && mediaUrl) {
      thumb = { kind: 'img', url: mediaUrl }
    } else if (mediaType === 'video') {
      thumb = { kind: 'emoji', ch: '🎬' }
    } else if (mediaType === 'audio') {
      thumb = { kind: 'emoji', ch: '🎧' }
    }

    return {
      l1: 'Groupes',
      l2: groupName,
      l3: actor,
      l4: text,
      thumb,
    }
  }

  const formatEchange = (n) => {
    const data = n?.data || {}
    const t = ((n?.type || data.type || '') + '').toLowerCase()
    const isEchange = ['like', 'comment', 'mention', 'post', 'echange', 'echange_audio', 'audio_post', 'audio_like', 'audio_comment'].includes(t)
    if (!isEchange) return null
    const actor = data?.actorName || n?.actorName || 'Un membre'
    let action = 'a liké'
    if (t.includes('comment')) action = 'a commenté'
    if (t.includes('mention')) action = 'vous a mentionné'
    const pv = data?.preview || {}
    const mediaType = pv?.mediaType || null
    const mediaUrl = pv?.mediaUrl || null
    let text = pv?.text80 || ''
    if (!text && typeof n?.body === 'string') {
      const firstLine = n.body.split('\n')[0] || ''
      text = clip(firstLine, 80)
    }
    if (!text && mediaType) {
      if (mediaType === 'image') text = '🖼️ Image'
      else if (mediaType === 'video') text = '🎬 Vidéo'
      else if (mediaType === 'audio') text = '🎧 Fichier audio'
    }
    let thumb = null
    if (mediaType === 'image' && typeof mediaUrl === 'string' && mediaUrl) {
      thumb = { kind: 'img', url: mediaUrl }
    } else if (mediaType === 'video') {
      thumb = { kind: 'emoji', ch: '🎬' }
    } else if (mediaType === 'audio') {
      thumb = { kind: 'emoji', ch: '🎧' }
    }
    return {
      l1: 'La Place du Kwat',
      l2: `${actor} ${action}`,
      l3: text,
      thumb,
    }
  }

  const formatRencontre = (n) => {
    const data = n?.data || {}
    const t = ((n?.type || data.type || '') + '').toLowerCase()
    const isRencontre = ['rencontre_match', 'rencontre_message', 'rencontre_like'].includes(t)
    if (!isRencontre) return null

    const l1 = 'Rencontres'

    if (t === 'rencontre_match') {
      const body = (n?.body || '').trim()
      const firstLine = (body.split('\n')[0] || '').trim()
      const beforeComma = (firstLine.split(',')[0] || '').trim()
      let name = ''
      if (beforeComma) {
        const parts = beforeComma.split('&').map(s => (s || '').trim()).filter(Boolean)
        if (parts.length >= 2) name = parts[1]
        else if (parts.length === 1) name = parts[0]
      }
      if (!name) name = 'Un membre'
      return {
        l1,
        l2: `Nouveau match avec ${name}`,
        l3: 'Commencez à discutez dès maintenant !',
      }
    }

    if (t === 'rencontre_message') {
      const body = (n?.body || '').trim()
      const lines = body.split('\n')
      let sender = ''
      if (lines.length >= 2) {
        const line2 = (lines[1] || '').trim()
        const idx = line2.indexOf(' : ')
        sender = (idx >= 0 ? line2.slice(0, idx) : line2).trim()
      }
      if (!sender) sender = 'Match'

      const mediaTypeData = (data?.preview && data.preview.mediaType) || data?.mediaType || null
      let preview = ''
      if (mediaTypeData === 'audio') preview = 'Message audio'
      else if (mediaTypeData === 'video') preview = 'Message vidéo'
      else if (mediaTypeData === 'image') preview = 'Message image'
      else if (lines.length >= 2) {
        const line2 = (lines[1] || '').trim()
        if (/message audio/i.test(line2)) preview = 'Message audio'
        else if (/message vid[ée]o/i.test(line2)) preview = 'Message vidéo'
        else if (/message image/i.test(line2)) preview = 'Message image'
        else {
          const m = line2.match(/:\s*"(.+?)"/)
          if (m && m[1]) preview = m[1]
          else if (/m[ée]dia partag[ée]/i.test(line2)) preview = 'Média partagé'
        }
      }
      if (preview) {
        const addDots = preview.length > 60 && !/\.\.\.$/.test(preview)
        if (preview.length > 80) preview = preview.slice(0, 80)
        if (addDots) preview = `${preview}...`
      } else {
        preview = 'Message'
      }

      return {
        l1,
        l2: sender,
        l3: preview,
      }
    }

    if (t === 'rencontre_like') {
      const body = (n?.body || '').trim()
      const firstLine = (body.split('\n')[0] || '').trim()
      let name = firstLine.startsWith('🧡') ? firstLine.slice(2).trim() : firstLine
      if (!name) name = 'Un membre'
      return {
        l1,
        l2: `${name} vous a liké 💚`,
        l3: 'Cliquez pour regarder son profil',
      }
    }

    return null
  }

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
          {items && items.map((n) => {
            const fmt = formatGroup(n) || formatEchange(n) || formatRencontre(n)
            return (
              <li key={n.id} className="p-4 flex items-start gap-3">
                <div className={`${n.is_read ? 'bg-gray-300' : 'bg-[#2BA84A]'} mt-1 h-2 w-2 rounded-full`} />
                <div className="flex-1 min-w-0">
                  {fmt ? (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-gray-900">{fmt.l1}</div>
                        <div className="text-sm font-bold text-gray-900">{fmt.l2}</div>
                        {fmt.l3 ? (
                          <div className="text-xs text-gray-600">{fmt.l3}</div>
                        ) : null}
                        {fmt.l4 ? (
                          <div className="text-xs text-gray-600 line-clamp-2">{fmt.l4}</div>
                        ) : null}
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
                      {fmt.thumb ? (
                        fmt.thumb.kind === 'img' ? (
                          <img src={fmt.thumb.url} alt="" className="ml-2 h-10 w-10 rounded object-cover" />
                        ) : (
                          <div className="ml-2 h-10 w-10 rounded bg-gray-100 flex items-center justify-center text-lg">{fmt.thumb.ch}</div>
                        )
                      ) : null}
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </li>
            )
          })}
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
