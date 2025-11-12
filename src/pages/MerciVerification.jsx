import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MerciVerification = () => {
    const [status, setStatus] = useState('loading');
    const navigate = useNavigate();

    useEffect(() => {
        const sub = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setStatus('success');
                setTimeout(() => { navigate('/compte'); }, 1000);
            }
        });

        const handleVerification = async () => {
            try {
                // 1) Si une session existe déjà, on sort immédiatement
                const { data: s1 } = await supabase.auth.getSession();
                if (s1?.session) {
                    setStatus('success');
                    setTimeout(() => { navigate('/compte'); }, 1000);
                    return;
                }

                // 2) Sinon, on tente de consommer les paramètres du lien
                const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
                if (data?.session && !error) {
                    setStatus('success');
                    setTimeout(() => { navigate('/compte'); }, 1000);
                    return;
                }

                // 3) Dernier fallback: relecture de session ou user
                const { data: s2 } = await supabase.auth.getSession();
                if (s2?.session) {
                    setStatus('success');
                    setTimeout(() => { navigate('/compte'); }, 1000);
                    return;
                }
                const { data: userData } = await supabase.auth.getUser();
                if (userData?.user) {
                    setStatus('success');
                    setTimeout(() => { navigate('/compte'); }, 1000);
                    return;
                }

                setStatus('error');
            } catch (error) {
                console.error('Verification error:', error);
                setStatus('error');
            }
        };

        handleVerification();

        return () => {
            try { sub.data.subscription.unsubscribe(); } catch (_) {}
        };
    }, [navigate]);

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="flex flex-col items-center gap-4 text-gray-700">
                        <Loader2 className="h-12 w-12 animate-spin text-[#2BA84A]" />
                        <h1 className="text-2xl font-bold">Vérification de votre compte...</h1>
                        <p>Veuillez patienter un instant.</p>
                    </div>
                );
            case 'success':
                return (
                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4 text-green-700">
                        <CheckCircle className="h-16 w-16" />
                        <h1 className="text-3xl font-bold">Merci d'avoir vérifié votre compte !</h1>
                        <p>Vous allez être redirigé vers votre profil.</p>
                    </motion.div>
                );
            case 'error':
                return (
                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4 text-red-700">
                        <XCircle className="h-16 w-16" />
                        <h1 className="text-3xl font-bold">Lien invalide ou expiré</h1>
                        <p>La vérification a échoué. Veuillez réessayer.</p>
                        <Button onClick={() => navigate('/auth')} className="mt-4 bg-red-600 hover:bg-red-700 text-white">
                            Revenir à la connexion
                        </Button>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <Helmet>
                <title>Vérification du compte - OneKamer.co</title>
            </Helmet>
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                {renderContent()}
            </div>
        </>
    );
};

export default MerciVerification;