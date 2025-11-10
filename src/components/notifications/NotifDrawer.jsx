import React from 'react'
import { Button } from '@/components/ui/button'

function routeForNotification(n) {
  if (n?.deeplink) return n.deeplink
  const t = n?.type
  switch (t) {
    case 'mentions':
      return '/echange'
    case 'annonces':
      return '/annonces'
    case 'evenements':
      return '/evenements'
    case 'systeme':
      return '/aide'
    case 'partenaires':
      return '/faits-divers'
    case 'faits_divers':
      return '/faits-divers'
    case 'groupes':
      return '/groupes'
    case 'rencontre':
      return '/rencontre/profil'
    default:
      return '/'
  }
}

export default function NotifDrawer({ open, setOpen, items, loading, hasMore, fetchMore, markRead, markAllRead, onNavigate }) {
  return (
    <div className={`fixed inset-0 z-[60] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!open}>
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => setOpen(false)}
      />
      {/* Panel */}
      <div className={`absolute right-0 top-0 h-full w-[90%] sm:w-[380px] bg-white shadow-xl transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="text-lg font-semibold">Notifications</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => markAllRead()}>Tout marquer lu</Button>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Fermer</Button>
          </div>
        </div>
        <div className="h-[calc(100%-56px)] overflow-y-auto">
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
                    <Button size="sm" className="bg-[#2BA84A] text-white" onClick={async () => { await markRead(n.id); const to = routeForNotification(n); onNavigate(to) }}>Ouvrir</Button>
                    {!n.is_read && (
                      <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>Marquer lu</Button>
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
    </div>
  )
}
