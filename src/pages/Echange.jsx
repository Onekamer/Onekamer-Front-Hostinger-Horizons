
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, Send, Loader2, Trash2, Image as ImageIcon, X, Coins, Mic, Square, Play, Pause } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import CreatePost from '@/components/posts/CreatePost';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { getInitials } from '@/lib/utils';
import { uploadAudioFile, ensurePublicAudioUrl } from '@/utils/audioStorage';
import { notifyDonationReceived, notifyPostLiked, notifyPostCommented } from '@/services/oneSignalNotifications';

const normalizeAudioEntry = (entry) => {
  if (!entry || !entry.audio_url) return entry;
  return { ...entry, audio_url: ensurePublicAudioUrl(entry.audio_url) };
};

const parseMentions = (text) => {
  if (!text) return '';
  const mentionRegex = /@(\w+)/g;
  const parts = text.split(mentionRegex);
  
  return parts.map((part, index) => {
    if (index % 2 === 1) { // It's a username
      return <span key={index} className="mention">@{part}</span>;
    }
    return part;
  });
};

const UserAvatar = ({ avatarUrl, username, className }) => {
  const [showFallback, setShowFallback] = useState(!avatarUrl);

  useEffect(() => {
    setShowFallback(!avatarUrl);
  }, [avatarUrl]);

  const initials = getInitials(username);

  if (showFallback) {
    return (
      <div className={`flex items-center justify-center rounded-full bg-gradient-to-br from-[#2BA84A] to-[#F5C300] text-white font-bold ${className}`}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={username || 'avatar'}
      className={`rounded-full object-cover ${className}`}
      onError={() => setShowFallback(true)}
    />
  );
};

const DonationDialog = ({ post, user, profile, refreshBalance, children }) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [anonymous, setAnonymous] = useState(false);

  const handleDonation = async (e) => {
    e.preventDefault();
    const donationAmount = parseInt(amount);
    if (!donationAmount || donationAmount <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      // Appel RPC v2 avec anonymat, fallback si indisponible
      let rpcErr = null;
      try {
        const { error } = await supabase.rpc('make_donation_with_ledger_v2', {
          sender: user.id,
          receiver: post.user_id,
          amount: donationAmount,
          msg: message,
          anonymous,
        });
        if (error) rpcErr = error;
      } catch (e) {
        rpcErr = e;
      }

      if (rpcErr) {
        const msg = String(rpcErr?.message || '');
        if (/does not exist|No function matches|not found/i.test(msg)) {
          const { error: fb } = await supabase.rpc('make_donation_with_ledger', {
            sender: user.id,
            receiver: post.user_id,
            amount: donationAmount,
            msg: message,
          });
          if (fb) throw new Error(fb.message);
        } else {
          throw new Error(msg);
        }
      }

      const donorDisplay = anonymous ? 'Un membre' : (profile.username || 'Un membre');
      const postContent = `🎉 ${donorDisplay} a fait un don de ${donationAmount} OK Coins à ${post.profiles.username} ! Merci pour cette générosité qui fait vivre la communauté. 💚`;
      await supabase.from('posts').insert({
        user_id: user.id,
        content: postContent,
        likes_count: 0,
        comments_count: 0
      });

      toast({ title: "Don envoyé !", description: `Vous avez envoyé ${donationAmount} pièces.` });
      if (post?.user_id) {
        try {
          await notifyDonationReceived({
            receiverId: post.user_id,
            senderName: anonymous ? 'Un membre OneKamer' : (profile?.username || user?.email || 'Un membre OneKamer'),
            amount: donationAmount,
          });
        } catch (notificationError) {
          console.error('Erreur notification OneSignal (don):', notificationError);
        }
      }
      await refreshBalance();
      setOpen(false);
      setAmount('');
      setMessage('');
      setAnonymous(false);
    } catch (error) {
      toast({ title: "Erreur de don", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleDonation}>
          <DialogHeader>
            <DialogTitle>Faire un don à {post.profiles?.username}</DialogTitle>
            <DialogDescription>Montrez votre appréciation pour cette publication !</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">Montant</Label>
              <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} className="col-span-3" placeholder="Nombre de pièces" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="message" className="text-right">Message</Label>
              <Input id="message" value={message} onChange={e => setMessage(e.target.value)} className="col-span-3" placeholder="Message (optionnel)" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <div />
              <div className="col-span-3 flex items-center space-x-2">
                <Checkbox id="anonymous" checked={anonymous} onCheckedChange={(v) => setAnonymous(Boolean(v))} />
                <Label htmlFor="anonymous">Don anonyme (votre nom ne sera pas affiché)</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AudioPlayer = ({ src, initialDuration = 0, mimeType }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(initialDuration);
    const [currentTime, setCurrentTime] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (audio) {
            const setAudioData = () => {
                if (isFinite(audio.duration)) {
                    setDuration(audio.duration);
                }
                setCurrentTime(audio.currentTime);
                setIsLoading(false);
            };
            const setAudioTime = () => setCurrentTime(audio.currentTime);
            const onError = () => setIsLoading(false);

            audio.addEventListener('loadedmetadata', setAudioData);
            audio.addEventListener('loadeddata', setAudioData);
            audio.addEventListener('timeupdate', setAudioTime);
            audio.addEventListener('ended', () => setIsPlaying(false));
            audio.addEventListener('canplaythrough', () => setIsLoading(false));
            audio.addEventListener('error', onError);

            try { audio.load?.(); } catch (_) {}
            if (audio.readyState >= 1) {
                setAudioData();
            }

            return () => {
                audio.removeEventListener('loadedmetadata', setAudioData);
                audio.removeEventListener('loadeddata', setAudioData);
                audio.removeEventListener('timeupdate', setAudioTime);
                audio.removeEventListener('ended', () => setIsPlaying(false));
                audio.removeEventListener('canplaythrough', () => setIsLoading(false));
                audio.removeEventListener('error', onError);
            };
        }
    }, [src]);

    const formatTime = (time) => {
        if (isNaN(time) || time === Infinity) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const displayDuration = duration > 0 ? duration : initialDuration;

    return (
        <div className="flex items-center gap-2 bg-gray-200 rounded-full p-2 mt-2">
            <audio ref={audioRef} preload="auto" playsInline>
              {mimeType ? (
                <source src={src} type={(mimeType || '').split(';')[0]} />
              ) : (
                <source src={src} />
              )}
            </audio>
            <Button onClick={togglePlayPause} size="icon" className="rounded-full w-8 h-8" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />)}
            </Button>
            <div className="w-full bg-gray-300 rounded-full h-1.5">
                <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${(currentTime / displayDuration) * 100 || 0}%` }}
                ></div>
            </div>
            <span className="text-xs text-gray-600 w-20 text-center">{formatTime(currentTime)} / {formatTime(displayDuration)}</span>
        </div>
    );
};

const CommentMedia = ({ url, type }) => {
    if (!url) return null;

    if (type && type.startsWith('image')) {
        return (
            <img
                src={url}
                alt="Comment media"
                className="rounded-lg max-h-40 mt-2"
                onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "https://onekamer-media-cdn.b-cdn.net/posts/default_post_image.png";
                }}
            />
        );
    }
    if (type && type.startsWith('video')) {
        return <video src={url} controls className="rounded-lg max-h-40 mt-2" />;
    }
    return null; // Audio is handled separately
};

const CommentAvatar = ({ avatarPath, username, userId }) => {
  const { onlineUserIds } = useAuth();
  const isOnline = Boolean(userId && onlineUserIds instanceof Set && onlineUserIds.has(String(userId)));
  return (
    <div className="relative">
      <UserAvatar avatarUrl={avatarPath} username={username} className="w-8 h-8" />
      {isOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
      )}
    </div>
  );
};

const CommentSection = ({ postId, postOwnerId, authorName, postContent, audioParentId, refreshBalance, highlightCommentId }) => {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const mediaInputRef = useRef(null);
  const navigate = useNavigate();
  const [replyTo, setReplyTo] = useState(null);
  const [replyToUser, setReplyToUser] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recorderPromiseRef = useRef(null);
  const mimeRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const lastRecordingTimeRef = useRef(0);
  const recordedDurationRef = useRef(0);

  const getBlobDuration = useCallback((blob, fallback = 0) => {
    if (!blob) return Promise.resolve(fallback);

    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = url;

      let resolved = false;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        audio.src = '';
      };

      const finish = (value) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        const numeric = Number(value);
        resolve(Number.isFinite(numeric) && numeric > 0 ? numeric : fallback);
      };

      audio.onloadedmetadata = () => finish(audio.duration);
      audio.onerror = () => finish(fallback);

      setTimeout(() => finish(fallback), 4000);
    });
  }, []);

  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      if (audioParentId) {
        const { data: roots, error: rerr } = await supabase
          .from('comments')
          .select(`
            id,
            content,
            created_at,
            media_url,
            media_type,
            user_id,
            audio_url,
            audio_duration,
            type,
            parent_comment_id,
            author:profiles ( id, username, avatar_url, is_deleted )
          `)
          .eq('content_type', 'echange')
          .eq('parent_comment_id', audioParentId)
          .order('created_at', { ascending: true });

        if (rerr) throw rerr;
        const rootIds = (roots || []).map((c) => c.id);
        let children = [];
        if (rootIds.length > 0) {
          const { data: kids, error: kerr } = await supabase
            .from('comments')
            .select(`
              id,
              content,
              created_at,
              media_url,
              media_type,
              user_id,
              audio_url,
              audio_duration,
              type,
              parent_comment_id,
              author:profiles ( id, username, avatar_url, is_deleted )
            `)
            .eq('content_type', 'echange')
            .in('parent_comment_id', rootIds)
            .order('created_at', { ascending: true });
          if (kerr) throw kerr;
          children = kids || [];
        }
        const normalized = [...(roots || []), ...(children || [])].map((c) => normalizeAudioEntry(c));
        const normalized2 = normalized.map((c) => {
          const a = c?.author;
          if (a && a.is_deleted === true) {
            return { ...c, author: { ...a, username: 'Compte supprimé', avatar_url: null, id: null } };
          }
          return c;
        });
        setComments(normalized2);
      } else {
        const { data, error } = await supabase
          .from('comments')
          .select(`
            id,
            content,
            created_at,
            media_url,
            media_type,
            user_id,
            audio_url,
            audio_duration,
            type,
            parent_comment_id,
            author:profiles ( id, username, avatar_url, is_deleted )
          `)
          .eq('content_id', postId)
          .eq('content_type', 'post')
          .order('created_at', { ascending: true });
        if (error) throw error;
        const normalized = (data || []).map((comment) => normalizeAudioEntry(comment));
        const normalized2 = normalized.map((c) => {
          const a = c?.author;
          if (a && a.is_deleted === true) {
            return { ...c, author: { ...a, username: 'Compte supprimé', avatar_url: null, id: null } };
          }
          return c;
        });
        setComments(normalized2);
      }
    } catch (e) {
      console.error('Erreur chargement commentaires :', e.message || e);
    }
    setLoadingComments(false);
  }, [postId, audioParentId]);

  useEffect(() => {
    fetchComments();
    if (audioParentId) {
      const channel = supabase
        .channel(`comments-audio-root-${audioParentId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'comments', filter: `parent_comment_id=eq.${audioParentId}` },
          async (payload) => {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, username, avatar_url, is_deleted')
              .eq('id', payload.new.user_id)
              .single();
            const authorRaw = profileData || { username: 'Anonyme', avatar_url: null };
            const author = authorRaw?.is_deleted ? { ...authorRaw, username: 'Compte supprimé', avatar_url: null, id: null } : authorRaw;
            const resolved = normalizeAudioEntry({ ...payload.new, author });
            setComments((prev) => [...prev, resolved]);
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else {
      const channel = supabase
        .channel(`comments-post-${postId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'comments', filter: `content_id=eq.${postId}` },
          async (payload) => {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, username, avatar_url, is_deleted')
              .eq('id', payload.new.user_id)
              .single();
            const authorRaw = profileData || { username: 'Anonyme', avatar_url: null };
            const author = authorRaw?.is_deleted ? { ...authorRaw, username: 'Compte supprimé', avatar_url: null, id: null } : authorRaw;
            const resolved = normalizeAudioEntry({ ...payload.new, author });
            setComments((prev) => [...prev, resolved]);
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [postId, audioParentId, fetchComments]);
  
  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreviewUrl(null);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if(file){
      setMediaFile(file);
      setMediaPreviewUrl(URL.createObjectURL(file));
      setAudioBlob(null);
    }
  }
  
    const pickSupportedMime = useCallback(() => {
  const ua = navigator.userAgent.toLowerCase();

  // ✅ iOS / Safari ou PWA iPhone
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("safari")) {
    return { type: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" };
  }

  // ✅ Android (Chrome / Edge / PWA)
  if (ua.includes("android")) {
    return { type: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" };
  }

  // ✅ Desktop (Chrome / Edge)
  if (window.MediaRecorder?.isTypeSupported("audio/webm;codecs=opus")) {
    return { type: "audio/webm;codecs=opus", ext: "webm" };
  }

  // ✅ Desktop (Firefox)
  if (window.MediaRecorder?.isTypeSupported("audio/ogg;codecs=opus")) {
    return { type: "audio/ogg;codecs=opus", ext: "ogg" };
  }

  // 🔙 Fallback universel
  return { type: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" };
}, []);

    const startRecording = async () => {
  try {
    console.log("🎙️ Initialisation de l'enregistrement...");
    setAudioBlob(null);
    setRecordingTime(0);
    lastRecordingTimeRef.current = 0;
    recordedDurationRef.current = 0;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("✅ Micro autorisé :", stream.getAudioTracks().length, "piste(s)");

    const chosenMime = pickSupportedMime();
    mimeRef.current = chosenMime;

    let resolveRecording;
    const recordingDone = new Promise(resolve => (resolveRecording = resolve));
    recorderPromiseRef.current = recordingDone;
    const supportedMimeType = window.MediaRecorder?.isTypeSupported?.(chosenMime.type)
      ? chosenMime.type
      : undefined;

    console.log("🎚️ Type MIME utilisé :", supportedMimeType || '(auto)');

    const recorder = supportedMimeType
      ? new MediaRecorder(stream, { mimeType: supportedMimeType })
      : new MediaRecorder(stream);
    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      } else {
        console.warn("⚠️ Chunk vide détecté !");
      }
    };

    recorder.onerror = (event) => {
      console.error("❌ Erreur MediaRecorder :", event.error || event);
      toast({
        title: "Erreur d'enregistrement",
        description: "Une erreur est survenue pendant la capture audio.",
        variant: "destructive",
      });
      resolveRecording?.(null);
      recorderPromiseRef.current = null;
    };

    recorder.onstop = async () => {
      console.log("🛑 Enregistrement terminé, création du blob...");
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
      stream.getTracks().forEach((t) => t.stop());

      await new Promise((resolve) => setTimeout(resolve, 300));

      const candidateType = (
        recorder?.mimeType ||
        (audioChunksRef.current && audioChunksRef.current[0]?.type) ||
        mimeRef.current?.type ||
        'audio/mp4'
      );
      const finalType = (candidateType || 'audio/mp4').split(';')[0];
      const audioBlob = new Blob(audioChunksRef.current, { type: finalType });
      console.log("💾 Taille finale du blob :", audioBlob.size, "octets");

      const fallbackDuration = Math.max(1, lastRecordingTimeRef.current || recordingTime);
      const measuredDuration = await getBlobDuration(audioBlob, fallbackDuration);
      const normalizedDuration = Math.max(1, Math.round(measuredDuration || fallbackDuration));
      console.log("⏱️ Durée mesurée :", normalizedDuration, "sec");

      setRecordingTime(normalizedDuration);
      recordedDurationRef.current = normalizedDuration;
      lastRecordingTimeRef.current = normalizedDuration;
      setAudioBlob(audioBlob);
      setMediaFile(null);
      setMediaPreviewUrl(null);
      setIsRecording(false);
      mediaRecorderRef.current = null;
      resolveRecording(audioBlob);
      recorderPromiseRef.current = Promise.resolve(audioBlob);
    };

    // ⚡ Fix mobile : attendre un court délai avant démarrage
    await new Promise((r) => setTimeout(r, 300));

    // ✅ Important : pas de timeslice ici (start sans paramètre)
    recorder.start();
    console.log("⏺️ Enregistrement démarré avec format :", supportedMimeType);

    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime((prev) => {
        const next = prev + 1;
        lastRecordingTimeRef.current = next;
        return next;
      });
    }, 1000);

    // ⏹️ Auto-stop après 120 secondes
    setTimeout(() => {
      if (recorder.state !== "inactive") {
        console.log("⏹️ Arrêt automatique après 120s.");
        recorder.stop();
      }
    }, 60000);
  } catch (error) {
    console.error("❌ Erreur d'accès micro :", error);
    toast({
      title: "Erreur microphone",
      description: "Veuillez autoriser le micro dans votre navigateur.",
      variant: "destructive",
    });
    recorderPromiseRef.current = null;
    recordedDurationRef.current = 0;
  }
};

  const stopRecording = () => {
  console.log("🧭 Arrêt manuel de l'enregistrement...");
  
  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
    try {
      // Demande le dernier chunk avant de stopper
      mediaRecorderRef.current.requestData?.();

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          console.log("⏹️ Enregistrement stoppé par l'utilisateur.");
          mediaRecorderRef.current.stop();
        }
      }, 500); // petit délai pour laisser le dernier fragment audio arriver
    } catch (error) {
      console.error("❌ Erreur à l'arrêt de l'enregistrement :", error);
    } finally {
      // Nettoyage du timer de durée
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  } else {
    console.warn("⚠️ Aucun enregistrement actif à arrêter.");
  }
};

    
    const formatRecordingTime = (time) => {
      const minutes = Math.floor(time / 60);
      const seconds = time % 60;
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
    
    const handleRemoveAudio = () => {
        setAudioBlob(null);
        setRecordingTime(0);
        lastRecordingTimeRef.current = 0;
        recordedDurationRef.current = 0;
        recorderPromiseRef.current = null;
        mimeRef.current = null;
    };
  
  const uploadToBunny = async (file, folder) => {
    console.log('[Echange] uploadToBunny start', { name: file?.name, type: file?.type, folder });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    }).catch((e) => {
      if (e.name === 'AbortError') {
        console.warn('[Echange] uploadToBunny aborted by timeout');
        throw new Error("Délai dépassé lors de l’upload (timeout)");
      }
      throw e;
    }).finally(() => clearTimeout(timer));

    console.log('[Echange] uploadToBunny response status', response?.status);
    const text = await response.text();
    console.log('[Echange] uploadToBunny body length', text?.length || 0);
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        console.error("Réponse upload invalide:", text);
        throw new Error("Réponse inattendue du serveur d'upload");
      }
    }

    if (!response.ok || !data?.success) {
      const message = data?.message || `Erreur d’upload BunnyCDN (code ${response.status})`;
      throw new Error(message);
    }

    console.log('[Echange] uploadToBunny success', data?.url);
    return data.url;
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() && !mediaFile && !audioBlob) return;
    if (!user) {
        toast({ title: 'Erreur', description: 'Vous devez être connecté.', variant: 'destructive'});
        return;
    }

    setIsPostingComment(true);
    
    try {
        let media_url = null;
        let media_type = null;
        let audio_url = null;
        let audio_duration = null;
        let type = 'text';

        let finalAudioBlob = audioBlob;
        if (!finalAudioBlob && recorderPromiseRef.current) {
            finalAudioBlob = await recorderPromiseRef.current;
        }

        if (mediaFile) {
            media_url = await uploadToBunny(mediaFile, "comments");
            media_type = mediaFile.type;
            type = mediaFile.type.startsWith('image') ? 'image' : 'video';
        } else if (finalAudioBlob) {
            const { type: mimeType, ext } = mimeRef.current || { type: finalAudioBlob.type || 'audio/webm', ext: 'webm' };
            const normalizedType = mimeType.split(";")[0];
            if (!finalAudioBlob || finalAudioBlob.size < 2000) {
                toast({ title: 'Erreur audio', description: "L’audio semble vide ou trop court. Réessayez.", variant: 'destructive' });
                return;
            }
            const audioFile = new File([finalAudioBlob], `audio-comment-${user.id}-${Date.now()}.${ext}`, { type: normalizedType || 'audio/webm' });
            const { publicUrl } = await uploadAudioFile(audioFile, 'comments_audio');
            audio_url = publicUrl;
            const fallbackDuration = Math.max(1, recordedDurationRef.current || lastRecordingTimeRef.current || recordingTime || 1);
            const measuredDuration = await getBlobDuration(finalAudioBlob, fallbackDuration);
            const normalizedDuration = Math.max(1, Math.round(measuredDuration || fallbackDuration));
            recordedDurationRef.current = normalizedDuration;
            lastRecordingTimeRef.current = normalizedDuration;
            setRecordingTime(normalizedDuration);
            audio_duration = normalizedDuration;
            recorderPromiseRef.current = null;
            type = 'audio';
        }

        const payload = {
            user_id: user.id,
            content: newComment,
            media_url,
            media_type,
            audio_url,
            audio_duration,
            type,
        };
        if (audioParentId) {
            payload.content_type = 'echange';
            payload.parent_comment_id = replyTo || audioParentId;
        } else {
            payload.content_type = 'post';
            payload.content_id = postId;
            if (replyTo) payload.parent_comment_id = replyTo;
        }
        const { data: insertedComment, error: insertError } = await supabase
          .from('comments')
          .insert([payload])
          .select('id, type, media_url, media_type, audio_url')
          .single();

        if (insertError) throw insertError;
        try {
          if (postOwnerId && user?.id !== postOwnerId) {
            await notifyPostCommented({
              receiverId: postOwnerId,
              actorName: (user?.user_metadata?.username) || authorName || 'Un membre',
              postId,
              commentId: insertedComment?.id,
              preview: {
                text80: newComment || '',
                mediaType: type === 'image' ? 'image' : (type === 'video' ? 'video' : (type === 'audio' ? 'audio' : null)),
                mediaUrl: type === 'image' || type === 'video' ? (media_url || null) : null,
              },
            });
          }
        } catch (_e) {}
        
        setNewComment('');
        handleRemoveMedia();
        handleRemoveAudio();
        setReplyTo(null);
        setReplyToUser(null);

    } catch (error) {
        console.error('Error posting comment:', error);
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
        setIsPostingComment(false);
    }
  };

  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const childrenMap = comments.reduce((acc, c) => {
    if (c.parent_comment_id) {
      if (!acc[c.parent_comment_id]) acc[c.parent_comment_id] = [];
      acc[c.parent_comment_id].push(c);
    }
    return acc;
  }, {});

  useEffect(() => {
    if (!highlightCommentId) return;
    const el = document.getElementById(`comment-${highlightCommentId}`);
    if (el) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { el.scrollIntoView(); }
      el.classList.add('ring-2', 'ring-emerald-400');
      const t = setTimeout(() => {
        try { el.classList.remove('ring-2', 'ring-emerald-400'); } catch (_) {}
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [highlightCommentId, comments.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="pt-4 mt-4 border-t border-gray-200">
        {loadingComments ? <Loader2 className="animate-spin" /> : 
          topLevel.length > 0 ? (
            <div className="space-y-3 mb-4">
              {topLevel.map((comment) => (
                <div key={comment.id} id={`comment-${comment.id}`} className="flex flex-col gap-2">
                  <div className="flex gap-2 items-start">
                    <div className="cursor-pointer" onClick={() => { if (comment.author?.id) navigate(`/profil/${comment.author.id}`) }}>
                      <CommentAvatar avatarPath={comment.author?.avatar_url} username={comment.author?.username} userId={comment.author?.id} />
                    </div>
                    <div className="bg-gray-100 rounded-lg px-3 py-2 w-full">
                      <p className="text-sm font-semibold cursor-pointer" onClick={() => { if (comment.author?.id) navigate(`/profil/${comment.author.id}`) }}>{comment.author?.username}</p>
                      {comment.type === 'audio' ? <AudioPlayer src={comment.audio_url} initialDuration={comment.audio_duration} /> : <p className="text-sm text-gray-700">{parseMentions(comment.content)}</p> }
                      {comment.media_url && <CommentMedia url={comment.media_url} type={comment.media_type} />}
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <button onClick={() => { setReplyTo(comment.id); setReplyToUser(comment.author?.username || ''); }}>Répondre</button>
                        {user && comment.author?.id && comment.author.id !== user.id && (
                          <DonationDialog
                            post={{ user_id: comment.author?.id, profiles: { username: comment.author?.username } }}
                            user={user}
                            profile={profile}
                            refreshBalance={refreshBalance}
                          >
                            <button className="hover:text-[#F5C300]">Don</button>
                          </DonationDialog>
                        )}
                      </div>
                    </div>
                  </div>
                  {(childrenMap[comment.id] || []).length > 0 && (
                    <div className="ml-10 space-y-2">
                      {(childrenMap[comment.id] || []).map((child) => (
                        <div key={child.id} id={`comment-${child.id}`} className="flex gap-2 items-start">
                          <div className="cursor-pointer" onClick={() => { if (child.author?.id) navigate(`/profil/${child.author.id}`) }}>
                            <CommentAvatar avatarPath={child.author?.avatar_url} username={child.author?.username} userId={child.author?.id} />
                          </div>
                          <div className="bg-gray-50 rounded-lg px-3 py-2 w-full">
                            <p className="text-sm font-semibold cursor-pointer" onClick={() => { if (child.author?.id) navigate(`/profil/${child.author.id}`) }}>{child.author?.username}</p>
                            {child.type === 'audio' ? <AudioPlayer src={child.audio_url} initialDuration={child.audio_duration} /> : <p className="text-sm text-gray-700">{parseMentions(child.content)}</p> }
                            {child.media_url && <CommentMedia url={child.media_url} type={child.media_type} />}
                            <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                              <button onClick={() => { setReplyTo(comment.id); setReplyToUser(comment.author?.username || ''); }}>Répondre</button>
                              {user && child.author?.id && child.author.id !== user.id && (
                                <DonationDialog
                                  post={{ user_id: child.author?.id, profiles: { username: child.author?.username } }}
                                  user={user}
                                  profile={profile}
                                  refreshBalance={refreshBalance}
                                >
                                  <button className="hover:text-[#F5C300]">Don</button>
                                </DonationDialog>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic mb-4">Aucun commentaire pour le moment</p>
          )
        }
        
        <form onSubmit={handleAddComment} className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
                {isRecording ? (
                    <div className="flex items-center gap-2 w-full bg-gray-100 p-2 rounded-lg">
                       <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                       <span className="text-sm text-red-500 font-mono">{formatRecordingTime(recordingTime)}</span>
                    </div>
                ) : (
                    <Input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={replyToUser ? `Répondre à ${replyToUser}…` : "Écrire un commentaire..."}
                        disabled={isPostingComment || !!audioBlob}
                    />
                )}
                <Button type="submit" size="icon" disabled={isPostingComment || (!newComment.trim() && !mediaFile && !audioBlob)}>
                    {isPostingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
            </div>
            
            {(mediaPreviewUrl || audioBlob) && (
                <div className="relative p-2 bg-gray-100 rounded-lg">
                  {mediaPreviewUrl && mediaFile?.type.startsWith("image") ? (
                    <img src={mediaPreviewUrl} alt="preview" className="w-24 h-24 rounded object-cover" />
                  ) : mediaPreviewUrl ? (
                    <video src={mediaPreviewUrl} controls className="w-full rounded object-cover" />
                  ) : audioBlob ? (
                    <AudioPlayer src={URL.createObjectURL(audioBlob)} mimeType={(mimeRef.current?.type || audioBlob.type || 'audio/mp4').split(';')[0]} />
                  ) : null}
                  <Button size="icon" variant="destructive" onClick={mediaPreviewUrl ? handleRemoveMedia : handleRemoveAudio} className="absolute -top-1 -right-1 h-5 w-5 rounded-full">
                      <X className="h-3 w-3" />
                  </Button>
                </div>
            )}
            
            <div className="flex">
                {!isRecording && !audioBlob && (
                  <Button size="sm" type="button" variant="ghost" onClick={() => mediaInputRef.current?.click()} disabled={isPostingComment}>
                      <ImageIcon className="h-4 w-4" />
                  </Button>
                )}
                <input type="file" ref={mediaInputRef} accept="image/*,video/*" className="hidden" onChange={handleFileChange} disabled={isRecording || !!audioBlob}/>
                {!isRecording && !audioBlob && (
                  <Button size="sm" type="button" variant="ghost" onClick={startRecording} disabled={isPostingComment}>
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
                {isRecording && (
                  <Button size="sm" type="button" variant="destructive" onClick={stopRecording}>
                    <Square className="h-4 w-4 mr-2" /> Stop
                  </Button>
                )}
            </div>
        </form>
      </div>
    </motion.div>
  );
};


const PostCard = ({ post, user, profile, onLike, onDelete, onWarn, showComments, onToggleComments, refreshBalance, highlightCommentId }) => {
  const navigate = useNavigate();
  const { onlineUserIds } = useAuth();
  const isOnline = Boolean(post?.user_id && onlineUserIds instanceof Set && onlineUserIds.has(String(post.user_id)));
  const [isLiked, setIsLiked] = useState(false);
  const isMyPost = user?.id === post.user_id;
  const isAdmin =
    profile?.is_admin === true ||
    profile?.is_admin === 1 ||
    profile?.is_admin === 'true' ||
    String(profile?.role || '').toLowerCase() === 'admin';
  const isDeletedAuthor = post?.profiles?.is_deleted === true;
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnReason, setWarnReason] = useState('Contenu inapproprié');
  const [warnMessage, setWarnMessage] = useState('');
  const [warnSending, setWarnSending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  // moved isMyPost / isAdmin above to compute isDeletedAuthor consistently

  const checkLiked = useCallback(async () => {
    if (!user) return;
    try {
        const { data, error } = await supabase
            .from('likes')
            .select('id')
            .eq('content_id', post.id)
            .eq('user_id', user.id)
            .eq('content_type', 'post')
            .maybeSingle();
        if (error) throw error;
        setIsLiked(!!data);
    } catch(error) {
        console.error("Error checking like status:", error);
    }
  }, [post.id, user]);
  
  useEffect(() => {
    checkLiked();
  }, [post, checkLiked]);

  const handleLike = async () => {
    if (!user) {
        toast({ title: 'Connectez-vous pour aimer ce post.', variant: 'destructive'});
        return;
    }
    
    setIsLiked(!isLiked); 
    await onLike(post.id, isLiked, post.user_id);
  };


  const handleShare = async () => {
    const shareData = {
      title: post.profiles?.username + " sur OneKamer.co" || "Publication sur OneKamer.co",
      text: post.content,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch(err) {
        if (err.name !== 'AbortError') {
          toast({ title: "Erreur de partage", description: "Votre navigateur ne supporte pas le partage natif.", variant: "destructive" });
        }
      }
    } else {
      toast({ title: "Partage non disponible", description: "Votre navigateur ne supporte pas le partage natif." });
    }
  };

  const imageUrl = post.image_url;
  const videoUrl = post.video_url;

  const canWarn = isAdmin && user && !isMyPost && typeof onWarn === 'function';

  const submitWarn = async () => {
    try {
      if (!warnReason.trim() || !warnMessage.trim()) {
        toast({ title: 'Champs requis', description: 'Motif et message sont requis.', variant: 'destructive' });
        return;
      }
      setWarnSending(true);
      await onWarn({
        targetUserId: post.user_id,
        contentType: 'post',
        contentId: post.id,
        reason: warnReason,
        message: warnMessage,
      });
      setWarnOpen(false);
      setWarnReason('');
      setWarnMessage('');
    } catch {}
    finally {
      setWarnSending(false);
    }
  };

  return (
    <Card id={`feed-item-post-${post.id}`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="relative shrink-0 cursor-pointer"
            onClick={() => (isDeletedAuthor ? toast({ title: 'Compte supprimé' }) : navigate(`/profil/${post.user_id}`))}
          >
             <UserAvatar avatarUrl={isDeletedAuthor ? null : post.profiles?.avatar_url} username={isDeletedAuthor ? 'Compte supprimé' : post.profiles?.username} className="w-10 h-10" />
             {isOnline && (
               <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
             )}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold cursor-pointer hover:underline" onClick={() => (isDeletedAuthor ? toast({ title: 'Compte supprimé' }) : navigate(`/profil/${post.user_id}`))}>
                  {isDeletedAuthor ? 'Compte supprimé' : (post.profiles?.username || 'Anonyme')}
                </div>
                <div className="text-sm text-[#6B6B6B]">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</div>
              </div>
              <div className="flex items-center gap-2">
                {canWarn && (
                  <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#2BA84A]">
                        <Send className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Avertir l’auteur</DialogTitle>
                        <DialogDescription>
                          Envoyer une notification + un email à l'auteur (expéditeur: L'équipe OneKamer).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>Motif</Label>
                          <Select value={warnReason} onValueChange={setWarnReason}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir un motif" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Contenu inapproprié">Contenu inapproprié</SelectItem>
                              <SelectItem value="Spam">Spam</SelectItem>
                              <SelectItem value="Harcèlement">Harcèlement</SelectItem>
                              <SelectItem value="Hors sujet">Hors sujet</SelectItem>
                              <SelectItem value="Autre">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Message</Label>
                          <textarea
                            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                            value={warnMessage}
                            onChange={(e) => setWarnMessage(e.target.value)}
                            placeholder="Expliquez la raison / l'avertissement..."
                            rows={5}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" className="w-full" onClick={submitWarn} disabled={warnSending}>
                          {warnSending ? 'Envoi…' : 'Envoyer'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                {(isMyPost || isAdmin) && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDelete(post.id, post.image_url, post.video_url)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        <p className="mb-4 whitespace-pre-wrap">{parseMentions(post.content)}</p>
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt="Post media" 
            className="rounded-lg w-full mb-4" 
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src="https://onekamer-media-cdn.b-cdn.net/posts/default_post_image.png";
            }}
          />
        )}
        {videoUrl && <video src={videoUrl} controls className="rounded-lg w-full mb-4" />}
        <div className="flex items-center gap-4 text-[#6B6B6B]">
          <button
            className={`flex items-center gap-2 hover:text-[#E0222A] transition-colors ${isLiked ? 'text-[#E0222A]' : ''}`}
            onClick={handleLike}
          >
            <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
            <span>{post.likes_count || 0}</span>
          </button>
          <button className="flex items-center gap-2 hover:text-[#2BA84A] transition-colors" onClick={onToggleComments}>
            <MessageCircle className="h-5 w-5" />
            <span>{post.comments_count || 0}</span>
          </button>
          <button className="flex items-center gap-2 hover:text-[#007AFF] transition-colors" onClick={handleShare}>
            <Share2 className="h-5 w-5" />
            <span>Partager</span>
          </button>
          {user && !isMyPost && (
            <DonationDialog post={post} user={user} profile={profile} refreshBalance={refreshBalance}>
              <button className="flex items-center gap-2 hover:text-[#F5C300] transition-colors ml-auto">
                <Coins className="h-5 w-5" />
                <span>Don</span>
              </button>
            </DonationDialog>
          )}
        </div>
        <AnimatePresence>
          {showComments && (
            <CommentSection
              postId={post.id}
              postOwnerId={post.user_id}
              authorName={profile?.username}
              postContent={post.content}
              refreshBalance={refreshBalance}
              highlightCommentId={highlightCommentId}
            />
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

const AudioPostCard = ({ post, user, profile, onDelete, onWarn, refreshBalance, autoOpen, highlightCommentId }) => {
  const navigate = useNavigate();
  const { onlineUserIds } = useAuth();
  const isOnline = Boolean(post?.user_id && onlineUserIds instanceof Set && onlineUserIds.has(String(post.user_id)));
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(Number(post?.likes_count) || 0);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnReason, setWarnReason] = useState('Contenu inapproprié');
  const [warnMessage, setWarnMessage] = useState('');
  const [warnSending, setWarnSending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const isMyPost = user?.id === post.user_id;
  const isAdmin =
    profile?.is_admin === true ||
    profile?.is_admin === 1 ||
    profile?.is_admin === 'true' ||
    String(profile?.role || '').toLowerCase() === 'admin';
  const isDeletedAuthor = post?.author?.is_deleted === true;

  const canWarn = isAdmin && user && !isMyPost && typeof onWarn === 'function';

  const submitWarn = async () => {
    try {
      if (!warnReason.trim() || !warnMessage.trim()) {
        toast({ title: 'Champs requis', description: 'Motif et message sont requis.', variant: 'destructive' });
        return;
      }
      setWarnSending(true);
      await onWarn({
        targetUserId: post.user_id,
        contentType: 'audio_post',
        contentId: post.id,
        reason: warnReason,
        message: warnMessage,
      });
      setWarnOpen(false);
      setWarnReason('');
      setWarnMessage('');
    } catch {}
    finally {
      setWarnSending(false);
    }
  };

  const checkLiked = useCallback(async () => {
    try {
      if (!post?.id) return;
      // statut like par l'utilisateur
      if (user?.id) {
        const { data } = await supabase
          .from('likes')
          .select('id')
          .eq('content_id', post.id)
          .eq('user_id', user.id)
          .eq('content_type', 'comment')
          .maybeSingle();
        setIsLiked(!!data);
      } else {
        setIsLiked(false);
      }
      // compteur de likes
      const { count } = await supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('content_id', post.id)
        .eq('content_type', 'comment');
      setLikesCount(Number(count) || 0);
    } catch (_) {}
  }, [post?.id, user?.id]);

  useEffect(() => {
    checkLiked();
  }, [checkLiked]);

  const handleLike = async () => {
    if (!user) {
      toast({ title: 'Connectez-vous pour aimer ce message vocal.', variant: 'destructive' });
      return;
    }
    const next = !isLiked;
    setIsLiked(next);
    setLikesCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    try {
      if (next) {
        await supabase.from('likes').insert({ content_id: post.id, user_id: user.id, content_type: 'comment' });
      } else {
        await supabase.from('likes').delete().match({ content_id: post.id, user_id: user.id, content_type: 'comment' });
      }
    } catch (_) {
      // rollback simple en cas d'erreur
      setIsLiked(!next);
      setLikesCount((c) => (!next ? c + 1 : Math.max(0, c - 1)));
      toast({ title: 'Erreur', description: "Impossible de mettre à jour le like.", variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: (post?.author?.username || 'Membre') + ' sur OneKamer.co',
      text: post?.content || 'Message vocal sur OneKamer.co',
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) { if (err?.name !== 'AbortError') toast({ title: 'Partage non disponible' }); }
    } else {
      toast({ title: 'Partage non disponible', description: "Votre navigateur ne supporte pas le partage natif." });
    }
  };

  // Compteur de commentaires pour les posts audio (réponses directes)
  const refreshCommentsCount = useCallback(async () => {
    try {
      const { count } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('content_type', 'echange')
        .eq('parent_comment_id', post.id);
      setCommentsCount(Number(count) || 0);
    } catch (_) {}
  }, [post.id]);

  useEffect(() => {
    refreshCommentsCount();
    const channel = supabase
      .channel(`echange-audio-comments-${post.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `parent_comment_id=eq.${post.id}` }, () => {
        refreshCommentsCount();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter: `parent_comment_id=eq.${post.id}` }, () => {
        refreshCommentsCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [post.id, refreshCommentsCount]);

  return (
    <Card id={`feed-item-audio_post-${post.id}`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div
            className="relative shrink-0 cursor-pointer"
            onClick={() => (isDeletedAuthor ? toast({ title: 'Compte supprimé' }) : navigate(`/profil/${post.user_id}`))}
          >
            <UserAvatar avatarUrl={isDeletedAuthor ? null : post.author?.avatar_url} username={isDeletedAuthor ? 'Compte supprimé' : post.author?.username} className="w-10 h-10" />
            {isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold cursor-pointer hover:underline" onClick={() => (isDeletedAuthor ? toast({ title: 'Compte supprimé' }) : navigate(`/profil/${post.user_id}`))}>
                  {isDeletedAuthor ? 'Compte supprimé' : (post.author?.username || 'Anonyme')}
                </div>
                <div className="text-sm text-[#6B6B6B]">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</div>
              </div>
              {(isMyPost || isAdmin) && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDelete(post.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {canWarn && (
                <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#2BA84A]">
                      <Send className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Avertir l’auteur</DialogTitle>
                      <DialogDescription>
                        Envoyer une notification + un email à l'auteur (expéditeur: L'équipe OneKamer).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label>Motif</Label>
                        <Select value={warnReason} onValueChange={setWarnReason}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir un motif" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Contenu inapproprié">Contenu inapproprié</SelectItem>
                            <SelectItem value="Spam">Spam</SelectItem>
                            <SelectItem value="Harcèlement">Harcèlement</SelectItem>
                            <SelectItem value="Hors sujet">Hors sujet</SelectItem>
                            <SelectItem value="Autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Message</Label>
                        <textarea
                          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                          value={warnMessage}
                          onChange={(e) => setWarnMessage(e.target.value)}
                          placeholder="Expliquez la raison / l'avertissement..."
                          rows={5}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" className="w-full" onClick={submitWarn} disabled={warnSending}>
                        {warnSending ? 'Envoi…' : 'Envoyer'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {post.content && post.content !== "Message vocal" && <p className="mt-2 text-sm text-gray-700">{parseMentions(post.content)}</p>}
            <AudioPlayer src={post.audio_url} initialDuration={post.audio_duration} />
            <div className="flex items-center gap-4 text-[#6B6B6B] mt-3">
              <button
                className={`flex items-center gap-2 hover:text-[#E0222A] transition-colors ${isLiked ? 'text-[#E0222A]' : ''}`}
                onClick={handleLike}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                <span>{likesCount || 0}</span>
              </button>
              <button
                className="flex items-center gap-2 hover:text-[#2BA84A] transition-colors"
                onClick={() => setCommentsOpen((v) => !v)}
              >
                <MessageCircle className="h-5 w-5" />
                <span>{commentsCount || 0}</span>
              </button>
              <button className="flex items-center gap-2 hover:text-[#007AFF] transition-colors" onClick={handleShare}>
                <Share2 className="h-5 w-5" />
                <span>Partager</span>
              </button>
              {user && !isMyPost && (
                <DonationDialog
                  post={{ user_id: post.user_id, profiles: { username: post.author?.username } }}
                  user={user}
                  profile={profile}
                  refreshBalance={refreshBalance}
                >
                  <button className="flex items-center gap-2 hover:text-[#F5C300] transition-colors ml-auto">
                    <Coins className="h-5 w-5" />
                    <span>Don</span>
                  </button>
                </DonationDialog>
              )}
            </div>
            <AnimatePresence>
              {commentsOpen && (
                <CommentSection
                  postId={null}
                  postOwnerId={post.user_id}
                  authorName={post.author?.username}
                  postContent={post.content}
                  audioParentId={post.id}
                  refreshBalance={refreshBalance}
                  highlightCommentId={highlightCommentId}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Echange = () => {
  const { user, profile, session, refreshBalance } = useAuth();
  const [feedItems, setFeedItems] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [openComments, setOpenComments] = useState({});
  const [deeplinkTarget, setDeeplinkTarget] = useState({ feedType: null, id: null, commentId: null });
  const location = useLocation();

  const API_PREFIX = import.meta.env.VITE_API_URL || '/api';

  const handleWarnUser = async ({ targetUserId, contentType, contentId, reason, message }) => {
    try {
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');

      const res = await fetch(`${API_PREFIX}/admin/moderation/warn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUserId,
          contentType,
          contentId,
          reason,
          message,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
      toast({ title: 'Envoyé', description: 'Avertissement envoyé (notification + email).' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
      throw e;
    }
  };

  const handleToggleComments = (postId) => {
    setOpenComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };
  
  const fetchFeed = useCallback(async () => {
    setLoadingPosts(true);

    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('*, profiles(id, username, avatar_url, is_deleted)')
      .order('created_at', { ascending: false });

    if (postsError) {
        console.error('Error fetching posts:', postsError);
        toast({ title: 'Erreur', description: "Impossible de charger les posts.", variant: 'destructive' });
    }

    const { data: audioData, error: audioError } = await supabase
      .from('comments')
      .select(`*, author:profiles (id, username, avatar_url, is_deleted)`)
      .eq('content_type', 'echange')
      .is('parent_comment_id', null)
      .order('created_at', { ascending: false });

    if (audioError) {
      console.error('Error fetching audio posts:', audioError);
    }

    const combinedFeed = [
      ...(postsData || []).map(p => ({ ...normalizeAudioEntry(p), feed_type: 'post' })),
      ...(audioData || []).map(a => ({ ...normalizeAudioEntry(a), feed_type: 'audio_post' }))
    ];

    combinedFeed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setFeedItems(combinedFeed);
    setLoadingPosts(false);
  }, []);
  
  useEffect(() => {
    fetchFeed();
    
    const channel = supabase
      .channel('public-echange-feed-unified')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        fetchFeed();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: 'content_type=eq.echange' }, (payload) => {
        fetchFeed();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
          setFeedItems(current => current.filter(p => p.feed_type === 'post' && p.id !== payload.old.id));
      })
       .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, (payload) => {
          setFeedItems(current => current.filter(p => p.feed_type === 'audio_post' && p.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload) => {
        fetchFeed();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, [fetchFeed]);

  // Deep-link: scroll to targeted item, highlight briefly, and open comments when applicable
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || "");
      let targetId = null;
      let feedType = "post";
      const commentId = params.get("commentId");
      if (params.get("postId")) {
        targetId = params.get("postId");
        feedType = "post";
      } else if (params.get("audioId")) {
        targetId = params.get("audioId");
        feedType = "audio_post";
      }
      if (!targetId || loadingPosts) return;
      const el = document.getElementById(`feed-item-${feedType}-${targetId}`);
      if (el) {
        try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_e) { el.scrollIntoView(); }
        // highlight card briefly
        try {
          el.classList.add('ring-2', 'ring-emerald-400');
          setTimeout(() => { try { el.classList.remove('ring-2', 'ring-emerald-400'); } catch (_) {} }, 2500);
        } catch (_) {}
        if (feedType === "post") { setOpenComments((prev) => ({ ...prev, [targetId]: true })); }
      }
      setDeeplinkTarget({ feedType, id: targetId, commentId: commentId || null });
    } catch (_e) {}
  }, [location.search, loadingPosts, feedItems]);

  const handleLike = async (postId, isCurrentlyLiked, postOwnerId) => {
    if (!user) return;
    
    if (isCurrentlyLiked) {
      await supabase.from('likes').delete().match({ content_id: postId, user_id: user.id, content_type: 'post' });
    } else {
      await supabase.from('likes').insert({ content_id: postId, user_id: user.id, content_type: 'post' });
      try {
        const receiverId = postOwnerId || (feedItems.find((p) => p.feed_type === 'post' && p.id === postId)?.user_id);
        if (receiverId && receiverId !== user.id) {
          const actorName = (profile?.username) || (user?.user_metadata?.username) || 'Un membre';
          const likedPost = feedItems.find((p) => p.feed_type === 'post' && p.id === postId);
          const postContent = (likedPost?.content) || '';
          const mediaType = likedPost?.image_url ? 'image' : (likedPost?.video_url ? 'video' : null);
          const mediaUrl = likedPost?.image_url || likedPost?.video_url || null;
          await notifyPostLiked({
            receiverId,
            actorName,
            postId,
            preview: {
              text80: postContent,
              mediaType,
              mediaUrl,
            },
          });
        }
      } catch (_e) {}
    }
  };
  
  const handleDeletePost = async (postId, imageUrl, videoUrl) => {
    try {
      const isAdmin =
        profile?.is_admin === true ||
        profile?.is_admin === 1 ||
        profile?.is_admin === 'true' ||
        String(profile?.role || '').toLowerCase() === 'admin';
      const isMyPost = user?.id && feedItems.find((p) => p.feed_type === 'post' && p.id === postId)?.user_id === user.id;

      if (isAdmin && !isMyPost) {
        const token = session?.access_token;
        if (!token) throw new Error('Session expirée');
        const res = await fetch(`${API_PREFIX}/admin/echange/posts/${encodeURIComponent(postId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
        toast({ title: 'Supprimé', description: 'Post supprimé (admin).' });
        return;
      }

      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw new Error(error.message);
      toast({ title: 'Supprimé', description: 'Post supprimé.' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
    }
  };

  const handleDeleteAudioPost = async (commentId) => {
    try {
      const isAdmin =
        profile?.is_admin === true ||
        profile?.is_admin === 1 ||
        profile?.is_admin === 'true' ||
        String(profile?.role || '').toLowerCase() === 'admin';
      const isMyPost = user?.id && feedItems.find((p) => p.feed_type === 'audio_post' && p.id === commentId)?.user_id === user.id;

      if (isAdmin && !isMyPost) {
        const token = session?.access_token;
        if (!token) throw new Error('Session expirée');
        const res = await fetch(`${API_PREFIX}/admin/echange/audio/${encodeURIComponent(commentId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
        toast({ title: 'Supprimé', description: 'Post vocal supprimé (admin).' });
        return;
      }

      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw new Error(error.message);
      toast({ title: 'Supprimé', description: 'Post vocal supprimé.' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
    }
  }

  return (
    <>
      <Helmet>
        <title>Échange Communautaire - OneKamer.co</title>
        <meta name="description" content="Partagez et échangez avec la communauté OneKamer.co" />
      </Helmet>

      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-[#2BA84A] mb-4">Échange Communautaire</h1>
        </motion.div>

        {user && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <CreatePost />
          </motion.div>
        )}

        <Tabs defaultValue="recent" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recent">Récent</TabsTrigger>
            <TabsTrigger value="trending">Tendances</TabsTrigger>
          </TabsList>
          <TabsContent value="recent" className="space-y-4 mt-4">
            {loadingPosts ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" /></div> : 
              feedItems.map((item, index) => (
                <motion.div key={`${item.feed_type}-${item.id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                  {item.feed_type === 'post' ? (
                    <PostCard 
                      post={item} 
                      user={user}
                      profile={profile}
                      onLike={handleLike} 
                      onDelete={handleDeletePost}
                      onWarn={handleWarnUser}
                      showComments={!!openComments[item.id]}
                      onToggleComments={() => handleToggleComments(item.id)}
                      refreshBalance={refreshBalance}
                      highlightCommentId={deeplinkTarget.feedType === 'post' && deeplinkTarget.id === item.id ? deeplinkTarget.commentId : null}
                    />
                  ) : (
                    <AudioPostCard
                      post={item}
                      user={user}
                      profile={profile}
                      onDelete={handleDeleteAudioPost}
                      onWarn={handleWarnUser}
                      refreshBalance={refreshBalance}
                      autoOpen={deeplinkTarget.feedType === 'audio_post' && deeplinkTarget.id === item.id}
                      highlightCommentId={deeplinkTarget.feedType === 'audio_post' && deeplinkTarget.id === item.id ? deeplinkTarget.commentId : null}
                    />
                  )}
                </motion.div>
              ))
            }
          </TabsContent>
          <TabsContent value="trending" className="space-y-4 mt-4">
            {loadingPosts ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" /></div> :
              [...feedItems].sort((a, b) => ((b.likes_count || 0) + (b.comments_count || 0)) - ((a.likes_count || 0) + (a.comments_count || 0))).map((item, index) => (
                <motion.div key={`${item.feed_type}-${item.id}-trending`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                  {item.feed_type === 'post' ? (
                    <PostCard 
                      post={item} 
                      user={user}
                      profile={profile}
                      onLike={handleLike} 
                      onDelete={handleDeletePost}
                      onWarn={handleWarnUser}
                      showComments={!!openComments[item.id]}
                      onToggleComments={() => handleToggleComments(item.id)}
                      refreshBalance={refreshBalance}
                      highlightCommentId={deeplinkTarget.feedType === 'post' && deeplinkTarget.id === item.id ? deeplinkTarget.commentId : null}
                    />
                  ) : (
                     <AudioPostCard
                       post={item}
                       user={user}
                       profile={profile}
                       onDelete={handleDeleteAudioPost}
                       onWarn={handleWarnUser}
                       refreshBalance={refreshBalance}
                       autoOpen={deeplinkTarget.feedType === 'audio_post' && deeplinkTarget.id === item.id}
                       highlightCommentId={deeplinkTarget.feedType === 'audio_post' && deeplinkTarget.id === item.id ? deeplinkTarget.commentId : null}
                     />
                  )}
                </motion.div>
              ))
            }
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Echange;
