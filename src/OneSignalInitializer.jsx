import React, { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Capacitor } from '@capacitor/core';

const ONE_SIGNAL_APP_ID = 'a122b55d-7627-4bc9-aeaf-1d6d9a6a50b5';

const OneSignalInitializer = () => {
  // 🔍 On détecte si on est dans l'app native iOS (Capacitor + iOS)
  const isIOSNativeApp =
    Capacitor?.isNativePlatform?.() && Capacitor?.getPlatform?.() === 'ios';
  const PROVIDER = import.meta.env.VITE_NOTIFICATIONS_PROVIDER || 'onesignal';
  
  // ⛔ On désactive OneSignal dans l’app iOS (WKWebView ne supporte pas SW/push web)
  if (isIOSNativeApp) {
    console.warn('⛔ OneSignalInitializer désactivé dans l’app iOS native.');
    return null;
  }
    
  if (PROVIDER === 'supabase_light') {
    return null;
  }
  const { user } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // ============================================================
  // 🧩 INITIALISATION DU SDK
  // ============================================================
  useEffect(() => {
    const initOneSignal = async () => {
      if (initialized) return;

      // ✅ Protection domaine: n'initialise OneSignal que sur les hôtes autorisés
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const isAllowedHost =
        host === 'onekamer.co' ||
        host === 'www.onekamer.co';

      if (!isAllowedHost) {
        console.warn('ℹ️ OneSignal ignoré sur cet hôte:', host);
        setInitialized(true);
        return;
      }

      // ✅ Prévention double init si le SDK a déjà été initialisé
      if (OneSignal?.User?.PushSubscription) {
        console.warn('ℹ️ OneSignal déjà initialisé, on ignore.');
        setInitialized(true);
        return;
      }

      setInitialized(true);

      try {
        console.log('🔄 Initialisation OneSignal...');
        await OneSignal.init({
          appId: ONE_SIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: true,
            showCredit: false,
          },
        });
        console.log('✅ OneSignal initialisé avec succès.');
      } catch (err) {
        console.error('❌ Erreur OneSignal init:', err);
      }
    };

    initOneSignal();
  }, [initialized]);

  // ============================================================
  // 👤 LIAISON UTILISATEUR SUPABASE → ONESIGNAL
  // ============================================================
  useEffect(() => {
    const linkUser = async () => {
      if (!user || !OneSignal) return;

      // 🛡️ Si OneSignal n'est pas initialisé (host non autorisé), on n'essaie pas de lier
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const isAllowedHost = host === 'onekamer.co' || host === 'www.onekamer.co';
      if (!isAllowedHost) return;
  
      try {
        console.log('🔗 Tentative de liaison OneSignal pour user:', user.id);
  
        // 🕐 Attente que le SDK soit prêt avant de continuer
        let sdkReady = false;
        for (let i = 0; i < 10; i++) {
          if (OneSignal.User?.PushSubscription) {
            sdkReady = true;
            break;
          }
          console.log(`⏳ Attente SDK prêt... (${i + 1}/10)`);
          await new Promise((res) => setTimeout(res, 1000));
        }
        if (!sdkReady) {
          console.warn('⚠️ OneSignal SDK non prêt après 10s');
          return;
        }
  
        // 🧹 Déconnexion éventuelle d’un ancien user
        const currentExternal = await OneSignal.User.getExternalId?.();
        if (currentExternal && currentExternal !== user.id) {
          console.log('🧹 Ancien utilisateur détecté, on déconnecte:', currentExternal);
          await OneSignal.logout();
          await new Promise((res) => setTimeout(res, 1000));
        }
  
        // 🧩 Vérifie que le worker OneSignal est bien actif
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          const oneSignalWorker = regs.find((r) =>
            r.active?.scriptURL?.includes('OneSignalSDKWorker.js')
          );
          if (!oneSignalWorker) {
            console.warn('⚠️ Aucun Service Worker OneSignal trouvé, enregistrement forcé…');
            await navigator.serviceWorker.register('/OneSignalSDKWorker.js');
            await new Promise((res) => setTimeout(res, 1500));
          }
        }
  
        // 🕐 Sécurise la demande de permission et attente
        // 🔄 Vérifie la permission de notifications de manière universelle
        const permission = await OneSignal.Notifications.getPermissionStatus?.();
        if (permission !== 'granted') {
          console.log('🔔 Permission non encore accordée, demande en cours...');
          try {
            await OneSignal.Slidedown.promptPush();
          } catch (e) {
            console.warn('⚠️ Impossible d’afficher le prompt OneSignal (déjà autorisé ou bloqué).');
          }
        }
        await new Promise((res) => setTimeout(res, 1000));
  
        // 🔐 Liaison Supabase <-> OneSignal
        await OneSignal.login(user.id);
        console.log('✅ User lié avec succès :', user.id);
  
        // 🧠 Attente de propagation OneSignal (spécifique iOS)
        let ext = null;
        let player = null;
        for (let i = 0; i < 8; i++) {
          ext = await OneSignal.User.getExternalId?.();
          player = await OneSignal.User.getUserId?.();
          if (ext && player) break;
          console.log(`⏳ Attente propagation OneSignal (${i + 1}/8)...`);
          await new Promise((res) => setTimeout(res, 1000));
        }
  
        console.log('✅ Vérif finale:', { externalId: ext, oneSignalUserId: player });
  
        // Si tout est OK
        if (ext && player) {
          console.log('🎯 OneSignal complètement synchronisé avec Supabase !');
        } else {
          console.warn('⚠️ Propagation incomplète (mais liaison probable côté OneSignal)');
        }
  
      } catch (err) {
        console.error('❌ Erreur de liaison OneSignal:', err);
      }
    };
  
    linkUser();
  }, [user]);

  // ============================================================
  // 🔔 ÉVÉNEMENT DE RECONNEXION (iOS permissionChange)
  // ============================================================
  useEffect(() => {
    if (!OneSignal || !user) return;

    const handlePermissionChange = async (event) => {
      console.log('📲 permissionChange détecté:', event);
      const ext = await OneSignal.User.getExternalId?.();
      if (!ext && user?.id) {
        console.log('♻️ Aucun externalId — reliaison forcée...');
        await OneSignal.login(user.id);
      }
    };

    OneSignal.Notifications.addEventListener('permissionChange', handlePermissionChange);
    return () => {
      OneSignal.Notifications.removeEventListener('permissionChange', handlePermissionChange);
    };
  }, [user]);

  // ============================================================
  // 🧪 FONCTION DE DIAGNOSTIC (checkOneSignalStatus)
  // ============================================================
  const checkOneSignalStatus = async () => {
    try {
      console.log('🔍 Vérification du statut OneSignal...');
      if (!OneSignal?.User) return console.warn('⚠️ OneSignal SDK non dispo.');

      const externalId = (await OneSignal.User.getExternalId?.()) || '(non disponible)';
      const oneSignalUserId = (await OneSignal.User.getUserId?.()) || '(non disponible)';
      const pushSub = OneSignal.User.PushSubscription;

      const status = {
        optedIn: await pushSub.optedIn,
        token: await pushSub.token,
        id: await pushSub.id,
      };

      console.log('🧩 Résumé OneSignal :', { externalId, oneSignalUserId, pushStatus: status });
      if (!status.optedIn) console.warn('⚠️ L’utilisateur n’a pas encore activé les notifs push.');
      else console.log('✅ Notifications push actives et prêtes à recevoir !');
    } catch (err) {
      console.error('❌ Erreur checkOneSignalStatus:', err);
    }
  };
  
  // This needs to be defined within the component scope to be accessible
  window.checkOneSignalStatus = checkOneSignalStatus;
  
  useEffect(() => {
    window.checkOneSignalStatus = checkOneSignalStatus;
    console.log('🧠 Commande dispo : exécute "checkOneSignalStatus()" dans la console pour tester OneSignal.');
  }, []);


  // ============================================================
  // 🍏 BANNIÈRE POUR iOS NON INSTALLÉ
  // ============================================================
  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (isIOS && !isStandalone) {
      const timer = setTimeout(() => setShowBanner(true), 4000);
      const hide = setTimeout(() => setShowBanner(false), 14000);
      return () => {
        clearTimeout(timer);
        clearTimeout(hide);
      };
    }
  }, []);

  return (
    <>
      {showBanner && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            padding: '12px 16px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '90%',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '14px' }}>
            📱 Pour activer les notifications OneKamer, ajoute l’app à ton écran d’accueil 📲
          </span>
          <button
            onClick={() => setShowBanner(false)}
            style={{
              backgroundColor: '#2BA84A',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              fontWeight: 'bold',
            }}
          >
            OK
          </button>
        </div>
      )}
    </>
  );
};

export default OneSignalInitializer;
