import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Coins, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { notifyDonationReceived } from '@/services/oneSignalNotifications';

const DonationDialog = ({ receiverId, receiverName, children, groupId, onDonationComplete }) => {
  const { user, balance, refreshBalance, profile } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [anonymous, setAnonymous] = useState(false);

  const handleDonation = async () => {
    if (!user) {
      toast({ title: 'Connexion requise', variant: 'destructive' });
      return;
    }

    const donationAmount = parseInt(amount);
    if (isNaN(donationAmount) || donationAmount <= 0) {
      toast({ title: 'Montant invalide', variant: 'destructive' });
      return;
    }

    if (balance.coins_balance < donationAmount) {
      toast({ title: 'Solde insuffisant', description: `Vous n'avez que ${balance.coins_balance} pièces.`, variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Essai v2 avec option anonyme
      let rpcError = null;
      try {
        const { error } = await supabase.rpc('make_donation_with_ledger_v2', {
          sender: user.id,
          receiver: receiverId,
          amount: donationAmount,
          msg: message || `Un petit don pour toi !`,
          anonymous,
        });
        if (error) rpcError = error;
      } catch (e) {
        rpcError = e;
      }

      if (rpcError) {
        const msg = String(rpcError?.message || '');
        if (/does not exist|No function matches|not found/i.test(msg)) {
          // Repli sur l’ancienne RPC (sans anonymat)
          const { error: fallbackErr } = await supabase.rpc('make_donation_with_ledger', {
            sender: user.id,
            receiver: receiverId,
            amount: donationAmount,
            msg: message || `Un petit don pour toi !`,
          });
          if (fallbackErr) throw fallbackErr;
        } else {
          throw rpcError;
        }
      }

      toast({
        title: 'Don effectué !',
        description: `Vous avez envoyé ${donationAmount} pièces à ${receiverName}.`,
      });
      try {
        await notifyDonationReceived({
          receiverId,
          senderName: anonymous ? 'Un membre OneKamer' : (profile?.username || user?.email || 'Un membre OneKamer'),
          amount: donationAmount,
        });
      } catch (notificationError) {
        console.error('Erreur notification OneSignal (don dialogue):', notificationError);
      }

      if (groupId) {
        try {
          const displayName = anonymous ? 'Un membre' : (profile?.username || 'Un membre');
          const systemMessage = `${displayName} a envoyé ${donationAmount} OK Coins à ${receiverName} dans ce groupe. 💚`;
          const { error: groupError } = await supabase.from('messages_groupes').insert({
            groupe_id: groupId,
            sender_id: user.id,
            contenu: systemMessage,
            is_system_message: true,
          });
          if (groupError) {
            console.error('Erreur création message système (don groupe):', groupError);
          } else if (onDonationComplete) {
            onDonationComplete();
          }
        } catch (groupInsertError) {
          console.error('Exception lors de la création du message de don dans le groupe:', groupInsertError);
        }
      }

      await refreshBalance();
      setAmount('');
      setMessage('');
      setIsOpen(false);
      setStep(1);
      setAnonymous(false);
    } catch (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    const donationAmount = parseInt(amount);
    if (isNaN(donationAmount) || donationAmount <= 0) {
      toast({ title: 'Montant invalide', variant: 'destructive' });
      return;
    }
    setStep(2);
  };

  const handleOpenChange = (open) => {
    if (!open) {
      setStep(1);
      setAmount('');
      setMessage('');
    }
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" className="flex items-center gap-2 hover:text-[#F5C300] transition-colors p-2 h-auto text-[#6B6B6B]">
            <Coins className="h-5 w-5" />
            <span className="font-normal">Don</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm-max-w-[425px] bg-white/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>Faire un don à {receiverName}</DialogTitle>
          <DialogDescription>
            Montrez votre appréciation en envoyant des OKCoins. Vous avez actuellement {balance?.coins_balance || 0} pièces.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: step === 1 ? 0 : -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.3 }}
        >
          {step === 1 && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">Montant</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="col-span-3"
                  placeholder="Ex: 100"
                />
              </div>
              <div className="flex justify-center gap-2">
                {[10, 50, 100, 500].map(val => (
                  <Button key={val} variant="outline" size="sm" onClick={() => setAmount(val.toString())}>
                    {val}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-4 py-4">
              <p>Vous êtes sur le point d'envoyer <strong>{amount} pièces</strong> à <strong>{receiverName}</strong>.</p>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="message">Message (optionnel)</Label>
                <Input
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Pour vous remercier..."
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="anonymous" checked={anonymous} onCheckedChange={(v) => setAnonymous(Boolean(v))} />
                <Label htmlFor="anonymous" className="text-sm text-gray-700">Don anonyme (votre nom ne sera pas affiché)</Label>
              </div>
            </div>
          )}
        </motion.div>

        <DialogFooter>
          {step === 1 && <Button onClick={handleNextStep}>Suivant</Button>}
          {step === 2 && (
            <>
              <Button variant="ghost" onClick={() => setStep(1)}>Précédent</Button>
              <Button onClick={handleDonation} disabled={loading} className="bg-[#2BA84A]">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmer le don
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DonationDialog;