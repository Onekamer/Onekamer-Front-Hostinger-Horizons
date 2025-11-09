import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, UserX, MessageSquare as MessageSquareHeart, Lightbulb, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Custom hook for debouncing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

const SupportCenter = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requestType, setRequestType] = useState(null);
  
  // State for user search
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 250);

  const handleSearch = useCallback((event) => {
    event?.preventDefault();
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (requestType !== 'report') {
      setOpen(false);
    }
  }, [requestType]);

  const handleSelectUser = useCallback((user) => {
    if (!user) return;
    setSelectedUser(user);
    setSearchQuery('');
    setSearchResults([]);
    setOpen(false);
    toast({
      title: `👤 ${user.username || user.full_name} sélectionné`,
      duration: 1500,
    });
  }, [toast]);

  useEffect(() => {
    const term = (searchQuery || '').trim().replace(/^@+/, '');
    if (!open) return;
    const id = setTimeout(async () => {
      if (term.length < 1) { setSearchResults([]); return; }
      setSearchLoading(true);
      try {
        const like = `%${term.replace(/[%_]/g, '\\$&').replace(/'/g, "''")}%`;
        const q1 = supabase.from('profiles').select('id, username, full_name, avatar_url').ilike('username', like).limit(10);
        const q2 = supabase.from('profiles').select('id, username, full_name, avatar_url').ilike('full_name', like).limit(10);
        const q3 = supabase.from('profiles').select('id, username, full_name, avatar_url').ilike('email', like).limit(10);
        const [r1, r2, r3] = await Promise.all([q1, q2, q3]);
        const arr1 = Array.isArray(r1.data) ? r1.data : [];
        const arr2 = Array.isArray(r2.data) ? r2.data : [];
        const arr3 = Array.isArray(r3.data) ? r3.data : [];
        const map = new Map();
        [...arr1, ...arr2, ...arr3].forEach(u => { if (u && u.id && !map.has(u.id)) map.set(u.id, u); });
        const merged = Array.from(map.values());
        const qLower = term.toLowerCase();
        const sorted = merged.slice().sort((a, b) => {
          const aUser = (a.username || '').toLowerCase();
          const bUser = (b.username || '').toLowerCase();
          const aStarts = aUser.startsWith(qLower) ? 0 : 1;
          const bStarts = bUser.startsWith(qLower) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return aUser.localeCompare(bUser);
        });
        setSearchResults(sorted);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 250);
    return () => clearTimeout(id);
  }, [searchQuery, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !requestType || !message) {
      toast({
        variant: 'destructive',
        title: 'Champs manquants',
        description: 'Veuillez remplir tous les champs requis.',
      });
      return;
    }

    if (requestType === 'report' && !selectedUser) {
      toast({
        variant: 'destructive',
        title: 'Utilisateur manquant',
        description: 'Merci de sélectionner l’utilisateur à signaler.',
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('support_requests').insert({
      user_id: user.id,
      type: requestType,
      target_user_id:
        requestType === 'report' && selectedUser?.id
          ? selectedUser.id
          : null,
      category:
        requestType === 'report' && category
          ? category.trim()
          : null,
      message: message?.trim() || '',
      status: 'new',
    });
    setLoading(false);

    if (error) {
      console.error("Error submitting support request:", error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible d’envoyer la demande. Réessaie plus tard.',
      });
    } else {
      toast({
        title: '✅ Message envoyé !',
        description: 'Ta demande a bien été transmise à notre équipe. Merci !',
      });
      // Reset form
      setRequestType(null);
      setSelectedUser(null);
      setCategory('');
      setMessage('');
    }
  };

  const renderForm = () => {
  if (!requestType) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in-50 duration-500">
      {requestType === 'report' && (
        <>
          <div className="space-y-2">
            <label htmlFor="target-user-id" className="text-sm font-medium text-gray-700">
              Utilisateur à signaler <span className="text-red-500">*</span>
            </label>

            <div className="relative">
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
                onClick={handleSearch}
              >
                {selectedUser ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={selectedUser.avatar_url} alt={selectedUser.username} />
                      <AvatarFallback>{selectedUser.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {selectedUser.username || selectedUser.full_name}
                  </div>
                ) : (
                  "Rechercher un utilisateur..."
                )}
                <Loader2
                  className={cn(
                    "ml-2 h-4 w-4 shrink-0 opacity-50",
                    !searchLoading && "hidden"
                  )}
                />
              </Button>

              {open && (
                <div className="absolute z-50 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-xl">
                  <div className="p-2">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tape le username (ex: @anna)"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {searchLoading ? (
                      <div className="flex items-center gap-2 px-3 py-4 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Recherche en cours...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">Aucun utilisateur trouvé.</div>
                    ) : (
                      searchResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => handleSelectUser(result)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={result.avatar_url} alt={result.username} />
                            <AvatarFallback>
                              {result.username?.[0]?.toUpperCase() || result.full_name?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{result.username || result.full_name}</span>
                            {result.username && result.full_name && result.username !== result.full_name && (
                              <span className="text-xs text-gray-500">{result.full_name}</span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2 text-sm text-gray-500">
              Tape au moins un caractère pour lancer une recherche.
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="category" className="text-sm font-medium text-gray-700">
              Catégorie du signalement (ex: harcèlement, spam...)
            </label>
            <Input
              id="category"
              placeholder="Harcèlement, Faux profil, Contenu inapproprié..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <label htmlFor="message" className="text-sm font-medium text-gray-700">
          Ton message <span className="text-red-500">*</span>
        </label>
        <Textarea
          id="message"
          placeholder="Explique-nous en détail ce qu'il se passe..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Envoyer la demande'}
      </Button>
    </form>
  );
};

  return (
    <>
      <Helmet>
        <title>Centre d'aide - OneKamer</title>
        <meta name="description" content="Signaler un problème, donner un feedback ou proposer une suggestion à l'équipe OneKamer." />
      </Helmet>
      <div className="max-w-2xl mx-auto py-8">
        <Card className="shadow-lg border-t-4 border-t-[#2BA84A]">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-800">Centre d'aide OneKamer</CardTitle>
            <CardDescription className="text-gray-600">
              Un problème ? Une idée ? Nous sommes là pour t'écouter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!requestType ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in-50 duration-500">
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => setRequestType('report')}
                >
                  <UserX className="h-6 w-6 text-red-500" />
                  <span className="font-semibold">Signaler un utilisateur</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => setRequestType('feedback')}
                >
                  <MessageSquareHeart className="h-6 w-6 text-blue-500" />
                  <span className="font-semibold">Donner un feedback</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => setRequestType('suggestion')}
                >
                  <Lightbulb className="h-6 w-6 text-yellow-500" />
                  <span className="font-semibold">Suggérer une idée</span>
                </Button>
              </div>
            ) : (
                <Button variant="link" onClick={() => { setRequestType(null); setSelectedUser(null); }} className="text-sm text-[#2BA84A]">
                &larr; Choisir un autre type de demande
              </Button>
            )}
            {renderForm()}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default SupportCenter;
