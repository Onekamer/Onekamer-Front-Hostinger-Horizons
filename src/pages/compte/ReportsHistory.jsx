import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const s = String(status || 'pending').toLowerCase();
  const map = {
    pending: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-700',
  };
  const cls = map[s] || map.pending;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{s === 'pending' ? 'Reçu' : (s === 'resolved' ? 'Traité' : s)}</span>;
};

const ReportsHistory = () => {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState([]);

  const fetchReports = React.useCallback(async () => {
    setLoading(true);
    try {
      if (!user?.id) { setItems([]); return; }
      const { data, error } = await supabase
        .from('support_requests')
        .select('id, created_at, type, category, message, status, target_user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(Array.isArray(data) ? data : []);
    } catch (_) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  React.useEffect(() => { fetchReports(); }, [fetchReports]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mes signalements</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-green-500" /></div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500">Aucun signalement pour le moment.</div>
          ) : (
            <div className="divide-y">
              {items.map((r) => (
                <div key={r.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{r.category || 'Signalement'}</div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
                  <div className="text-sm text-gray-700 break-words">{r.message}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsHistory;
