
import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

const DeleteAccountSection = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { error } = await supabase.from('account_deletion_logs').insert({
        deleted_user_id: user.id,
        reason: reason.trim() || 'Aucune raison précisée',
      });

      if (error) {
        console.error('Erreur log suppression compte:', error);
      }

      toast({
        title: "🗑️ Suppression demandée",
        description: "Votre compte sera supprimé manuellement par notre équipe dans les prochaines 24 heures.",
      });

      setReason('');
      await signOut();
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d’envoyer la demande de suppression. Veuillez réessayer plus tard.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-t-4 border-t-[#EF4444]">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-800">
          Supprimer mon compte
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-gray-700">
        <p>
          En supprimant votre compte, toutes vos données personnelles et votre profil seront définitivement effacés.
          Vous devrez créer un nouveau compte si vous souhaitez revenir sur <strong>OneKamer.co</strong>.
        </p>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={loading}>
              Supprimer mon compte
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est <strong>irréversible</strong>. Votre profil, vos messages et toutes vos données seront supprimés.
                Souhaitez-vous nous indiquer la raison de votre départ ?
              </AlertDialogDescription>
              <Textarea
                placeholder="(facultatif) Indiquez la raison de votre départ..."
                className="mt-3"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={loading}>
                {loading ? "Suppression..." : "Confirmer la suppression"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default DeleteAccountSection;
