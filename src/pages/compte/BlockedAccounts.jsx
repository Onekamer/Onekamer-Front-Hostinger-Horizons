import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const BlockedAccounts = () => {
  const { user, profile, unblockUser, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState([]);

  const blockedIds = React.useMemo(() => {
    const arr = Array.isArray(profile?.blocked_user_ids) ? profile.blocked_user_ids : [];
    return arr.map(String);
  }, [profile?.blocked_user_ids]);

  const fetchBlocked = React.useCallback(async () => {
    setLoading(true);
    try {
      if (!user?.id) { setItems([]); return; }
      if (!blockedIds.length) { setItems([]); return; }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, is_deleted')
        .in('id', blockedIds);
      if (error) throw error;
      const normalized = (data || []).map((p) => (p?.is_deleted ? { ...p, username: 'Compte supprimé', avatar_url: null } : p));
      setItems(normalized);
    } catch (_) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, blockedIds.join(',')]);

  React.useEffect(() => { fetchBlocked(); }, [fetchBlocked]);

  const handleUnblock = async (targetId) => {
    try {
      await unblockUser?.(targetId);
      toast({ title: 'Débloqué', description: 'Le compte a été retiré de votre liste bloquée.' });
      setItems((prev) => (prev || []).filter((p) => String(p.id) !== String(targetId)));
      await refreshProfile?.();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de débloquer.' });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Comptes bloqués</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-green-500" /></div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500">Aucun compte bloqué.</div>
          ) : (
            <div className="divide-y">
              {items.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.username || 'Membre'}</div>
                  </div>
                  <Button variant="outline" onClick={() => handleUnblock(p.id)}>Débloquer</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BlockedAccounts;
