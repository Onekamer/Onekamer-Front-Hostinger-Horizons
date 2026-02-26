import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useNavigate } from 'react-router-dom'
import { Megaphone, Users, Store, Coins } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases'
import { useAuth } from '@/contexts/SupabaseAuthContext'

const Landing = () => {
  const navigate = useNavigate()
  const { session } = useAuth()
  const isIOS = Capacitor.getPlatform() === 'ios'
  const [vipIosPrice, setVipIosPrice] = useState(null)
  const [iapVipReady, setIapVipReady] = useState(false)
  const [iapVipChecked, setIapVipChecked] = useState(false)

  useEffect(() => {
    let mounted = true
    const preload = async () => {
      try {
        if (!isIOS) { if (mounted) setIapVipChecked(true); return }
        const hasFn = typeof NativePurchases?.getProducts === 'function'
        if (!hasFn) { if (mounted) setIapVipChecked(true); return }
        const res = await NativePurchases.getProducts({
          productIdentifiers: ['onekamer_vip_monthly', 'co.onekamer.vip.monthly'],
          productType: PURCHASE_TYPE.SUBS,
        })
        const list = Array.isArray(res?.products) ? res.products : (Array.isArray(res) ? res : [])
        const getId = (p) => String(p?.productId || p?.productIdentifier || p?.identifier || p?.id || p?.sku || '').trim()
        const wanted = new Set(['onekamer_vip_monthly', 'co.onekamer.vip.monthly'])
        const hasAny = Array.isArray(list) && list.length > 0
        const foundItem = (list || []).find((p) => wanted.has(getId(p)))
        const pickPrice = (p) => {
          if (!p) return null
          const s = p.localizedPrice || p.priceString || p.price_formatted || p.priceFormatted || p.formattedPrice
          if (s) return String(s)
          const val = Number(p.price)
          const cur = p.currency || p.currencyCode
          if (Number.isFinite(val) && cur) {
            try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: String(cur) }).format(val) } catch {}
            return `${val} ${cur}`
          }
          return null
        }
        const priceLabel = pickPrice(foundItem) || pickPrice(list?.[0])
        if (mounted) { setIapVipReady(hasAny || !!foundItem); setIapVipChecked(true); setVipIosPrice(priceLabel || null) }
      } catch (_) {
        if (mounted) setIapVipChecked(true)
      }
    }
    preload()
    return () => { mounted = false }
  }, [isIOS])

  return (
    <div className="min-h-screen bg-white text-black">
      <Helmet>
        <title>OneKamer.co – Le premier repère de la communauté camerounaise</title>
        <meta name="description" content="Rejoignez OneKamer, la plateforme où actualités, rencontres, événements et opportunités se rencontrent." />
        <meta property="og:title" content="OneKamer.co – Le premier repère de la communauté camerounaise" />
        <meta property="og:description" content="Actualités, rencontres, événements et opportunités de la diaspora camerounaise." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://onekamer.co" />
      </Helmet>

      {/* Hero */}
      <section className="pt-24 bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-black">
            OneKamer.co, le premier repère de la communauté camerounaise
          </h1>
          <p className="mt-4 text-lg md:text-xl text-gray-700">
            Rejoignez la plateforme où actualités, rencontres, événements et opportunités se rencontrent.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button onClick={() => navigate('/auth')} className="w-full sm:w-auto px-6 py-3 rounded-md bg-[#2BA84A] text-white font-semibold hover:bg-[#24903f]">
              Créer un compte
            </button>
            <a href="#decouvrir" className="w-full sm:w-auto px-6 py-3 rounded-md border border-black text-black font-semibold hover:bg-gray-50 text-center">
              Découvrir OneKamer
            </a>
          </div>
        </div>
        </div>
      </section>

      {/* Bloc 2 – Pourquoi OneKamer */}
      <section id="decouvrir" className="bg-gradient-to-b from-[#e0f3e9] to-[#bfe6cd] py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-black">Pourquoi OneKamer ?</h2>
          <p className="mt-2 text-center text-gray-700">Découvrez nos principales fonctionnalités</p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200 transition-transform duration-200 hover:shadow-md hover:scale-[1.02] text-center">
              <div className="h-10 w-10 rounded-md bg-[#2BA84A]/10 text-[#2BA84A] flex items-center justify-center mx-auto">
                <Megaphone className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">Annonces & Événements</h3>
              <p className="mt-2 text-sm text-gray-700">Publiez et découvrez des opportunités, activités et rencontres autour de vous.</p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200 transition-transform duration-200 hover:shadow-md hover:scale-[1.02] text-center">
              <div className="h-10 w-10 rounded-md bg-[#2BA84A]/10 text-[#2BA84A] flex items-center justify-center mx-auto">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">Rencontres & Groupes</h3>
              <p className="mt-2 text-sm text-gray-700">Échangez, créez des groupes et rencontrez des membres partageant vos centres d’intérêt.</p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200 transition-transform duration-200 hover:shadow-md hover:scale-[1.02] text-center">
              <div className="h-10 w-10 rounded-md bg-[#2BA84A]/10 text-[#2BA84A] flex items-center justify-center mx-auto">
                <Store className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">Partenaires & Réseau local</h3>
              <p className="mt-2 text-sm text-gray-700">Trouvez des partenaires, services et recommandations utiles à l’étranger.</p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200 transition-transform duration-200 hover:shadow-md hover:scale-[1.02] text-center">
              <div className="h-10 w-10 rounded-md bg-[#2BA84A]/10 text-[#2BA84A] flex items-center justify-center mx-auto">
                <Coins className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">OK Coins</h3>
              <p className="mt-2 text-sm text-gray-700">Soutenez des créateurs, envoyez et recevez des dons, participez aux campagnes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bloc 3 – Nos forfaits (aligné sur la page Forfaits) */}
      <section className="bg-gray-50 pt-14 pb-10 md:pt-20 md:pb-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-black">Nos Forfaits</h2>
          <p className="mt-2 text-center text-gray-600">Accédez à plus de fonctionnalités et soutenez la communauté.</p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Gratuit */}
            <div className="relative rounded-xl border border-gray-200 bg-white p-6 flex flex-col h-full shadow-sm">
              <h3 className="text-lg font-semibold">Gratuit</h3>
              <p className="text-sm italic text-gray-600 mt-1">Découvrez les bases de la communauté OneKamer.</p>
              <div className="mt-3 flex-1">
                <div className="text-3xl font-extrabold">0€ <span className="text-base font-normal">/ mois</span></div>
                <ul className="mt-4 space-y-2 text-gray-700 text-sm">
                  <li>📰 Accès aux Annonces</li>
                  <li>🎟️ Accès aux Événements</li>
                  <li>💬 Accès aux Échanges</li>
                  <li>🗞️ Accès aux Faits divers</li>
                  <li>👥 Accès aux Groupes</li>
                  <li>📱 Accès au QR Code pour les événements</li>
                  <li>🛒 Accès Marketplace : création d'une boutique + achat</li>
                </ul>
              </div>
              <div className="mt-6">
                <button onClick={() => navigate('/auth')} className="w-full px-4 py-2 rounded-md bg-[#2BA84A] text-white font-medium hover:bg-[#24903f]">
                  S'inscrire
                </button>
                {isIOS ? (
                  <div className="mt-2 text-[11px] text-gray-500">
                    En utilisant OneKamer, vous acceptez
                    <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer" className="underline"> l'EULA d'Apple</a>,
                    nos <a href="/cgu" className="underline">Conditions d'utilisation</a> et notre
                    <a href="/rgpd" className="underline"> Politique de confidentialité</a>.
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-gray-500">
                    En utilisant OneKamer, vous acceptez nos <a href="/cgu" className="underline">Conditions d'utilisation</a> et notre
                    <a href="/rgpd" className="underline"> Politique de confidentialité</a>.
                  </div>
                )}
              </div>
            </div>

            {/* Standard (masqué sur iOS pendant la review) */}
            {!isIOS && (
              <div className="relative rounded-xl border-2 border-[#2BA84A] bg-white p-6 flex flex-col h-full shadow-sm">
                <div className="absolute top-0 right-4 -mt-3 bg-[#2BA84A] text-white text-xs font-bold px-3 py-1 rounded-full">POPULAIRE</div>
                <h3 className="text-lg font-semibold">Standard</h3>
                <p className="text-sm italic text-gray-600 mt-1">Moins cher qu’une portion de soya bien pimenté.</p>
                <div className="mt-3 flex-1">
                  <div className="text-3xl font-extrabold">2€ <span className="text-base font-normal">/ mois</span></div>
                  <ul className="mt-4 space-y-2 text-gray-700 text-sm">
                    <li>✅ Tout du plan Gratuit</li>
                    <li>🏢 Accès aux Partenaires & Recommandations</li>
                  </ul>
                </div>
                <div className="mt-6">
                  <button
                    onClick={() => navigate('/auth')}
                    className="w-full px-4 py-2 rounded-md bg-[#2BA84A] text-white font-medium hover:bg-[#24903f]"
                  >
                    Souscrire au forfait Standard
                  </button>
                  <div className="mt-2 text-[11px] text-gray-500">
                    Abonnement mensuel sans engagement, résiliable à tout moment.
                    <br />
                    En poursuivant, vous acceptez nos <a href="/cgu" className="underline">Conditions d'utilisation</a> et notre
                    <a href="/rgpd" className="underline"> Politique de confidentialité</a>.
                  </div>
                </div>
              </div>
            )}

            {/* VIP */}
            <div className="relative rounded-xl border border-gray-200 bg-white p-6 flex flex-col h-full shadow-sm">
              <h3 className="text-lg font-semibold">VIP</h3>
              <p className="text-sm italic text-gray-600 mt-1">À peine le prix de deux courses en moto-taxi.</p>
              <div className="mt-3 flex-1">
                <div className="text-3xl font-extrabold">{isIOS ? (vipIosPrice || '—') : '5€'} <span className="text-base font-normal">/ mois</span></div>
                <ul className="mt-4 space-y-2 text-gray-700 text-sm">
                  <li>✅ Tout du plan Standard</li>
                  <li>❤️ Accès complet à la section Rencontres</li>
                  <li>✍️ Création d’annonces</li>
                  <li>🎉 Création d’événements</li>
                  <li>👨‍👩‍👧‍👦 Création de groupes</li>
                </ul>
              </div>
              <div className="mt-6">
                <button
                  onClick={() => {
                    if (session) {
                      navigate('/forfaits')
                    } else {
                      navigate('/auth?next=%2Fforfaits')
                    }
                  }}
                  className="w-full px-4 py-2 rounded-md bg-[#2BA84A] text-white font-medium hover:bg-[#24903f]"
                >
                  Devenir membre VIP
                </button>
                {isIOS ? (
                  <div className="mt-2 text-[11px] text-gray-500">
                    Abonnement auto-renouvelable, sans engagement, résiliable à tout moment.
                    <br />
                    En appuyant sur le bouton, vous acceptez
                    <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer" className="underline"> l'EULA d'Apple</a>,
                    nos <a href="/cgu" className="underline">Conditions d'utilisation</a> et notre
                    <a href="/rgpd" className="underline"> Politique de confidentialité</a>.
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-gray-500">
                    Abonnement mensuel sans engagement, résiliable à tout moment.
                    <br />
                    En poursuivant, vous acceptez nos <a href="/cgu" className="underline">Conditions d'utilisation</a> et notre
                    <a href="/rgpd" className="underline"> Politique de confidentialité</a>.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bloc 4 – Footer */}
      <footer className="py-6 border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-gray-600">
          <div className="flex items-center justify-center flex-wrap gap-6 mb-3">
            <Link to="/mentions-legales" className="hover:underline">Mentions légales</Link>
            <Link to="/rgpd" className="hover:underline">Confidentialité</Link>
            <a href="mailto:contact@onekamer.co" className="hover:underline">Contact</a>
            <a href="https://www.tiktok.com/@onekamer.co?_r=1&_t=ZN-91I4c1H64eM" target="_blank" rel="noopener noreferrer" className="hover:underline" aria-label="TikTok">TikTok</a>
            <a href="https://www.instagram.com/onekamer.co?igsh=Z3p4dGJxamkyOWdw" target="_blank" rel="noopener noreferrer" className="hover:underline" aria-label="Instagram">Instagram</a>
          </div>
          <div>© 2026 OneKamer.co</div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
