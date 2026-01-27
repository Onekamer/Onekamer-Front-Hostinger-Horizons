import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import MediaDisplay from '@/components/MediaDisplay';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from "@/components/ui/input";
import { Send } from 'lucide-react';
import { notifyRencontreMessage } from '@/services/oneSignalNotifications';

const MessagesPrives = () => {
  const { user, onlineUserIds } = useAuth();
  const navigate = useNavigate();

  const [matches, setMatches] = useState([]);
  const [myRencontreId, setMyRencontreId] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [otherUsers, setOtherUsers] = useState({});
  const [myRencontreProfile, setMyRencontreProfile] = useState({});
  const [presenceByUserId, setPresenceByUserId] = useState({});

  const fetchMyRencontreId = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('rencontres').select('id, name, user_id').eq('user_id', user.id).single();
    if (data) {
      setMyRencontreId(data.id);
      setMyRencontreProfile(data);
    }
  }, [user]);

  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("rencontres_matches")
      .select("*, user1:rencontres!user1_id(id, user_id, name, image_url, photos), user2:rencontres!user2_id(id, user_id, name, image_url, photos)")
      .or(`user1_id.in.(${myRencontreId}),user2_id.in.(${myRencontreId})`)
      .order("created_at", { ascending: false });

    if (!error) {
      setMatches(data);
      const users = {};
      const otherUserIds = [];
      data.forEach(match => {
        const otherUser = match.user1_id === myRencontreId ? match.user2 : match.user1;
        users[otherUser.id] = otherUser;
        if (otherUser?.user_id) otherUserIds.push(String(otherUser.user_id));
      });
      setOtherUsers(users);

      const uniqueIds = Array.from(new Set(otherUserIds));
      if (uniqueIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, show_online_status, last_seen_at')
          .in('id', uniqueIds);
        const byId = (profs || []).reduce((acc, p) => {
          acc[String(p.id)] = p;
          return acc;
        }, {});
        setPresenceByUserId(byId);
      } else {
        setPresenceByUserId({});
      }
    }
    setLoading(false);
  }, [user, myRencontreId]);

  const getStatusLabel = (otherUser) => {
    const uid = otherUser?.user_id ? String(otherUser.user_id) : null;
    if (!uid) return null;
    const p = presenceByUserId[uid];
    if (p?.show_online_status === false) return 'Hors ligne';
    const isOnline = onlineUserIds instanceof Set ? onlineUserIds.has(uid) : false;
    if (isOnline) return 'En ligne';
    if (p?.last_seen_at) {
      try {
        return `Vu ${formatDistanceToNow(new Date(p.last_seen_at), { addSuffix: true, locale: fr })}`;
      } catch {
        return 'Hors ligne';
      }
    }
    return 'Hors ligne';
  };

  useEffect(() => {
    fetchMyRencontreId();
  }, [fetchMyRencontreId]);

  useEffect(() => {
    if (myRencontreId) {
      fetchMatches();
    }
  }, [myRencontreId, fetchMatches]);

  const loadMessages = async (matchId) => {
    setSelectedMatch(matchId);
    setMessages([]);
    const { data, error } = await supabase
      .from("messages_rencontres")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (!error) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedMatch || !myRencontreId) return;

    const currentMatch = matches.find(m => m.id === selectedMatch);
    if (!currentMatch) return;

    const receiver_id = currentMatch.user1_id === myRencontreId ? currentMatch.user2_id : currentMatch.user1_id;

    const content = newMessage.trim();
    const { error } = await supabase.from("messages_rencontres").insert({
      match_id: selectedMatch,
      sender_id: myRencontreId,
      receiver_id: receiver_id,
      content,
    });
    if (!error) {
      setNewMessage("");
      try {
        const other = currentMatch.user1_id === myRencontreId ? currentMatch.user2 : currentMatch.user1;
        const recipientUserId = other?.user_id;
        if (recipientUserId) {
          await notifyRencontreMessage({
            recipientId: recipientUserId,
            senderName: myRencontreProfile?.name || undefined,
            message: content,
            matchId: selectedMatch,
          });
        }
      } catch (_) {}
    }
  };

  useEffect(() => {
    if (!selectedMatch) return;

    const channel = supabase
      .channel(`match-${selectedMatch}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages_rencontres",
          filter: `match_id=eq.${selectedMatch}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMatch]);

  if (loading) {
    return <div className="flex justify-center items-center p-16"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>
  }

  const getOtherUserInMatch = (match) => {
    if (!myRencontreId) return null;
    return match.user1_id === myRencontreId ? match.user2 : match.user1;
  }

  const getProfilePhoto = (profile) => {
    if (!profile) return null;
    const firstPhoto = Array.isArray(profile.photos) && profile.photos.length > 0 ? profile.photos[0] : null;
    const candidates = [profile.image_url, firstPhoto].filter(Boolean);
    const absolute = candidates.find((c) => typeof c === 'string' && /^https?:\/\//i.test(c));
    return absolute || candidates[0] || null;
  };

  return (
    <>
      <Helmet>
        <title>Mes Messages - Rencontres</title>
      </Helmet>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate('/rencontre')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-transparent bg-clip-text">Mes Matchs</h1>
      </motion.div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-0 md:p-4 h-[calc(100vh-200px)]">
        <div className="col-span-1 border-r pr-4 overflow-y-auto">
          <h2 className="font-bold text-lg mb-2"> Mes matchs</h2>
          {matches.map((m) => {
            const otherUser = getOtherUserInMatch(m);
            if (!otherUser) return null;
            const photo = getProfilePhoto(otherUser);
            return (
              <div
                key={m.id}
                onClick={() => loadMessages(m.id)}
                className={`cursor-pointer p-2 rounded-md flex items-center gap-3 ${
                  selectedMatch === m.id ? "bg-green-100" : "hover:bg-gray-100"
                }`}
              >
                <Avatar className="w-12 h-12">
                  {photo ? (
                    <MediaDisplay
                      bucket="rencontres"
                      path={photo}
                      alt={otherUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <AvatarFallback>{otherUser.name?.charAt(0)}</AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <p className="font-semibold">{otherUser.name}</p>
                  <p className="text-xs text-gray-500">Matché {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: fr })}</p>
                  {getStatusLabel(otherUser) && (
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${getStatusLabel(otherUser) === 'En ligne' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span>{getStatusLabel(otherUser)}</span>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          {matches.length === 0 && (
            <div className="text-center text-gray-500 py-16">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-semibold">Aucun match</p>
              <p className="text-sm">Continuez à swiper !</p>
            </div>
          )}
        </div>

        <div className="col-span-1 md:col-span-2 flex flex-col h-full">
          {selectedMatch ? (
            <>
              <div className="flex-1 overflow-y-auto border p-3 rounded-md bg-gray-50 mb-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`my-2 flex ${
                      msg.sender_id === myRencontreId ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`px-3 py-2 rounded-2xl max-w-sm ${
                        msg.sender_id === myRencontreId
                          ? "bg-green-500 text-white rounded-br-none"
                          : "bg-gray-200 text-gray-800 rounded-bl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-auto flex gap-2">
                <Input
                  placeholder="Votre message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <Button onClick={sendMessage} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </>
          ) : (
             <div className="flex-1 flex items-center justify-center text-center text-gray-500 border p-3 rounded-md bg-gray-50">
                <div>
                    <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="font-semibold text-lg">Sélectionnez un match</p>
                    <p>Choisissez une conversation pour voir les messages.</p>
                </div>
             </div>
          )}
        </div>
      </div>
    </>
  );
}

export default MessagesPrives;