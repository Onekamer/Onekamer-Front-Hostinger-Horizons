
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus, X, Crown, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.jsx";

const GroupAdmin = ({ group, onGroupUpdate }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [members, setMembers] = useState(group.groupes_membres || []);
    
    const [inviteQuery, setInviteQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    
    const wrapperRef = useRef(null);
    
    const isFounder = group.fondateur_id === user.id;
    const isAdmin = group.groupes_membres.find(m => m.user_id === user.id)?.is_admin || false;

    useEffect(() => {
        setMembers(group.groupes_membres || []);
    }, [group.groupes_membres]);

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (inviteQuery.trim().length > 1) {
                setSuggestionsLoading(true);
                const { data, error } = await supabase.rpc('search_non_members', {
                    gid: group.id,
                    term: inviteQuery
                });

                if (error) {
                    console.error("Error fetching suggestions:", error);
                    setSuggestions([]);
                } else {
                    setSuggestions(data);
                }
                setSuggestionsLoading(false);
            } else {
                setSuggestions([]);
            }
        };

        const timer = setTimeout(() => {
            if (showSuggestions) {
                fetchSuggestions();
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [inviteQuery, group.id, showSuggestions]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleInvite = async () => {
        if (!selectedUser) {
            toast({ title: "Erreur", description: "Veuillez sélectionner un utilisateur dans la liste.", variant: "destructive" });
            return;
        }
        setLoading(true);

        try {
            const { error: rpcError } = await supabase.rpc('invite_user_to_group', {
                p_group_id: group.id,
                p_user_id: selectedUser.id
            });

            if (rpcError) throw rpcError;
            
            toast({ title: "Invitation envoyée !", description: `${selectedUser.username} a été invité(e).` });
            onGroupUpdate();
            setInviteQuery('');
            setSelectedUser(null);
            setShowSuggestions(false);

        } catch(error) {
             toast({ title: "Erreur", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSuggestion = (user) => {
        setInviteQuery(user.username);
        setSelectedUser(user);
        setShowSuggestions(false);
    };
    
    const handleRemoveMember = async (memberId) => {
        if (memberId === group.fondateur_id) return;
        setActionLoading(true);
        const { error } = await supabase.rpc('kick_member', {
            p_group_id: group.id,
            p_target_id: memberId
        });

        if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
        else {
            toast({ title: "Membre retiré" });
            onGroupUpdate();
        }
        setActionLoading(false);
    };
    
    const handleToggleAdmin = async (memberId, isAdmin) => {
         if (memberId === group.fondateur_id) return;
         setActionLoading(true);
         const { error } = await supabase.from('groupes_membres').update({ is_admin: !isAdmin }).match({ groupe_id: group.id, user_id: memberId });
         if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
         else {
            toast({ title: `Rôle mis à jour` });
            onGroupUpdate();
         }
         setActionLoading(false);
    };

    const handleTransferOwnership = async (newOwnerId) => {
        setActionLoading(true);
        const { error } = await supabase.rpc('transfer_foundation', {
            p_group_id: group.id,
            p_new_founder: newOwnerId
        });
        if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
        else {
            toast({ title: 'Propriété transférée !'});
            onGroupUpdate();
        }
        setActionLoading(false);
    };
    
    const handleDeleteGroup = async () => {
         setActionLoading(true);
         const { error } = await supabase.rpc('delete_group', { p_group_id: group.id });
         if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
         else {
             toast({ title: 'Groupe supprimé' });
             navigate('/groupes');
         }
         setActionLoading(false);
    };

    return (
        <div className="space-y-6">
            {(isAdmin || isFounder) && (
                <Card>
                    <CardHeader><CardTitle>Paramètres du groupe</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <label className="text-sm font-medium">Nom du groupe</label>
                            <Input
                                type="text"
                                defaultValue={group.nom}
                                className="w-full border rounded-md p-2 text-sm mt-1"
                                onBlur={async (e) => {
                                    const { error } = await supabase.from('groupes').update({ nom: e.target.value }).eq('id', group.id);
                                    if (error) toast({ title: 'Erreur', description: 'Impossible de modifier le nom du groupe.', variant: 'destructive' });
                                    else {
                                        toast({ title: 'Succès', description: 'Nom du groupe mis à jour.' });
                                        onGroupUpdate();
                                    }
                                }}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Description du groupe</label>
                            <Textarea
                                defaultValue={group.description}
                                className="w-full border rounded-md p-2 text-sm mt-1"
                                onBlur={async (e) => {
                                    const { error } = await supabase.from('groupes').update({ description: e.target.value }).eq('id', group.id);
                                    if (error) toast({ title: 'Erreur', description: 'Impossible de modifier la description.', variant: 'destructive' });
                                    else {
                                        toast({ title: 'Succès', description: 'Description mise à jour.' });
                                        onGroupUpdate();
                                    }
                                }}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Visibilité du groupe</label>
                            <select
                                className="w-full border rounded-md p-2 text-sm mt-1 bg-white"
                                defaultValue={!group.est_prive ? 'true' : 'false'}
                                onChange={async (e) => {
                                    const newStatus = e.target.value === 'true';
                                    const { error } = await supabase.from('groupes').update({ est_prive: !newStatus }).eq('id', group.id);
                                    if (error) toast({ title: 'Erreur', description: 'Impossible de modifier la visibilité.', variant: 'destructive' });
                                    else {
                                        toast({ title: 'Succès', description: `Le groupe est maintenant ${newStatus ? 'public' : 'privé'}.` });
                                        onGroupUpdate();
                                    }
                                }}
                            >
                                <option value="false">Groupe privé (invitation uniquement)</option>
                                <option value="true">Groupe public (visible par tous)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Photo de profil du groupe</label>
                            <Input
                                type="file"
                                accept="image/*"
                                className="w-full text-sm mt-1"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const fileExt = file.name.split('.').pop();
                                    const filePath = `${group.id}.${fileExt}`;
                                    const { data: uploaded, error: uploadError } = await supabase.storage.from('groupes').upload(filePath, file, { upsert: true });
                                    if (uploadError) return toast({ title: 'Erreur', description: 'Impossible de téléverser la photo.', variant: 'destructive' });
                                    const storagePath = uploaded?.path || filePath;
                                    const { error: updateError } = await supabase.from('groupes').update({ image_url: storagePath }).eq('id', group.id);
                                    if (updateError) toast({ title: 'Erreur', description: 'Impossible de mettre à jour la photo.', variant: 'destructive' });
                                    else {
                                        toast({ title: 'Succès', description: 'Photo du groupe mise à jour.' });
                                        onGroupUpdate();
                                    }
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle>Gérer les membres</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative" ref={wrapperRef}>
                        <div className="flex items-center gap-2">
                            <Input 
                                placeholder="Rechercher un utilisateur..." 
                                value={inviteQuery} 
                                onChange={e => { 
                                    setInviteQuery(e.target.value); 
                                    setSelectedUser(null);
                                    setShowSuggestions(true); 
                                }}
                                onFocus={() => setShowSuggestions(true)}
                            />
                             <Button onClick={handleInvite} disabled={loading || !selectedUser}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserPlus className="h-4 w-4"/>}
                            </Button>
                        </div>
                        {showSuggestions && (inviteQuery.length > 1) && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                {suggestionsLoading ? (
                                    <div className="p-2 text-center text-gray-500">Chargement...</div>
                                ) : suggestions.length > 0 ? (
                                    suggestions.map(s => (
                                        <div 
                                            key={s.id} 
                                            className="flex items-center gap-3 p-2 hover:bg-gray-100 cursor-pointer"
                                            onClick={() => handleSelectSuggestion(s)}
                                        >
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={s.avatar_url} />
                                                <AvatarFallback>{s.username[0]}</AvatarFallback>
                                            </Avatar>
                                            <span>{s.username}</span>
                                        </div>
                                    ))
                                ) : (
                                    !suggestionsLoading && <div className="p-2 text-center text-gray-500">Aucun utilisateur trouvé.</div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        {members.map(m => (
                            <div key={m.user_id} className="flex items-center justify-between p-2 rounded-lg">
                                <div className="flex items-center gap-3">
                                     <Avatar><AvatarImage src={m.profile?.avatar_url} /><AvatarFallback>{m.profile?.username?.[0]}</AvatarFallback></Avatar>
                                     <p>{m.profile?.username}</p>
                                </div>
                                {m.role !== 'fondateur' && (isFounder || (isAdmin && !m.is_admin)) && (
                                    <div className="flex gap-2">
                                        {isFounder && (
                                            <Button variant={m.is_admin ? 'secondary' : 'outline'} size="sm" onClick={() => handleToggleAdmin(m.user_id, m.is_admin)} disabled={actionLoading}>
                                                <Shield className="mr-2 h-4 w-4"/>
                                                {m.is_admin ? 'Retirer Admin' : 'Promouvoir'}
                                            </Button>
                                        )}
                                        <Button variant="destructive" size="icon" onClick={() => handleRemoveMember(m.user_id)} disabled={actionLoading}><X className="h-4 w-4"/></Button>
                                    </div>
                                )}
                                {m.role === 'fondateur' && <Crown className="text-yellow-500"/>}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
            {isFounder && (
                <Card>
                    <CardHeader><CardTitle>Zone Fondateur</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                         <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="outline" className="w-full">Transférer la propriété</Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Transférer la propriété du groupe</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogDescription>Choisissez un nouveau fondateur. Cette action est irréversible.</AlertDialogDescription>
                                <div className="max-h-60 overflow-y-auto">
                                    {members.filter(m => m.user_id !== user.id).map(m => (
                                        <AlertDialogAction key={m.user_id} asChild>
                                            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => handleTransferOwnership(m.user_id)}>
                                                <Avatar className="h-8 w-8"><AvatarImage src={m.profile?.avatar_url}/><AvatarFallback>{m.profile?.username?.[0]}</AvatarFallback></Avatar>
                                                {m.profile?.username}
                                            </Button>
                                        </AlertDialogAction>
                                    ))}
                                </div>
                                <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive" className="w-full">Supprimer le groupe</Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogDescription>La suppression du groupe est définitive et entraînera la perte de tous les messages et membres.</AlertDialogDescription>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteGroup} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default GroupAdmin;
