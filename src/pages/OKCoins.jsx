import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Coins, Loader2, Send, Gift, BarChart, Gem, UserCheck as UserSearch } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { getUserIdByInput } from '@/lib/okcHelpers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';

const OKCoins = () => {
  const { user, profile, balance, refreshBalance, session } = useAuth();
  const navigate = useNavigate();
  const [packs, setPacks] = useState([]);
  const [levels, setLevels] = useState([]);
  const [topDonors, setTopDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDonationDialog, setShowDonationDialog] = useState(false);
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
  const [donationData, setDonationData] = useState({ receiverInput: '', amount: '', message: '' });
  const [donationAnonymous, setDonationAnonymous] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [buyingPackId, setBuyingPackId] = useState(null);
  const isIOS = Capacitor.getPlatform() === 'ios';
  const [iapOkcReady, setIapOkcReady] = useState(false);
  const [iapOkcChecked, setIapOkcChecked] = useState(false);
  
  const [receiverSuggestions, setReceiverSuggestions] = useState([]);
  const [isSearchingReceiver, setIsSearchingReceiver] = useState(false);
  const debounceTimeout = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'https://onekamer-server.onrender.com';
  const API_PREFIX = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;

  const [serverOkc, setServerOkc] = useState(null);
  const [loadingServerBalance, setLoadingServerBalance] = useState(false);
  const [ledgerItems, setLedgerItems] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);

  const fetchServerBalance = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingServerBalance(true);
    try {
      const res = await fetch(`${API_PREFIX}/okcoins/balance`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setServerOkc(data || null);
    } catch {}
    finally { setLoadingServerBalance(false); }
  }, [session?.access_token, API_PREFIX]);

  const loadLedger = useCallback(async () => {
    if (!session?.access_token) return;
    setLedgerLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '20', offset: '0' });
      const res = await fetch(`${API_PREFIX}/okcoins/ledger?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setLedgerItems(Array.isArray(data?.items) ? data.items : []);
    } catch {}
    finally { setLedgerLoading(false); }
  }, [session?.access_token, API_PREFIX]);

  const loadWithdrawals = useCallback(async () => {
    if (!session?.access_token) return;
    setWithdrawalsLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '20', offset: '0' });
      const res = await fetch(`${API_PREFIX}/okcoins/withdrawals?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setWithdrawals(Array.isArray(data?.items) ? data.items : []);
    } catch {}
    finally { setWithdrawalsLoading(false); }
  }, [session?.access_token, API_PREFIX]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [packsRes, levelsRes] = await Promise.all([
      supabase.from('okcoins_packs').select('*').eq('is_active', true).order('price_eur'),
      supabase.from('okcoins_levels').select('*').order('id'),
    ]);
    let donors = [];
    try {
      const res = await fetch(`${API_PREFIX}/okcoins/top-donors?limit=3`);
      const data = await res.json().catch(() => ({}));
      donors = Array.isArray(data?.items) ? data.items : [];
    } catch {}
    
    if (packsRes.error || levelsRes.error) {
      toast({ title: "Erreur de chargement", description: "Impossible de récupérer les données OK Coins.", variant: "destructive" });
    } else {
      setPacks(packsRes.data);
      setLevels(levelsRes.data);
      setTopDonors(donors);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!session?.access_token) return;
    fetchServerBalance();
    loadLedger();
    loadWithdrawals();
  }, [session?.access_token, fetchServerBalance, loadLedger, loadWithdrawals]);

  useEffect(() => {
    let mounted = true;
    const preload = async () => {
      try {
        if (!isIOS) { if (mounted) setIapOkcChecked(true); return; }
        const hasFn = typeof NativePurchases?.getProducts === 'function';
        if (!hasFn) { if (mounted) setIapOkcChecked(true); return; }
        const res = await NativePurchases.getProducts({
          productIdentifiers: ['onekamer_okcoins_pack_10'],
          productType: PURCHASE_TYPE.INAPP,
        });
        const list = Array.isArray(res?.products) ? res.products : (Array.isArray(res) ? res : []);
        const ok = (list || []).some((p) => String(p?.productId || p?.productIdentifier) === 'onekamer_okcoins_pack_10');
        if (mounted) { setIapOkcReady(!!ok); setIapOkcChecked(true); }
      } catch {
        if (mounted) setIapOkcChecked(true);
      }
    };
    preload();
    return () => { mounted = false; };
  }, [isIOS]);

  const handleReceiverSearch = (searchTerm) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (!searchTerm.trim()) {
      setReceiverSuggestions([]);
      setIsSearchingReceiver(false);
      return;
    }

    setIsSearchingReceiver(true);
    debounceTimeout.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, email')
        .or(`username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .neq('id', user.id) // Exclude self
        .limit(5);

      if (error) {
        console.error("Erreur de recherche:", error);
      } else {
        setReceiverSuggestions(data);
      }
      setIsSearchingReceiver(false);
    }, 500);
  };
  
  const handleDonationSubmit = async (e) => {
    e.preventDefault();
    if (!user || !profile) {
      return toast({ title: "Veuillez vous connecter", variant: "destructive" });
    }

    const amount = parseInt(donationData.amount);
    if (!donationData.receiverInput || !amount || amount <= 0) {
      return toast({ title: "Données invalides", description: "Veuillez renseigner un destinataire et un montant valide.", variant: "destructive" });
    }

    if (!balance || balance.coins_balance < amount) {
      return toast({ title: "Solde insuffisant", description: "Vous n'avez pas assez de pièces.", variant: "destructive" });
    }

    setIsSubmitting(true);
    try {
      const receiverId = await getUserIdByInput(donationData.receiverInput);

      if (receiverId === user.id) {
        throw new Error("Vous ne pouvez pas vous envoyer de pièces à vous-même.");
      }

      // RPC v2 (anonyme) avec repli si indisponible
      let rpcErr = null;
      try {
        const { error } = await supabase.rpc('make_donation_with_ledger_v2', {
          sender: user.id,
          receiver: receiverId,
          amount: amount,
          msg: donationData.message,
          anonymous: donationAnonymous,
        });
        if (error) rpcErr = error;
      } catch (e2) {
        rpcErr = e2;
      }

      if (rpcErr) {
        const msg = String(rpcErr?.message || '');
        if (/does not exist|No function matches|not found/i.test(msg)) {
          const { error: fb } = await supabase.rpc('make_donation_with_ledger', {
            sender: user.id,
            receiver: receiverId,
            amount: amount,
            msg: donationData.message,
          });
          if (fb) throw new Error(fb.message);
        } else {
          throw new Error(msg);
        }
      }
      
      const donorDisplay = donationAnonymous ? 'Un membre' : (profile.username || 'Un membre');
      const postContent = `🎉 ${donorDisplay} a fait un don de ${amount} OK Coins à ${donationData.receiverInput} ! Merci pour cette générosité qui fait vivre la communauté. 💚`;

      const { error: postError } = await supabase.from('posts').insert({
        user_id: user.id,
        content: postContent,
        likes_count: 0,
        comments_count: 0
      });

      if (postError) {
        console.warn("Le don a réussi, mais la publication automatique a échoué:", postError.message);
        toast({ title: "Don envoyé !", description: `La publication automatique a échoué, mais votre don de ${amount} pièces a bien été envoyé.`, variant: "default" });
      } else {
        toast({ title: "Don envoyé et publié !", description: `Vous avez envoyé ${amount} pièces. Merci !` });
      }

      await refreshBalance();
      fetchData(); // Refresh top donneurs
      setShowDonationDialog(false);
      setDonationAnonymous(false);
      setDonationData({ receiverInput: '', amount: '', message: '' });

    } catch (error) {
       toast({ title: "Erreur de don", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleBuyPack = async (pack) => {
    if (!user) return toast({ title: "Veuillez vous connecter", variant: "destructive" });

    if (isIOS && Number(pack?.coins) === 1000) {
      setBuyingPackId(pack.id);
      try {
        if (iapOkcChecked && !iapOkcReady) {
          toast({ title: 'Indisponible sur cet appareil', description: "Le produit IAP n’a pas été résolu (compte Sandbox requis / produit non attaché).", variant: 'destructive' });
          return;
        }
        const result = await NativePurchases.purchaseProduct({
          productIdentifier: 'onekamer_okcoins_pack_10',
          productType: PURCHASE_TYPE.INAPP,
          quantity: 1
        });
        const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'https://onekamer-server.onrender.com';
        const API_PREFIX = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;
        const res = await fetch(`${API_PREFIX}/iap/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
          },
          body: JSON.stringify({
            platform: 'ios',
            provider: 'apple',
            userId: user.id,
            transactionId: result.transactionId
          })
        });
        const dataVerify = await res.json().catch(() => ({}));
        if (!res.ok || !dataVerify?.ok) throw new Error(dataVerify?.error || 'Échec vérification');
        await refreshBalance();
        toast({ title: 'Achat réussi', description: 'Vos OK Coins ont été crédités.' });
      } catch (error) {
        toast({ title: 'Erreur de paiement', description: error.message || 'Achat in-app échoué', variant: 'destructive' });
      } finally {
        setBuyingPackId(null);
      }
      return;
    }

    setBuyingPackId(pack.id);
    try {
      navigate(`/pay/okcoins/${encodeURIComponent(pack.id)}`);
    } finally {
      setBuyingPackId(null);
    }
  };


  const handleWithdrawalSubmit = async (e) => {
    e.preventDefault();
    if (!user || !balance) {
      return toast({ title: "Veuillez vous connecter", variant: "destructive" });
    }

    const amount = parseInt(withdrawalAmount);
    if (!amount || amount < 1000) {
      return toast({ title: "Montant invalide", description: "Le montant minimum de retrait est de 1000 pièces.", variant: "destructive" });
    }

    const available = Number.isFinite(serverOkc?.available) ? serverOkc.available : balance.coins_balance;
    if (available < amount) {
      return toast({ title: "Solde insuffisant", description: "Vous n'avez pas assez de pièces disponibles pour ce retrait.", variant: "destructive" });
    }
    
    setIsSubmittingWithdrawal(true);
    try {
      const response = await fetch(`${API_PREFIX}/okcoins/withdrawals/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = data?.error || "Erreur lors de la demande de retrait.";
        throw new Error(errorMessage);
      }
      toast({ title: "Demande reçue", description: `Votre demande de retrait de ${amount.toLocaleString('fr-FR')} pièces est en cours de traitement.` });
      setShowWithdrawalDialog(false);
      setWithdrawalAmount('');
      await fetchServerBalance();
      await loadWithdrawals();
    } catch (error) {
      console.error('Erreur lors de la demande de retrait :', error);
      toast({
        title: "Erreur de retrait",
        description: error.message || "Une erreur est survenue lors de la demande de retrait.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };


  const getCurrentLevel = useCallback(() => {
    if (!balance || levels.length === 0) return levels[0] || {};
    return levels.find(l => balance.points_total >= l.min_points && balance.points_total <= l.max_points) || levels[0];
  }, [balance, levels]);
  
  const getLevelById = useCallback((levelId) => {
    return levels.find(l => l.id === levelId) || {};
  }, [levels]);

  const currentLevel = getCurrentLevel();
  const nextLevel = levels.find(l => l.id === (currentLevel?.id || 0) + 1);
  const progress = nextLevel && currentLevel && balance
    ? Math.max(0, Math.min(100, ((balance.points_total - currentLevel.min_points) / (nextLevel.min_points - currentLevel.min_points)) * 100))
    : balance && !nextLevel ? 100 : 0;

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" /></div>;
  }

  return (
    <>
      <Helmet>
        <title>OK Coins - OneKamer.co</title>
        <meta name="description" content="Soutenez la communauté avec les OK Coins sur OneKamer.co" />
      </Helmet>

      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#F5C300] to-[#2BA84A] bg-clip-text text-transparent mb-4">OK Coins 💰</h1>
          <p className="text-lg text-[#6B6B6B]">Soutenez la communauté avec les pièces virtuelles</p>
        </motion.div>

        <Card>
          <CardContent className="p-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  <div className="flex items-center gap-3">
                    <Gift className="h-5 w-5 text-[#2BA84A]" />
                    <span className="font-semibold">Soutenez la communauté</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-8">
                  <p className="text-sm text-gray-600">
                    Les dons OK Coins permettent de soutenir les créateurs, les membres et les projets de la communauté OneKamer. Chaque don effectué aide à maintenir la plateforme, récompenser les contributions et faire grandir notre réseau.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>
                  <div className="flex items-center gap-3">
                    <BarChart className="h-5 w-5 text-[#2BA84A]" />
                    <span className="font-semibold">Comment ça marche ?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-8 space-y-2">
                  <p>1. <strong>Rechargez</strong> votre solde en OK Coins (pièces virtuelles) depuis votre compte.</p>
                  <p>2. <strong>Envoyez</strong> un don à un membre, un créateur ou une publication.</p>
                  <p>3. Les bénéficiaires reçoivent des pièces et peuvent par la suite demander un retrait directement sur leur compte bancaire via l'application ou les utiliser pour payer directement avec lorsqu'il s'agit d'évènement payant organisé par OneKamer.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>
                  <div className="flex items-center gap-3">
                    <Gem className="h-5 w-5 text-[#2BA84A]" />
                    <span className="font-semibold">Niveaux & Points</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-8 space-y-3">
                  <p className="font-semibold">À chaque fois que vous offrez des pièces, vous montez en points et débloquez des niveaux :</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Niveau 1 (0-30 pts):</strong> 🪙</li>
                    <li><strong>Niveau 2 (31-60 pts):</strong> 💳</li>
                    <li><strong>Niveau 3 (61-90 pts):</strong> 💶</li>
                    <li><strong>Niveau 4 (91-120 pts):</strong> 💰</li>
                    <li><strong>Niveau 5 (121+ pts):</strong> 💎</li>
                  </ul>
                   <p className="text-xs text-gray-500 pt-2">Toutes les transactions sont instantanées et sécurisées grâce à notre partenaire de paiement Stripe.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {user && balance && (
          <Card className="bg-gradient-to-br from-[#CDE1D5] to-white">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Votre Niveau</span>
                <span className="text-4xl">{currentLevel?.icon}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-2xl font-bold text-[#2BA84A]">{currentLevel?.level_name}</div>
                  <div className="text-sm text-[#6B6B6B]">{balance.points_total || 0} points</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#F5C300]">{balance.coins_balance?.toLocaleString() || 0} 🪙</div>
                  <div className="text-sm text-[#6B6B6B]">Pièces</div>
                </div>
              </div>
              {nextLevel && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progression vers {nextLevel.min_points - (balance.points_total || 0)} points restants</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-[#2BA84A] to-[#F5C300]" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Acheter des pièces</CardTitle>
            <CardDescription>Chaque don effectué vous rapporte des points et vous permet de monter de niveau.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {packs.map((pack) => {
                let coinColorClass = 'text-[#6B6B6B]';
                if (pack.price_eur <= 25) {
                  coinColorClass = 'text-amber-700';
                } else if (pack.price_eur <= 50) {
                  coinColorClass = 'text-gray-400';
                } else if (pack.price_eur <= 100) {
                  coinColorClass = 'text-yellow-500';
                } else {
                  coinColorClass = 'text-blue-400';
                }

                return (
                <motion.div key={pack.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Card className="text-center cursor-pointer hover:border-[#2BA84A] transition-colors flex flex-col h-full">
                    <CardContent className="pt-6 flex-grow flex flex-col justify-between">
                      <div>
                        <div className={`text-3xl mb-2 ${coinColorClass}`}>
                           🪙
                        </div>
                        <div className="font-bold text-lg">{isIOS && Number(pack?.coins) === 1000 ? '11,99€' : `${pack.price_eur}€`}</div>
                        <div className="text-sm text-[#6B6B6B] mb-2">{pack.coins.toLocaleString()} pièces</div>
                        <div className="text-xs text-[#2BA84A] font-semibold">+{pack.points} points</div>
                      </div>
                      {/* iOS natif (App Review): désactiver tous les packs sauf 1000 coins (IAP) */}
                      <Button
                        className="w-full mt-4 bg-[#2BA84A]"
                        onClick={() => handleBuyPack(pack)}
                        disabled={
                          buyingPackId === pack.id ||
                          (isIOS && Number(pack?.coins) !== 1000) ||
                          (isIOS && Number(pack?.coins) === 1000 && iapOkcChecked && !iapOkcReady)
                        }
                      >
                        {buyingPackId === pack.id
                          ? <Loader2 className="h-4 w-4 animate-spin"/>
                          : (isIOS && Number(pack?.coins) !== 1000)
                            ? 'Bientôt disponible'
                            : (isIOS && Number(pack?.coins) === 1000 && iapOkcChecked && !iapOkcReady)
                              ? 'Indisponible (Sandbox requis)'
                              : 'Acheter'}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )})}
            </div>
          </CardContent>
        </Card>

        {user && (
          <Dialog open={showDonationDialog} onOpenChange={(isOpen) => { setShowDonationDialog(isOpen); if (!isOpen) setReceiverSuggestions([]); }}>
            <DialogTrigger asChild>
              <Button className="w-full bg-[#2BA84A] py-6 text-lg"><Send className="h-5 w-5 mr-2" />Faire un don</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleDonationSubmit}>
                <DialogHeader>
                  <DialogTitle>Faire un don 💸</DialogTitle>
                  <DialogDescription>Envoyez des pièces à un autre membre pour le remercier.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="relative">
                    <Label htmlFor="receiverInput" className="text-left mb-2 block">Destinataire</Label>
                    <div className="relative">
                      <Input 
                        id="receiverInput" 
                        value={donationData.receiverInput} 
                        onChange={(e) => {
                          setDonationData(p => ({...p, receiverInput: e.target.value}));
                          handleReceiverSearch(e.target.value);
                        }} 
                        className="pl-10" 
                        placeholder="Pseudo ou email" 
                        autoComplete="off"
                      />
                      <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                    {(isSearchingReceiver || receiverSuggestions.length > 0) && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {isSearchingReceiver && receiverSuggestions.length === 0 ? (
                           <div className="p-3 text-sm text-gray-500 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin mr-2"/> Recherche...</div>
                        ) : (
                          receiverSuggestions.map(suggestion => (
                            <div 
                              key={suggestion.email}
                              onClick={() => {
                                setDonationData(p => ({...p, receiverInput: suggestion.username}));
                                setReceiverSuggestions([]);
                              }}
                              className="p-3 hover:bg-gray-100 cursor-pointer text-sm"
                            >
                              <p className="font-semibold">{suggestion.username}</p>
                              <p className="text-xs text-gray-500">{suggestion.email}</p>
                            </div>
                          ))
                        )}
                        { !isSearchingReceiver && receiverSuggestions.length === 0 && donationData.receiverInput && (
                           <div className="p-3 text-sm text-center text-gray-500">Aucun utilisateur trouvé.</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="amount" className="text-left mb-2 block">Montant</Label>
                    <Input id="amount" type="number" value={donationData.amount} onChange={e => setDonationData(p => ({...p, amount: e.target.value }))} placeholder="Nombre de pièces" />
                  </div>
                   <div>
                    <Label htmlFor="message" className="text-left mb-2 block">Message (optionnel)</Label>
                    <Input id="message" value={donationData.message} onChange={e => setDonationData(p => ({...p, message: e.target.value }))} placeholder="Message d'encouragement..." />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="donationAnonymous" checked={donationAnonymous} onCheckedChange={(v) => setDonationAnonymous(Boolean(v))} />
                    <Label htmlFor="donationAnonymous" className="text-sm text-gray-700">Don anonyme (votre nom ne sera pas affiché)</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Envoyer le don
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Top Donateurs 🏆</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topDonors.length > 0 ? (
                topDonors.map((donor, index) => {
                  const donorLevel = getLevelById(donor.donor_level);
                  return (
                    <div key={donor.user_id} className="flex items-center justify-between p-3 bg-[#CDE1D5] rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-[#2BA84A]">#{index + 1}</div>
                        <div>
                          <div className="font-semibold">{donor.profiles?.username || 'Anonyme'}</div>
                          <div className="text-sm text-[#6B6B6B]">{donor.points_total} points</div>
                        </div>
                      </div>
                      <div className="text-3xl">{donorLevel?.icon || '🪙'}</div>
                    </div>
                  )
                })
              ) : (
                <p className="text-center text-gray-500">Soyez le premier donateur !</p>
              )}
            </div>
          </CardContent>
        </Card>

         <Card>
          <CardHeader>
            <CardTitle>Retrait en cash</CardTitle>
            <CardDescription>Convertissez vos pièces en argent réel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-[#CDE1D5] p-4 rounded-lg space-y-2">
              <div className="flex justify-between"><span className="font-medium">Minimum:</span><span>1 000 pièces</span></div>
              <div className="flex justify-between"><span className="font-medium">Commission:</span><span>10%</span></div>
              <div className="flex justify-between"><span className="font-medium">Taux:</span><span>0,01€/pièce</span></div>
            </div>
            <Dialog open={showWithdrawalDialog} onOpenChange={(isOpen) => { setShowWithdrawalDialog(isOpen); if (isOpen) fetchServerBalance(); }}>
              <DialogTrigger asChild>
                <Button className="w-full bg-[#E0222A]" disabled={!user}>
                  Demander un retrait
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleWithdrawalSubmit}>
                  <DialogHeader>
                    <DialogTitle>Demander un retrait</DialogTitle>
                    <DialogDescription>Convertissez vos pièces en argent. Le solde sera mis à jour après validation.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="withdrawalAmount" className="text-right">Montant</Label>
                      <Input id="withdrawalAmount" type="number" value={withdrawalAmount} onChange={e => setWithdrawalAmount(e.target.value)} className="col-span-3" placeholder="Nombre de pièces" min="1000" />
                    </div>
                    <div className="text-sm text-muted-foreground col-span-4 text-center">Votre solde: {balance?.coins_balance?.toLocaleString() || 0} pièces</div>
                    <div className="text-sm text-muted-foreground col-span-4 text-center">Disponible: {((serverOkc?.available ?? balance?.coins_balance) || 0).toLocaleString('fr-FR')} pièces</div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmittingWithdrawal}>
                      {isSubmittingWithdrawal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmer la demande
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {user && (
          <Card>
            <CardHeader>
              <CardTitle>Mes transactions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-600">Consultez l’historique (ledger) et vos retraits.</p>
              <Button className="w-full" onClick={() => navigate('/compte/okcoins-transactions')}>Ouvrir</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};

export default OKCoins;