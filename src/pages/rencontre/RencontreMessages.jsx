import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare, Loader2, XCircle, Image as ImageIcon, Mic, Square, X } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import MediaDisplay from '@/components/MediaDisplay';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from "@/components/ui/input";
import { Send } from 'lucide-react';
import { uploadAudioFile } from '@/utils/audioStorage';
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
  const listRef = useRef(null);
  const endRef = useRef(null);
  const mediaInputRef = useRef(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const mimeRef = useRef(null);

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

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) {
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } catch {
        el.scrollTop = el.scrollHeight;
      }
    }
    if (endRef.current && typeof endRef.current.scrollIntoView === 'function') {
      try { endRef.current.scrollIntoView({ behavior: 'smooth' }); } catch {}
    }
  }, []);

  useEffect(() => {
    if (!selectedMatch) return;
    scrollToBottom();
  }, [messages, selectedMatch, scrollToBottom]);

  const pickSupportedMime = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('safari')) {
      return { type: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' };
    }
    if (ua.includes('android')) {
      return { type: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' };
    }
    if (window.MediaRecorder?.isTypeSupported?.('audio/webm;codecs=opus')) {
      return { type: 'audio/webm;codecs=opus', ext: 'webm' };
    }
    if (window.MediaRecorder?.isTypeSupported?.('audio/ogg;codecs=opus')) {
      return { type: 'audio/ogg;codecs=opus', ext: 'ogg' };
    }
    return { type: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' };
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreviewUrl(URL.createObjectURL(file));
      setAudioBlob(null);
      setRecordingTime(0);
      mimeRef.current = null;
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreviewUrl(null);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const uploadToBunny = async (file, folder) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const controller = new AbortController();
    const timeoutMs = 60000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, { method: 'POST', body: formData, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { throw new Error("Réponse inattendue du serveur d'upload"); }
    }
    if (!response.ok || !data?.success) {
      const message = data?.message || data?.error || `Erreur d’upload (${response.status})`;
      throw new Error(message);
    }
    return data.url;
  };

  const startRecording = async () => {
    try {
      setAudioBlob(null);
      setRecordingTime(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chosen = pickSupportedMime();
      mimeRef.current = chosen;
      const chunks = [];
      const supportedMimeType = window.MediaRecorder?.isTypeSupported?.(chosen.type) ? chosen.type : undefined;
      const recorder = supportedMimeType ? new MediaRecorder(stream, { mimeType: supportedMimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        clearInterval(recordingIntervalRef.current);
        stream.getTracks().forEach((t) => t.stop());
        await new Promise((r) => setTimeout(r, 200));
        const candidateType = recorder?.mimeType || (chunks[0]?.type) || mimeRef.current?.type || 'audio/mp4';
        const finalType = (candidateType || 'audio/mp4').split(';')[0];
        const blob = new Blob(chunks, { type: finalType });
        setAudioBlob(blob);
        setIsRecording(false);
        mediaRecorderRef.current = null;
      };
      await new Promise((r) => setTimeout(r, 200));
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 60000);
    } catch {
      // ignore
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.requestData?.();
      setTimeout(() => { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); }, 300);
      clearInterval(recordingIntervalRef.current);
    }
  };

  const handleRemoveAudio = () => {
    setAudioBlob(null);
    setRecordingTime(0);
  };

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

  const endMatch = async () => {
    if (!selectedMatch || !myRencontreId) return;
    const { error } = await supabase
      .from('rencontres_matches')
      .update({ ended_at: new Date().toISOString(), ended_by: myRencontreId })
      .eq('id', selectedMatch);
    if (!error) {
      await fetchMatches();
    }
  };

  const sendMessage = async () => {
    if (!selectedMatch || !myRencontreId) return;

    const currentMatch = matches.find(m => m.id === selectedMatch);
    if (!currentMatch) return;
    if (currentMatch.ended_at) return;

    const receiver_id = currentMatch.user1_id === myRencontreId ? currentMatch.user2_id : currentMatch.user1_id;

    try {
      if (audioBlob) {
        const { ext, type } = mimeRef.current || { ext: 'webm', type: audioBlob.type || 'audio/webm' };
        const file = new File([audioBlob], `rencontre-audio-${selectedMatch}-${Date.now()}.${ext}`, { type });
        const { publicUrl } = await uploadAudioFile(file, 'comments_audio');
        const { error } = await supabase.from("messages_rencontres").insert({
          match_id: selectedMatch,
          sender_id: myRencontreId,
          receiver_id,
          content: publicUrl,
        });
        if (error) throw error;
        handleRemoveAudio();
        return;
      }
      if (mediaFile) {
        const url = await uploadToBunny(mediaFile, 'comments');
        const { error } = await supabase.from("messages_rencontres").insert({
          match_id: selectedMatch,
          sender_id: myRencontreId,
          receiver_id,
          content: url,
        });
        if (error) throw error;
        handleRemoveMedia();
        return;
      }

      const content = newMessage.trim();
      if (!content) return;
      const { error } = await supabase.from("messages_rencontres").insert({
        match_id: selectedMatch,
        sender_id: myRencontreId,
        receiver_id,
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
    } catch (e) {
      // ignore for now
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-0 md:p-4 h-[calc(100vh-200px)] min-h-0">
        <div className="col-span-1 border-r pr-4 overflow-y-auto">
          <h2 className="font-bold text-lg mb-2"> Mes matchs</h2>
          {matches.filter((m) => !m.ended_at).map((m) => {
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
          {matches.filter((m) => !m.ended_at).length === 0 && matches.filter((m) => m.ended_at).length === 0 && (
            <div className="text-center text-gray-500 py-16">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-semibold">Aucun match</p>
              <p className="text-sm">Continuez à swiper !</p>
            </div>
          )}

          {matches.filter((m) => m.ended_at).length > 0 && (
            <>
              <h2 className="font-bold text-lg mt-4 mb-2"> Matchs archivés</h2>
              {matches.filter((m) => m.ended_at).map((m) => {
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
                      <p className="text-xs text-gray-500">Archivé {formatDistanceToNow(new Date(m.ended_at), { addSuffix: true, locale: fr })}</p>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        <div className="col-span-1 md:col-span-2 flex flex-col h-full min-h-0 overflow-hidden">
          {selectedMatch ? (
            <>
              {(() => {
                const selectedMatchRow = matches.find(m => m.id === selectedMatch);
                const isEnded = Boolean(selectedMatchRow?.ended_at);
                return (
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">{isEnded ? 'Match archivé' : 'Conversation'}</div>
                    {!isEnded && (
                      <Button variant="outline" size="sm" onClick={endMatch}>
                        <XCircle className="h-4 w-4 mr-1" /> Terminer le match
                      </Button>
                    )}
                  </div>
                );
              })()}
              <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain border p-3 rounded-md bg-gray-50 mb-2">
                {messages.map((msg) => {
                  const text = msg.content || '';
                  const mediaUrl = (/(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|avif|mp4|mov|webm))(\?|$)/i.test(text) ? text : null);
                  const isVideo = mediaUrl ? /(\.mp4|\.mov|\.webm)(\?|$)/i.test(mediaUrl) : false;
                  const audioUrl = (/^https?:\/\/\S+\.(?:m4a|mp3|ogg|webm)(\?|$)/i.test(text) ? text : null);
                  return (
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
                        {audioUrl ? (
                          <audio src={audioUrl} controls className="w-full" preload="metadata" />
                        ) : mediaUrl ? (
                          isVideo ? (
                            <video src={mediaUrl} controls className="w-56 rounded" />
                          ) : (
                            <img src={mediaUrl} alt="media" className="w-40 rounded" />
                          )
                        ) : (
                          <div className="whitespace-pre-wrap break-words">{text}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {(() => {
                const selectedMatchRow = matches.find(m => m.id === selectedMatch);
                const isEnded = Boolean(selectedMatchRow?.ended_at);
                return (
                  <div className="mt-auto">
                    {mediaPreviewUrl ? (
                      <div className="mb-2">
                        {String(mediaFile?.type||'').startsWith('video/') ? (
                          <video src={mediaPreviewUrl} controls className="w-56 rounded" />
                        ) : (
                          <img src={mediaPreviewUrl} alt="preview" className="w-40 rounded" />
                        )}
                        <Button type="button" variant="ghost" size="sm" onClick={handleRemoveMedia} className="mt-1"><X className="h-4 w-4 mr-1" /> Retirer</Button>
                      </div>
                    ) : null}
                    {audioBlob ? (
                      <div className="mb-2 flex items-center gap-2">
                        <audio src={URL.createObjectURL(audioBlob)} controls className="w-full" />
                        <Button type="button" variant="ghost" size="sm" onClick={handleRemoveAudio}><X className="h-4 w-4 mr-1" /> Retirer</Button>
                      </div>
                    ) : null}
                    <div className="flex gap-2 items-center">
                      {!isRecording && !audioBlob && (
                        <Button size="sm" type="button" variant="ghost" onClick={() => mediaInputRef.current?.click()} disabled={isEnded} aria-label="Ajouter média">
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <input type="file" ref={mediaInputRef} accept="image/*,video/*" className="hidden" onChange={handleFileChange} disabled={isEnded || isRecording || !!audioBlob} />
                      {!isRecording && !audioBlob && (
                        <Button size="sm" type="button" variant="ghost" onClick={startRecording} disabled={isEnded} aria-label="Enregistrer audio">
                          <Mic className="h-4 w-4" />
                        </Button>
                      )}
                      {isRecording && (
                        <Button size="sm" type="button" variant="destructive" onClick={stopRecording} aria-label="Arrêter l'enregistrement">
                          <Square className="h-4 w-4" />
                        </Button>
                      )}
                      <div className="text-xs text-gray-600 min-w-[48px]">{isRecording ? `${recordingTime}s` : ''}</div>
                      <Input
                        placeholder={isEnded ? 'Chat terminé' : 'Votre message...'}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isEnded && sendMessage()}
                        onFocus={() => setTimeout(scrollToBottom, 50)}
                        disabled={isEnded}
                      />
                      <Button onClick={sendMessage} disabled={isEnded || (!newMessage.trim() && !mediaFile && !audioBlob)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                        <Send className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                );
              })()}
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