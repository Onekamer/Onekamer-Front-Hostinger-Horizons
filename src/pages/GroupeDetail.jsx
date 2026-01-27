
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
    import { Helmet } from 'react-helmet';
    import { useParams, useNavigate, useLocation } from 'react-router-dom';
    import { Card, CardContent } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { ArrowLeft, Send, Loader2, Heart, Mic, Square, X, Image as ImageIcon, Trash2 } from 'lucide-react';
    import { Textarea } from '@/components/ui/textarea';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import MediaDisplay from '@/components/MediaDisplay';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import DonationDialog from '@/components/DonationDialog';
    import { formatDistanceToNow } from 'date-fns';
    import { fr } from 'date-fns/locale';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import GroupMembers from '@/pages/groupes/GroupMembers';
    import GroupAdmin from '@/pages/groupes/GroupAdmin';
    import { uploadAudioFile } from '@/utils/audioStorage';
    import { notifyGroupMessage } from '@/services/oneSignalNotifications';

    const AudioPlayer = ({ src, initialDuration = 0 }) => {
      const audioRef = useRef(null);
      const [isPlaying, setIsPlaying] = useState(false);
      const [duration, setDuration] = useState(initialDuration);
      const [currentTime, setCurrentTime] = useState(0);
      const [isLoading, setIsLoading] = useState(true);

      const togglePlayPause = () => {
        if (!audioRef.current) return;
        if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
        setIsPlaying(!isPlaying);
      };

      useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const setAudioData = () => {
          if (isFinite(audio.duration)) setDuration(audio.duration);
          setCurrentTime(audio.currentTime);
          setIsLoading(false);
        };
        const setAudioTime = () => setCurrentTime(audio.currentTime);
        audio.addEventListener('loadeddata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', () => setIsPlaying(false));
        audio.addEventListener('canplaythrough', () => setIsLoading(false));
        if (audio.readyState >= 2) setAudioData();
        return () => {
          audio.removeEventListener('loadeddata', setAudioData);
          audio.removeEventListener('timeupdate', setAudioTime);
          audio.removeEventListener('ended', () => setIsPlaying(false));
          audio.removeEventListener('canplaythrough', () => setIsLoading(false));
        };
      }, [src]);

      const formatTime = (t) => {
        if (isNaN(t) || t === Infinity) return '0:00';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };

      return (
        <div className="flex items-center gap-2 bg-gray-200 rounded-full p-2 mt-2">
          <audio ref={audioRef} src={src} preload="metadata"></audio>
          <Button onClick={togglePlayPause} size="icon" className="rounded-full w-8 h-8" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : (isPlaying ? '❚❚' : '▶')}
          </Button>
          <div className="w-full bg-gray-300 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(currentTime / duration) * 100 || 0}%` }}></div>
          </div>
          <span className="text-xs text-gray-600 w-20 text-center">{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
      );
    };

    const MessageItem = ({ msg, currentUserId, groupId, onActionComplete }) => {
      const { user, onlineUserIds } = useAuth();
      const { toast } = useToast();
      const [isLiked, setIsLiked] = useState(false);
      const [likesCount, setLikesCount] = useState(msg.likes_count || 0);

      const checkLiked = useCallback(async () => {
        if (!user || !msg.message_id) return;
        const { data, error } = await supabase
          .from('group_message_likes')
          .select('id')
          .eq('message_id', msg.message_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          setIsLiked(true);
        }
      }, [user, msg.message_id]);
      
      useEffect(() => {
        if (!msg.is_system_message) {
          checkLiked();
        }
      }, [checkLiked, msg.is_system_message]);

      const handleLike = async () => {
        if (!user || !msg.message_id) {
          toast({ title: 'Connectez-vous pour aimer ce message.', variant: 'destructive'});
          return;
        }

        const currentlyLiked = isLiked;
        setIsLiked(!currentlyLiked);
        setLikesCount(prev => currentlyLiked ? prev - 1 : prev + 1);

        if (currentlyLiked) {
          await supabase.from('group_message_likes').delete().match({ message_id: msg.message_id, user_id: user.id });
        } else {
          await supabase.from('group_message_likes').insert({ message_id: msg.message_id, user_id: user.id });
        }
      };
      
      if (msg.is_system_message) {
        return (
          <div className="text-center my-4">
            <p className="text-sm text-green-600 bg-green-100 rounded-full px-3 py-1 inline-block">{msg.message_contenu}</p>
          </div>
        );
      }

      const renderContent = () => {
        const c = msg.message_contenu || '';
        const isHttp = /^https?:\/\//i.test(c);
        const baseImg = 'block w-full rounded-xl max-h-[70vh] object-cover';
        const baseVid = 'block w-full rounded-xl max-h-[70vh] h-auto object-cover';
        const isAudio = /(\.webm$|\.ogg$|\.m4a$|\.mp3$)/i.test((c.split('?')[0] || ''));
        const isImage = /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.avif)(\?|$)/i.test(c);
        const isVideo = /(\.mp4|\.webm|\.ogg|\.mov)(\?|$)/i.test(c);
        if (isHttp) {
          if (isVideo) return <video src={c} controls playsInline className={baseVid} />;
          if (isImage) return <img src={c} alt="Média partagé" className={baseImg} />;
          if (isAudio) return <AudioPlayer src={c} initialDuration={msg.audio_duration || 0} />;
        }
        try {
          const isMediaPath = c && c.includes('/');
          if (isMediaPath) return <MediaDisplay bucket="groupes" path={c} alt="Média partagé" className={`${baseVid} cursor-pointer`} />;
        } catch {}
        return <p className="text-gray-800">{c}</p>;
      };

      const isMyMessage = msg.sender_id === currentUserId;

      const handleDelete = async () => {
        if (!user || !msg.message_id || user.id !== msg.sender_id) return;
        const ok = window.confirm('Supprimer cette publication ?');
        if (!ok) return;
        const { error } = await supabase
          .from('messages_groupes')
          .delete()
          .match({ id: msg.message_id, sender_id: user.id });
        if (error) {
          toast({ title: 'Erreur', description: "Suppression impossible.", variant: 'destructive' });
        } else {
          toast({ title: 'Supprimé', description: 'Votre publication a été supprimée.' });
          onActionComplete?.();
        }
      };

      const isSenderOnline = Boolean(msg?.sender_id && onlineUserIds instanceof Set && onlineUserIds.has(String(msg.sender_id)));

      return (
          <Card id={`group-message-${msg.message_id}`} className="bg-white/80 backdrop-blur-sm border-none shadow-sm mb-4">
              <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar>
                            <AvatarImage src={msg.sender_avatar} />
                            <AvatarFallback>{msg.sender_username?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        {isSenderOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1">
                          <p className="font-bold">{msg.sender_username || 'Utilisateur inconnu'}</p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(msg.message_date), { addSuffix: true, locale: fr })}
                          </p>
                      </div>
                  </div>
                  <div className="mt-3">
                    {renderContent()}
                  </div>
                  <div className="flex items-center gap-4 text-[#6B6B6B] mt-3">
                      <button
                        className={`flex items-center gap-2 hover:text-[#E0222A] transition-colors ${isLiked ? 'text-[#E0222A]' : ''}`}
                        onClick={handleLike}
                      >
                        <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                        <span>{likesCount}</span>
                      </button>
                      {isMyMessage && (
                        <button
                          className="flex items-center gap-2 hover:text-red-600 transition-colors"
                          onClick={handleDelete}
                        >
                          <Trash2 className="h-5 w-5" />
                          <span>Supprimer</span>
                        </button>
                      )}
                      {!isMyMessage && msg.sender_id && (
                        <DonationDialog receiverId={msg.sender_id} receiverName={msg.sender_username} groupId={groupId} onDonationComplete={onActionComplete} />
                      )}
                  </div>
              </CardContent>
          </Card>
      )
    };
    
    const GroupeDetail = () => {
      const { groupId } = useParams();
      const navigate = useNavigate();
      const location = useLocation();
      const { user, session, loading: authLoading } = useAuth();
      const { toast } = useToast();
      const [groupData, setGroupData] = useState([]);
      const [messages, setMessages] = useState([]);
      const [loading, setLoading] = useState(true);
      const [newMessage, setNewMessage] = useState('');
      const [sending, setSending] = useState(false);
      const [joinRequestStatus, setJoinRequestStatus] = useState('idle');
      const [tabValue, setTabValue] = useState('messages');
      const [joinRequests, setJoinRequests] = useState([]);
      const [loadingRequests, setLoadingRequests] = useState(false);
      const [requesterProfiles, setRequesterProfiles] = useState({});
      // Media attach state
      const [mediaFile, setMediaFile] = useState(null);
      const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
      const mediaInputRef = useRef(null);
      // Audio recording state
      const [isRecording, setIsRecording] = useState(false);
      const [audioBlob, setAudioBlob] = useState(null);
      const [recordingTime, setRecordingTime] = useState(0);
      const mediaRecorderRef = useRef(null);
      const audioChunksRef = useRef([]);
      const recorderPromiseRef = useRef(null);
      const mimeRef = useRef(null);
      const recordingIntervalRef = useRef(null);
      const messagesEndRef = useRef(null);
      const scrolledToMsgRef = useRef(false);
      const RAW_API = import.meta.env.VITE_API_URL || '';
      const API_API = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API.replace(/\/+$/, '')}/api`;
    
      const fetchGroupData = useCallback(async () => {
        if (!user || !session) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
            .from('vue_groupes_complete')
            .select('*')
            .eq('groupe_id', groupId)
            .order('message_date', { ascending: true });

        if (error) {
            console.error('Erreur chargement vue:', error);
            toast({ title: 'Erreur', description: 'Groupe introuvable ou erreur de chargement.', variant: 'destructive' });
            navigate('/groupes');
            setLoading(false);
            return;
        }
        
        if (data.length === 0) {
           const { data: groupOnlyData, error: groupOnlyError } = await supabase.from('groupes').select('*').eq('id', groupId).single();
           if(groupOnlyError || !groupOnlyData){
             toast({ title: 'Erreur', description: 'Groupe introuvable.', variant: 'destructive' });
             navigate('/groupes');
             setLoading(false);
             return;
           }
           setGroupData([{
             groupe_id: groupOnlyData.id,
             groupe_nom: groupOnlyData.nom,
             groupe_description: groupOnlyData.description,
             groupe_prive: groupOnlyData.est_prive,
             groupe_fondateur_id: groupOnlyData.fondateur_id,
             groupe_image_url: groupOnlyData.image_url,
           }]);
           setMessages([]);
        } else {
            setGroupData(data);
            const uniqueMessages = new Map();
            data.forEach(row => {
                if (row.message_id && !uniqueMessages.has(row.message_id)) {
                    uniqueMessages.set(row.message_id, row);
                }
            });
            setMessages(Array.from(uniqueMessages.values()));
        }

        setLoading(false);
    }, [groupId, user, session, navigate, toast]);

      useEffect(() => {
        if (!authLoading) {
            if (user && session) {
                fetchGroupData();
            } else {
                navigate('/auth');
            }
        }
      }, [user, session, authLoading, fetchGroupData, navigate]);
    
      useEffect(() => {
        if (!user?.id || !groupId) return;
      
        const channel = supabase
          .channel(`group-realtime-${groupId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages_groupes',
              filter: `groupe_id=eq.${groupId}`,
            },
            async (payload) => {
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', payload.new.sender_id)
                .single();
      
              const newMessage = {
                message_id: payload.new.id,
                message_contenu: payload.new.contenu,
                message_date: payload.new.created_at,
                sender_id: payload.new.sender_id,
                likes_count: 0,
                sender_username: senderProfile?.username,
                sender_avatar: senderProfile?.avatar_url,
                is_system_message: payload.new.is_system_message
              };
      
              setMessages((prev) => [...prev, newMessage]);
              setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            }
          )
          .subscribe();
      
        return () => supabase.removeChannel(channel);
      }, [groupId, user?.id]);

      useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages]);

      useEffect(() => {
        const params = new URLSearchParams(location.search);
        const targetId = params.get('messageId');
        if (!targetId || scrolledToMsgRef.current) return;
        const tryScroll = () => {
          const el = document.getElementById(`group-message-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            scrolledToMsgRef.current = true;
          }
        };
        tryScroll();
        if (!scrolledToMsgRef.current) {
          const t = setTimeout(tryScroll, 400);
          return () => clearTimeout(t);
        }
      }, [location.search, messages]);

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
          // reset audio if any
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
        const timeoutMs = 60000; // 60s pour cold start/connexion mobile
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        try {
          response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, { method: 'POST', body: formData, signal: controller.signal });
        } catch (e) {
          if (e.name === 'AbortError') {
            throw new Error(`Délai dépassé lors de l’upload (${Math.floor(timeoutMs/1000)}s). Réessaie dans quelques secondes.`);
          }
          throw new Error(`Échec réseau vers le serveur d’upload (${import.meta.env.VITE_API_URL}). ${e.message || ''}`.trim());
        } finally {
          clearTimeout(timer);
        }
        const text = await response.text();
        let data = null;
        if (text) {
          try { data = JSON.parse(text); } catch { throw new Error("Réponse inattendue du serveur d'upload"); }
        }
        if (!response.ok || !data?.success) {
          const message = data?.message || data?.error || `Erreur d’upload BunnyCDN (code ${response.status})`;
          throw new Error(message);
        }
        return data.url;
      };

      const startRecording = async () => {
        try {
          setAudioBlob(null);
          setRecordingTime(0);
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const chosenMime = pickSupportedMime();
          mimeRef.current = chosenMime;
          let resolveRecording;
          const recordingDone = new Promise((resolve) => (resolveRecording = resolve));
          recorderPromiseRef.current = recordingDone;
          const supportedMimeType = window.MediaRecorder?.isTypeSupported?.(chosenMime.type) ? chosenMime.type : undefined;
          const recorder = supportedMimeType ? new MediaRecorder(stream, { mimeType: supportedMimeType }) : new MediaRecorder(stream);
          audioChunksRef.current = [];
          recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
          recorder.onerror = (e) => { console.error('MediaRecorder error', e); resolveRecording(null); };
          recorder.onstop = async () => {
            clearInterval(recordingIntervalRef.current);
            stream.getTracks().forEach((t) => t.stop());
            await new Promise((r) => setTimeout(r, 300));
            const finalType = (mimeRef.current?.type || 'audio/webm').split(';')[0];
            const blob = new Blob(audioChunksRef.current, { type: finalType });
            setAudioBlob(blob);
            setIsRecording(false);
            mediaRecorderRef.current = null;
            resolveRecording(blob);
          };
          await new Promise((r) => setTimeout(r, 300));
          recorder.start();
          mediaRecorderRef.current = recorder;
          setIsRecording(true);
          recordingIntervalRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
          setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 120000);
        } catch (err) {
          console.error('Erreur microphone:', err);
          toast({ title: "Erreur microphone", description: "Veuillez autoriser le micro.", variant: "destructive" });
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

      const handleSendMessage = async () => {
        if (!user || sending) return;
        setSending(true);
        // If audio present (or pending), upload audio and send URL
        let finalBlob = audioBlob;
        if (!finalBlob && recorderPromiseRef.current) finalBlob = await recorderPromiseRef.current;

        if (finalBlob) {
          if (!finalBlob || finalBlob.size < 2000) {
            toast({ title: 'Erreur audio', description: "Audio vide ou trop court.", variant: 'destructive' });
            setSending(false);
            return;
          }
          const { ext, type } = mimeRef.current || { ext: 'webm', type: finalBlob.type || 'audio/webm' };
          const file = new File([finalBlob], `group-audio-${user.id}-${Date.now()}.${ext}`, { type });
          try {
            // Align to same bucket/folder as échange communautaire
            const { publicUrl } = await uploadAudioFile(file, 'comments_audio');
            const { data: inserted, error } = await supabase
              .from('messages_groupes')
              .insert({ groupe_id: groupId, sender_id: user.id, contenu: publicUrl })
              .select('id')
              .single();
            if (error) throw error;
            try {
              const recipientIds = (members || [])
                .map((m) => m.user_id)
                .filter((id) => id && id !== user.id);
              if (recipientIds.length) {
                await notifyGroupMessage({
                  recipientIds,
                  actorName: user?.user_metadata?.username || user?.email || 'Un membre',
                  groupName: groupInfo?.groupe_nom,
                  groupId,
                  messageId: inserted?.id,
                  excerpt: 'Message audio',
                });
              }
            } catch (_) {}
            handleRemoveAudio();
            toast({ title: 'Envoyé', description: 'Audio publié.' });
          } catch (e) {
            toast({ title: 'Erreur', description: e.message || 'Envoi audio impossible.', variant: 'destructive' });
          }
          setSending(false);
          return;
        }

        // Media file (image/video)
        if (mediaFile) {
          try {
            const url = await uploadToBunny(mediaFile, 'comments');
            const { data: inserted, error } = await supabase
              .from('messages_groupes')
              .insert({ groupe_id: groupId, sender_id: user.id, contenu: url })
              .select('id')
              .single();
            if (error) throw error;
            try {
              const recipientIds = (members || [])
                .map((m) => m.user_id)
                .filter((id) => id && id !== user.id);
              if (recipientIds.length) {
                await notifyGroupMessage({
                  recipientIds,
                  actorName: user?.user_metadata?.username || user?.email || 'Un membre',
                  groupName: groupInfo?.groupe_nom,
                  groupId,
                  messageId: inserted?.id,
                  excerpt: 'Média partagé',
                });
              }
            } catch (_) {}
            handleRemoveMedia();
            setNewMessage('');
            toast({ title: 'Envoyé', description: 'Média publié.' });
          } catch (e) {
            toast({ title: 'Erreur', description: e.message || 'Envoi média impossible.', variant: 'destructive' });
          }
          setSending(false);
          return;
        }

        if (!newMessage.trim()) { setSending(false); return; }
        const { data: inserted, error } = await supabase
          .from('messages_groupes')
          .insert({ groupe_id: groupId, sender_id: user.id, contenu: newMessage })
          .select('id')
          .single();
        if (error) {
            toast({ title: 'Erreur', description: 'Impossible d\'envoyer le message.', variant: 'destructive' });
        } else {
            setNewMessage('');
            toast({ title: 'Envoyé', description: 'Message publié.' });
            try {
              const recipientIds = (members || [])
                .map((m) => m.user_id)
                .filter((id) => id && id !== user.id);
              if (recipientIds.length) {
                await notifyGroupMessage({
                  recipientIds,
                  actorName: user?.user_metadata?.username || user?.email || 'Un membre',
                  groupName: groupInfo?.groupe_nom,
                  groupId,
                  messageId: inserted?.id,
                  excerpt: newMessage,
                });
              }
            } catch (_) {}
        }
        setSending(false);
      };

      // Deep-link ?tab=demandes → ouvrir l'onglet demandes
      useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'demandes') setTabValue('requests');
      }, [location.search]);

      // Charger les demandes en attente
      const fetchJoinRequests = useCallback(async () => {
        if (!user || !groupId) return;
        try {
          setLoadingRequests(true);
          const { data, error } = await supabase
            .from('group_join_requests')
            .select('id, requester_id, status, created_at')
            .eq('group_id', groupId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
          if (error) {
            console.error('Erreur chargement demandes:', error);
            setJoinRequests([]);
            setRequesterProfiles({});
          } else {
            const requests = data || [];
            setJoinRequests(requests);
            const ids = Array.from(new Set(requests.map(r => r.requester_id).filter(Boolean)));
            if (ids.length > 0) {
              const { data: profs, error: perr } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .in('id', ids);
              if (!perr && Array.isArray(profs)) {
                const map = {};
                for (const p of profs) map[p.id] = { username: p.username, avatar_url: p.avatar_url };
                setRequesterProfiles(map);
              } else {
                setRequesterProfiles({});
              }
            } else {
              setRequesterProfiles({});
            }
          }
        } finally {
          setLoadingRequests(false);
        }
      }, [groupId, user]);

      useEffect(() => {
        if (user && tabValue === 'requests') {
          fetchJoinRequests();
        }
      }, [user, tabValue, fetchJoinRequests]);

      const handleApproveRequest = async (requestId) => {
        if (!user) return;
        try {
          const res = await fetch(`${API_API.replace(/\/$/, '')}/groups/requests/${requestId}/approve`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actorId: user.id })
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || json?.error) throw new Error(json?.error || 'Échec approbation');
          toast({ title: 'Accepté', description: 'Le membre a été ajouté au groupe.' });
          await fetchJoinRequests();
          await fetchGroupData();
        } catch (e) {
          toast({ title: 'Erreur', description: e?.message || 'Action impossible', variant: 'destructive' });
        }
      };

      const handleDenyRequest = async (requestId) => {
        if (!user) return;
        try {
          const res = await fetch(`${API_API.replace(/\/$/, '')}/groups/requests/${requestId}/deny`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actorId: user.id })
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || json?.error) throw new Error(json?.error || 'Échec du refus');
          toast({ title: 'Refusé', description: 'La demande a été refusée.' });
          await fetchJoinRequests();
        } catch (e) {
          toast({ title: 'Erreur', description: e?.message || 'Action impossible', variant: 'destructive' });
        }
      };

      const handleRequestToJoin = async () => {
          if (!user) {
              toast({ title: 'Connectez-vous pour rejoindre un groupe', variant: 'destructive' });
              return;
          }
          setJoinRequestStatus('loading');
          try {
            const res = await fetch(`${API_API.replace(/\/$/, '')}/groups/${groupId}/join-request`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requesterId: user.id })
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || json?.error) throw new Error(json?.error || 'Échec de la demande');
            toast({ title: 'Demande envoyée', description: 'Votre demande a été envoyée au fondateur du groupe.' });
            setJoinRequestStatus('sent');
          } catch (e) {
            toast({ title: 'Erreur', description: e?.message || 'Impossible d\'envoyer la demande', variant: 'destructive' });
            setJoinRequestStatus('error');
          }
      }

      const groupInfo = useMemo(() => groupData?.[0], [groupData]);

      const members = useMemo(() => {
        if (!groupData) return [];
        const uniqueMembers = new Map();
        groupData.forEach(row => {
          if (row.membre_id && !uniqueMembers.has(row.membre_id)) {
            uniqueMembers.set(row.membre_id, {
              user_id: row.membre_id,
              is_admin: row.membre_is_admin,
              role: row.membre_role,
              profile: {
                username: row.membre_username,
                avatar_url: row.membre_avatar
              }
            });
          }
        });
        return Array.from(uniqueMembers.values());
      }, [groupData]);

      const currentUserRole = useMemo(() => {
        if (!groupInfo || !user) return 'guest';
        if (groupInfo.groupe_fondateur_id === user.id) return 'fondateur';
        const member = members.find(m => m.user_id === user.id);
        if (!member) return 'guest';
        if (member.is_admin) return 'admin';
        return 'membre';
      }, [groupInfo, user, members]);

      const isMember = useMemo(() => {
         if (!groupData || !user) return false;
         return groupData.some(row => row.membre_id === user.id);
      }, [groupData, user]);

      // Persister l'état "Demande envoyée" après refresh
      useEffect(() => {
        const checkPending = async () => {
          if (!user || !groupId) return;
          try {
            const { data, error } = await supabase
              .from('group_join_requests')
              .select('id')
              .eq('group_id', groupId)
              .eq('requester_id', user.id)
              .eq('status', 'pending')
              .limit(1);
            if (!error && Array.isArray(data) && data.length > 0) {
              setJoinRequestStatus('sent');
            } else if (!error) {
              setJoinRequestStatus('idle');
            }
          } catch (_) {
            // ne rien faire, garder l'état courant
          }
        };
        checkPending();
      }, [user, groupId]);

      if (loading || authLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
      if (!groupInfo) return null;
    
      if (!isMember) {
        return (
          <>
            <Helmet><title>Rejoindre {groupInfo.groupe_nom}</title></Helmet>
            <Button variant="ghost" onClick={() => navigate('/groupes')} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" /> Retour</Button>
            <Card className="text-center">
              <CardContent className="pt-6">
                <MediaDisplay bucket="groupes" path={groupInfo.groupe_image_url} alt={groupInfo.groupe_nom} className="w-32 h-32 rounded-full object-cover mx-auto mb-4" />
                <h1 className="text-2xl font-bold">{groupInfo.groupe_nom}</h1>
                <p className="mt-4">{groupInfo.groupe_description}</p>
                 <Button 
                    className="mt-6 bg-[#2BA84A]" 
                    onClick={handleRequestToJoin}
                    disabled={joinRequestStatus === 'loading' || joinRequestStatus === 'sent'}
                 >
                    {joinRequestStatus === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {joinRequestStatus === 'sent' ? 'Demande envoyée' : 'Demander à rejoindre'}
                </Button>
              </CardContent>
            </Card>
          </>
        );
      }
    
      return (
        <>
          <Helmet><title>{groupInfo.groupe_nom} - Groupe OneKamer.co</title></Helmet>
          <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex-shrink-0">
              <div className="flex items-center p-3 border-b">
                <Button variant="ghost" size="icon" onClick={() => navigate('/groupes')}><ArrowLeft className="h-5 w-5" /></Button>
                <div className="flex-1 text-center">
                  <h1 className="font-bold text-lg">{groupInfo.groupe_nom}</h1>
                  <p className="text-sm text-gray-500">{members.length} membres</p>
                </div>
                <div className="w-10"></div>
              </div>
            </div>
            
            <Tabs value={tabValue} onValueChange={setTabValue} className="flex-grow flex flex-col overflow-hidden">
              <div className="flex-shrink-0">
                <TabsList className="grid w-full grid-cols-4 mx-auto max-w-md">
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                  <TabsTrigger value="members">Membres</TabsTrigger>
                  {(currentUserRole === 'admin' || currentUserRole === 'fondateur') && <TabsTrigger value="requests">Demandes</TabsTrigger>}
                  {(currentUserRole === 'admin' || currentUserRole === 'fondateur') && <TabsTrigger value="admin">Admin</TabsTrigger>}
                </TabsList>
              </div>
              
              <TabsContent value="messages" className="flex-grow flex flex-col overflow-hidden">
                <div className="flex-grow overflow-y-auto flex flex-col">
                  <div className="p-4 space-y-2">
                    {messages.map(msg => <MessageItem key={msg.message_id} msg={msg} currentUserId={user.id} groupId={groupId} onActionComplete={fetchGroupData} />)}
                    <div ref={messagesEndRef}></div>
                  </div>
                  {isMember && (
                    <div className="flex-shrink-0 p-3 border-t bg-gray-50">
                      <div className="flex items-center gap-2">
                        {isRecording ? (
                          <div className="flex items-center gap-2 w-full bg-gray-100 p-2 rounded-lg">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-sm text-red-500 font-mono">{`${Math.floor(recordingTime/60)}:${String(recordingTime%60).padStart(2,'0')}`}</span>
                          </div>
                        ) : (
                          <Textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Votre message..."
                            className="flex-1 bg-white"
                            rows={1}
                            disabled={!!audioBlob}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                          />
                        )}
                        <Button onClick={handleSendMessage} size="icon" className="bg-[#2BA84A] rounded-full shrink-0" disabled={sending || (!newMessage.trim() && !audioBlob && !recorderPromiseRef.current && !mediaFile)}>
                          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        </Button>
                      </div>
                      {(mediaPreviewUrl || audioBlob) && (
                        <div className="relative p-2 bg-gray-100 rounded-lg mt-2">
                          {mediaPreviewUrl && mediaFile?.type?.startsWith('image') ? (
                            <img src={mediaPreviewUrl} alt="preview" className="w-24 h-24 rounded object-cover" />
                          ) : mediaPreviewUrl ? (
                            <video src={mediaPreviewUrl} controls className="w-full rounded object-cover" />
                          ) : audioBlob ? (
                            <AudioPlayer src={URL.createObjectURL(audioBlob)} />
                          ) : null}
                          <Button size="icon" variant="destructive" onClick={mediaPreviewUrl ? handleRemoveMedia : handleRemoveAudio} className="absolute -top-1 -right-1 h-5 w-5 rounded-full"><X className="h-3 w-3" /></Button>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        {!isRecording && !audioBlob && (
                          <Button size="sm" type="button" variant="ghost" onClick={() => mediaInputRef.current?.click()} disabled={!!audioBlob}>
                            <ImageIcon className="h-4 w-4 mr-2" /> Image/Vidéo
                          </Button>
                        )}
                        <input type="file" ref={mediaInputRef} accept="image/*,video/*" className="hidden" onChange={handleFileChange} disabled={isRecording || !!audioBlob} />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="members" className="flex-grow overflow-y-auto p-4">
                <GroupMembers members={members} currentUserRole={currentUserRole} currentUserId={user.id} groupId={groupId} onMemberUpdate={fetchGroupData} />
              </TabsContent>

              {(currentUserRole === 'admin' || currentUserRole === 'fondateur') && (
                <TabsContent value="requests" className="flex-grow overflow-y-auto p-4">
                  {loadingRequests ? (
                    <div className="flex justify-center items-center h-32"><Loader2 className="h-6 w-6 animate-spin"/></div>
                  ) : (
                    <div className="space-y-3">
                      {joinRequests.length === 0 ? (
                        <p className="text-gray-500 text-center">Aucune demande en attente.</p>
                      ) : (
                        joinRequests.map((r) => {
                          const prof = requesterProfiles[r.requester_id] || {};
                          return (
                            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={prof.avatar_url} />
                                  <AvatarFallback>{(prof.username?.[0] || 'U').toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold">{prof.username || 'Utilisateur'}</p>
                                  <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => navigate(`/profil/${r.requester_id}`)}>Profil</Button>
                                <Button size="sm" className="bg-[#2BA84A]" onClick={() => handleApproveRequest(r.id)}>Accepter</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDenyRequest(r.id)}>Refuser</Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </TabsContent>
              )}

              {(currentUserRole === 'admin' || currentUserRole === 'fondateur') && (
                <TabsContent value="admin" className="flex-grow overflow-y-auto p-4">
                  <GroupAdmin group={{...groupInfo, id: groupInfo.groupe_id, fondateur_id: groupInfo.groupe_fondateur_id, groupes_membres: members}} onGroupUpdate={fetchGroupData}/>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </>
      );
    };
    
    export default GroupeDetail;

