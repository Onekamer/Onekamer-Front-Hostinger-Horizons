import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const OKCoinsTransactions = () => {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialTab = params.get('tab') === 'withdrawals' ? 'withdrawals' : 'ledger';

  const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'https://onekamer-server.onrender.com';
  const API_PREFIX = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [ledgerItems, setLedgerItems] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(null);

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

  const loadBalance = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_PREFIX}/okcoins/balance`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.balance != null) setCurrentBalance(Number(data.balance));
    } catch {}
  }, [session?.access_token, API_PREFIX]);

  useEffect(() => {
    if (!session?.access_token) return;
    loadLedger();
    loadWithdrawals();
    loadBalance();
  }, [session?.access_token, loadLedger, loadWithdrawals]);

  useEffect(() => {
    if (!session?.access_token) return;
    loadBalance();
  }, [session?.access_token, loadBalance]);

  const computedBalancesAfter = useMemo(() => {
    if (!Array.isArray(ledgerItems) || ledgerItems.length === 0) return [];
    let running = currentBalance != null ? Number(currentBalance) : null;
    const out = [];
    for (let i = 0; i < ledgerItems.length; i++) {
      const it = ledgerItems[i];
      const knownAfter = it?.balance_after != null ? Number(it.balance_after) : null;
      const after = knownAfter != null ? knownAfter : running;
      out.push(after);
      if (after != null) {
        const delta = Number(it?.delta || 0);
        running = after - delta;
      } else {
        running = null;
      }
    }
    return out;
  }, [ledgerItems, currentBalance]);

  const handleRefreshLedger = useCallback(async () => {
    await Promise.allSettled([loadLedger(), loadBalance()]);
  }, [loadLedger, loadBalance]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', url.toString());
  }, [activeTab]);

  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Mes transactions OK Coins - OneKamer.co</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mes transactions</h1>
          <Button variant="outline" onClick={() => navigate('/ok-coins')}>OK Coins</Button>
        </div>

        <Card>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex justify-center">
                <TabsList>
                  <TabsTrigger value="ledger">Historique</TabsTrigger>
                  <TabsTrigger value="withdrawals">Retraits</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="ledger" className="mt-4">
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="outline" onClick={handleRefreshLedger}>Actualiser</Button>
                </div>
                {ledgerLoading ? (
                  <div className="text-center text-gray-500">Chargement...</div>
                ) : (
                  <div className="space-y-2">
                    {ledgerItems.length === 0 ? (
                      <div className="text-center text-gray-500">Aucun mouvement.</div>
                    ) : (
                      ledgerItems.map((item, idx) => {
                        const kind = String(item?.kind || '');
                        const anon = Boolean(item?.anonymous);
                        const other = item?.other_username || (kind === 'donation_in' && anon ? 'un membre' : null);
                        let label = kind;
                        if (kind === 'donation_in') label = `Don reçu${other ? ` de ${other}` : ''}`;
                        else if (kind === 'donation_out') label = `Don envoyé${other ? ` à ${other}` : ''}`;
                        else if (kind === 'withdrawal_processed') label = 'Retrait traité';
                        else if (kind === 'purchase_in') label = 'Achat OK Coins';
                        else if (kind === 'recharge_in') label = 'Crédit OK Coins';
                        const displayBalance = item?.balance_after != null ? item.balance_after : computedBalancesAfter[idx];

                        return (
                          <div key={item.id} className="flex items-center justify-between border-b pb-2">
                            <div>
                              <div className="text-sm">{new Date(item.created_at).toLocaleString('fr-FR')}</div>
                              <div className="text-xs text-[#6B6B6B]">{label}</div>
                            </div>
                            <div className="text-right">
                              <div className={`font-semibold ${item.delta >= 0 ? 'text-[#2BA84A]' : 'text-[#E0222A]'}`}>{item.delta >= 0 ? '+' : ''}{item.delta}</div>
                              {displayBalance != null && (
                                <div className="text-xs text-[#6B6B6B]">Solde: {displayBalance}</div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="withdrawals" className="mt-4">
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="outline" onClick={loadWithdrawals}>Actualiser</Button>
                </div>
                {withdrawalsLoading ? (
                  <div className="text-center text-gray-500">Chargement...</div>
                ) : (
                  <div className="space-y-2">
                    {withdrawals.length === 0 ? (
                      <div className="text-center text-gray-500">Aucun retrait.</div>
                    ) : (
                      withdrawals.map((w) => (
                        <div key={w.id} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <div className="text-sm">{new Date(w.created_at).toLocaleString('fr-FR')}</div>
                            <div className="text-xs text-[#6B6B6B]">{w.status}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{(w?.amount ?? 0).toLocaleString('fr-FR')} 🪙</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default OKCoinsTransactions;
