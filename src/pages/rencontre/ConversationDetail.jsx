import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Loader2, XCircle, Image as ImageIcon, Mic, Square, X } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import MediaDisplay from '@/components/MediaDisplay';
import { useToast } from '@/components/ui/use-toast';
import { uploadAudioFile } from '@/utils/audioStorage';
import { notifyRencontreMessage } from '@/services/oneSignalNotifications';

const ConversationDetail = () => {
  const { conversationId: matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [myRencontreId, setMyRencontreId] = useState(null);
  const [myRencontreProfile, setMyRencontreProfile] = useState(null);
  const [matchMeta, setMatchMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const mediaInputRef = useRef(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const mimeRef = useRef(null);
  const recorderPromiseRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversationDetails = useCallback(async () => {
    if (!user || !matchId) return;
    setLoading(true);

    const { data: myProfileData } = await supabase
      .from('rencontres')
      .select('id, user_id, name')
      .eq('user_id', user.id)
      .single();
    if (myProfileData) {
      setMyRencontreId(myProfileData.id);
      setMyRencontreProfile(myProfileData);
    }

    const { data: matchData, error: matchError } = await supabase
      .from('rencontres_matches')
      .select('id, ended_at, ended_by, user1:rencontres!user1_id(id, user_id, name, image_url, photos), user2:rencontres!user2_id(id, user_id, name, image_url, photos)')
      .eq('id', matchId)
      .single();

    if (matchError || !matchData) {
      setLoading(false);
      return;
    }

    const other = matchData.user1.user_id === user.id ? matchData.user2 : matchData.user1;
    setOtherUser(other);
    setMatchMeta({ id: matchId, ended_at: matchData.ended_at, ended_by: matchData.ended_by });

    const { data: messagesData, error: messagesError } = await supabase
      .from('messages_rencontres')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (!messagesError) {
      setMessages(messagesData);
    }
    setLoading(false);
  }, [user, matchId]);

  useEffect(() => {
    fetchConversationDetails();
  }, [fetchConversationDetails]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const pickSupportedMime = useCallback(() => {
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
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreviewUrl(URL.createObjectURL(file));
      setAudioBlob(null);
      setRecordingTime(0);
      recorderPromiseRef.current = null;
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
      let resolveRecording;
      const recordingDone = new Promise((resolve) => (resolveRecording = resolve));
      recorderPromiseRef.current = recordingDone;
      const supportedMimeType = window.MediaRecorder?.isTypeSupported?.(chosen.type) ? chosen.type : undefined;
      const recorder = supportedMimeType ? new MediaRecorder(stream, { mimeType: supportedMimeType }) : new MediaRecorder(stream);
      const chunks = [];
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
        resolveRecording(blob);
      };
      await new Promise((r) => setTimeout(r, 200));
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 60000);
    } catch (err) {
      toast({ title: 'Erreur microphone', description: 'Veuillez autoriser le micro.', variant: 'destructive' });
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
    recorderPromiseRef.current = null;
    mimeRef.current = null;
  };

  useEffect(() => {
    if (!user || !matchId || !myRencontreId) return;

    const channel = supabase
      .channel(`rencontre_chat_${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages_rencontres',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
        setMessages(currentMessages => [...currentMessages, payload.new]);
        if (payload.new.receiver_id === myRencontreId) {
            toast({
                title: "💌 Nouveau message",
                description: `De ${otherUser?.name || 'votre match'}.`,
            });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, matchId, myRencontreId, otherUser, toast]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!user || !otherUser || !myRencontreId || matchMeta?.ended_at) return;
    const trimmed = newMessage.trim();

    try {
      if (audioBlob) {
        const { ext, type } = mimeRef.current || { ext: 'webm', type: audioBlob.type || 'audio/webm' };
        const file = new File([audioBlob], `rencontre-audio-${matchId}-${Date.now()}.${ext}`, { type });
        const { publicUrl } = await uploadAudioFile(file, 'comments_audio');
        const insert = { match_id: matchId, sender_id: myRencontreId, receiver_id: otherUser.id, content: publicUrl };
        const { error } = await supabase.from('messages_rencontres').insert(insert);
        if (error) throw error;
        handleRemoveAudio();
        try {
          await notifyRencontreMessage({
            recipientId: otherUser.user_id,
            senderName: myRencontreProfile?.name || user?.user_metadata?.full_name || user?.email || 'Un membre OneKamer',
            message: 'Message audio',
            matchId,
          });
        } catch {}
        return;
      }

      if (mediaFile) {
        const url = await uploadToBunny(mediaFile, 'comments');
        const insert = { match_id: matchId, sender_id: myRencontreId, receiver_id: otherUser.id, content: url };
        const { error } = await supabase.from('messages_rencontres').insert(insert);
        if (error) throw error;
        handleRemoveMedia();
        try {
          await notifyRencontreMessage({
            recipientId: otherUser.user_id,
            senderName: myRencontreProfile?.name || user?.user_metadata?.full_name || user?.email || 'Un membre OneKamer',
            message: 'Média partagé',
            matchId,
          });
        } catch {}
        return;
      }

      if (!trimmed) return;
      const message = { match_id: matchId, sender_id: myRencontreId, receiver_id: otherUser.id, content: trimmed };
      setNewMessage('');
      const { error } = await supabase.from('messages_rencontres').insert(message);
      if (error) {
        setNewMessage(message.content);
      } else {
        try {
          await notifyRencontreMessage({
            recipientId: otherUser.user_id,
            senderName: myRencontreProfile?.name || user?.user_metadata?.full_name || user?.email || 'Un membre OneKamer',
            message: trimmed,
            matchId,
          });
        } catch {}
      }
    } catch (err) {
      toast({ title: 'Erreur', description: err?.message || 'Envoi impossible', variant: 'destructive' });
    }
  };

  const endMatch = async () => {
    if (!matchId || !myRencontreId) return;
    const { error } = await supabase
      .from('rencontres_matches')
      .update({ ended_at: new Date().toISOString(), ended_by: myRencontreId })
      .eq('id', matchId);
    if (!error) {
      setMatchMeta((prev) => ({ ...(prev || {}), ended_at: new Date().toISOString(), ended_by: myRencontreId }));
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>;
  }

  if (!otherUser) {
    return (
      <div className="text-center py-12">
        <p>Conversation non trouvée.</p>
        <Button onClick={() => navigate('/rencontre/messages')}>Retour aux messages</Button>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Conversation avec {otherUser.name} - OneKamer.co</title>
      </Helmet>
      <div className="flex flex-col h-[calc(100vh-130px)] max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
        <header className="flex items-center p-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="w-10 h-10 mr-3">
            {otherUser.image_url ? (
              <MediaDisplay
                bucket="avatars"
                path={otherUser.image_url}
                alt={otherUser.name}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <AvatarFallback>{otherUser.name?.charAt(0)}</AvatarFallback>
            )}
          </Avatar>
          <h2 className="font-bold text-lg">{otherUser.name}</h2>
          <div className="ml-auto">
            {!matchMeta?.ended_at ? (
              <Button variant="outline" size="sm" onClick={endMatch}>
                <XCircle className="h-4 w-4 mr-1" /> Terminer le match
              </Button>
            ) : (
              <span className="text-sm text-gray-600">Match archivé</span>
            )}
          </div>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50">
          {messages.map(msg => {
            const text = msg.content || '';
            const mediaUrl = /(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|avif|mp4|mov|webm))(\?|$)/i.test(text) ? text : null;
            const isVideo = mediaUrl ? /(\.mp4|\.mov|\.webm)(\?|$)/i.test(mediaUrl) : false;
            const audioUrl = /^https?:\/\/\S+\.(?:m4a|mp3|ogg|webm)(\?|$)/i.test(text) ? text : null;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.sender_id === myRencontreId ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                  msg.sender_id === myRencontreId
                  ? 'bg-green-500 text-white rounded-br-none' 
                  : 'bg-gray-200 text-gray-800 rounded-bl-none'
                }`}>
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
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-3 border-t bg-white">
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
          <div className="flex items-center gap-2">
            {!isRecording && !audioBlob && (
              <Button size="sm" type="button" variant="ghost" onClick={() => mediaInputRef.current?.click()} disabled={Boolean(matchMeta?.ended_at)} aria-label="Ajouter média">
                <ImageIcon className="h-4 w-4" />
              </Button>
            )}
            <input type="file" ref={mediaInputRef} accept="image/*,video/*" className="hidden" onChange={handleFileChange} disabled={Boolean(matchMeta?.ended_at) || isRecording || !!audioBlob} />
            {!isRecording && !audioBlob && (
              <Button size="sm" type="button" variant="ghost" onClick={startRecording} disabled={Boolean(matchMeta?.ended_at)} aria-label="Enregistrer audio">
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
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={matchMeta?.ended_at ? 'Chat terminé' : 'Écrivez un message...'}
              className="flex-1"
              disabled={Boolean(matchMeta?.ended_at)}
            />
            <Button type="submit" disabled={Boolean(matchMeta?.ended_at) || (!newMessage.trim() && !mediaFile && !audioBlob)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ConversationDetail;