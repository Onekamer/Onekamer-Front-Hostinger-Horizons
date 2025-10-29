
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, Send, Loader2, Trash2, Image as ImageIcon, X, Coins, Mic, Square, Play, Pause } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import CreatePost from '@/components/posts/CreatePost';
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
import { getInitials } from '@/lib/utils';
import { uploadAudioFile, ensurePublicAudioUrl } from '@/utils/audioStorage';
import { notifyDonationReceived } from '@/services/oneSignalNotifications';

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

  const handleDonation = async (e) => {
    e.preventDefault();
    const donationAmount = parseInt(amount);
    if (!donationAmount || donationAmount <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('make_donation', {
        sender: user.id,
        receiver: post.user_id,
        amount: donationAmount,
        msg: message
      });
      if (rpcError) throw new Error(rpcError.message);

      const postContent = `🎉 ${profile.username} a fait un don de ${donationAmount} OK Coins à ${post.profiles.username} ! Merci pour cette générosité qui fait vivre la communauté. 💚`;
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
            senderName: profile?.username || user?.email || 'Un membre OneKamer',
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

const AudioPlayer = ({ src, initialDuration = 0 }) => {
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
            }
            const setAudioTime = () => setCurrentTime(audio.currentTime);

            audio.addEventListener('loadeddata', setAudioData);
            audio.addEventListener('timeupdate', setAudioTime);
            audio.addEventListener('ended', () => setIsPlaying(false));
            audio.addEventListener('canplaythrough', () => setIsLoading(false));
            
            if (audio.readyState >= 2) {
                setAudioData();
            }

            return () => {
                audio.removeEventListener('loadeddata', setAudioData);
                audio.removeEventListener('timeupdate', setAudioTime);
                audio.removeEventListener('ended', () => setIsPlaying(false));
                audio.removeEventListener('canplaythrough', () => setIsLoading(false));
            }
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
            <audio ref={audioRef} src={src} preload="metadata"></audio>
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

const CommentAvatar = ({ avatarPath, username }) => {
  return (
    <UserAvatar avatarUrl={avatarPath} username={username} className="w-8 h-8" />
  );
};

const CommentSection = ({ postId }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const mediaInputRef = useRef(null);
  const navigate = useNavigate();

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
        author:profiles ( id, username, avatar_url )
      `)
      .eq('content_id', postId)
      .eq('content_type', 'post')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erreur chargement commentaires :', error.message);
    } else {
      const normalized = (data || []).map((comment) => normalizeAudioEntry(comment));
      setComments(normalized);
    }
    setLoadingComments(false);
  }, [postId]);

  useEffect(() => {
    fetchComments();
  
    const channel = supabase
      .channel(`comments-post-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `content_id=eq.${postId}`,
        },
        async (payload) => {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          if (!profileError) {
              const resolved = normalizeAudioEntry({ ...payload.new, author: profileData });
              setComments((prev) => [...prev, resolved]);
          } else {
              const resolved = normalizeAudioEntry({ ...payload.new, author: { username: 'Anonyme', avatar_url: null } });
              setComments((prev) => [...prev, resolved]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, fetchComments]);
  
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

    const supportedMimeType = MediaRecorder.isTypeSupported(chosenMime.type)
      ? chosenMime.type
      : "audio/mp4";

    console.log("🎚️ Type MIME utilisé :", supportedMimeType);

    const recorder = new MediaRecorder(stream, { mimeType: supportedMimeType });
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

      const audioBlob = new Blob(audioChunksRef.current, {
        type: supportedMimeType.split(";")[0],
      });
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
    }, 120000);
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
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    const text = await response.text();
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

        const { error: insertError } = await supabase.from('comments').insert([{
            content_id: postId,
            content_type: 'post',
            user_id: user.id,
            content: newComment,
            media_url,
            media_type,
            audio_url,
            audio_duration,
            type,
        }]);

        if (insertError) throw insertError;
        
        setNewComment('');
        handleRemoveMedia();
        handleRemoveAudio();

    } catch (error) {
        console.error('Error posting comment:', error);
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
        setIsPostingComment(false);
    }
  };

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
          comments.length > 0 ? (
            <div className="space-y-3 mb-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2 items-start">
                  <div className="cursor-pointer" onClick={() => navigate(`/profil/${comment.author?.id}`)}>
                    <CommentAvatar avatarPath={comment.author?.avatar_url} username={comment.author?.username} />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-3 py-2 w-full">
                    <p className="text-sm font-semibold cursor-pointer" onClick={() => navigate(`/profil/${comment.author?.id}`)}>{comment.author?.username}</p>
                    {comment.type === 'audio' ? <AudioPlayer src={comment.audio_url} initialDuration={comment.audio_duration} /> : <p className="text-sm text-gray-700">{parseMentions(comment.content)}</p> }
                    {comment.media_url && <CommentMedia url={comment.media_url} type={comment.media_type} />}
                  </div>
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
                        placeholder="Écrire un commentaire..."
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
                    <AudioPlayer src={URL.createObjectURL(audioBlob)} />
                  ) : null}
                  <Button size="icon" variant="destructive" onClick={mediaPreviewUrl ? handleRemoveMedia : handleRemoveAudio} className="absolute -top-1 -right-1 h-5 w-5 rounded-full">
                      <X className="h-3 w-3" />
                  </Button>
                </div>
            )}
            
            <div className="flex">
                {!isRecording && !audioBlob && (
                  <Button size="sm" type="button" variant="ghost" onClick={() => mediaInputRef.current?.click()} disabled={isPostingComment}>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Image/Vidéo
                  </Button>
                )}
                <input type="file" ref={mediaInputRef} accept="image/*,video/*" className="hidden" onChange={handleFileChange} disabled={isRecording || !!audioBlob}/>
                
                {!mediaFile && (
                    isRecording ? (
                        <Button size="sm" type="button" variant="destructive" onClick={stopRecording}>
                            <Square className="h-4 w-4 mr-2" /> Stop
                        </Button>
                    ) : (
                       !audioBlob &&
                        <Button size="sm" type="button" variant="ghost" onClick={startRecording} disabled={isPostingComment}>
                            <Mic className="h-4 w-4 mr-2" /> Audio
                        </Button>
                    )
                )}
            </div>
        </form>
      </div>
    </motion.div>
  );
};


const PostCard = ({ post, user, profile, onLike, onDelete, showComments, onToggleComments, refreshBalance }) => {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const isMyPost = user?.id === post.user_id;

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
    await onLike(post.id, isLiked);
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

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="shrink-0 cursor-pointer"
            onClick={() => navigate(`/profil/${post.user_id}`)}
          >
             <UserAvatar avatarUrl={post.profiles?.avatar_url} username={post.profiles?.username} className="w-10 h-10" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold cursor-pointer hover:underline" onClick={() => navigate(`/profil/${post.user_id}`)}>
                  {post.profiles?.username || 'Anonyme'}
                </div>
                <div className="text-sm text-[#6B6B6B]">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</div>
              </div>
              {isMyPost && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDelete(post.id, post.image_url, post.video_url)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
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
          {showComments && <CommentSection postId={post.id} />}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

const AudioPostCard = ({ post, user, onDelete }) => {
  const navigate = useNavigate();
  const isMyPost = user?.id === post.user_id;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 cursor-pointer"
            onClick={() => navigate(`/profil/${post.user_id}`)}
          >
            <UserAvatar avatarUrl={post.author?.avatar_url} username={post.author?.username} className="w-10 h-10" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold cursor-pointer hover:underline" onClick={() => navigate(`/profil/${post.user_id}`)}>
                  {post.author?.username || 'Anonyme'}
                </div>
                <div className="text-sm text-[#6B6B6B]">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</div>
              </div>
              {isMyPost && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDelete(post.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {post.content && post.content !== "Message vocal" && <p className="mt-2 text-sm text-gray-700">{parseMentions(post.content)}</p>}
            <AudioPlayer src={post.audio_url} initialDuration={post.audio_duration} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Echange = () => {
  const { user, profile, refreshBalance } = useAuth();
  const [feedItems, setFeedItems] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [openComments, setOpenComments] = useState({});

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
      .select('*, profiles(id, username, avatar_url)')
      .order('created_at', { ascending: false });

    if (postsError) {
        console.error('Error fetching posts:', postsError);
        toast({ title: 'Erreur', description: "Impossible de charger les posts.", variant: 'destructive' });
    }

    const { data: audioData, error: audioError } = await supabase
      .from('comments')
      .select(`*, author:profiles (id, username, avatar_url)`)
      .eq('content_type', 'echange')
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

  const handleLike = async (postId, isCurrentlyLiked) => {
    if (!user) return;
    
    if (isCurrentlyLiked) {
      await supabase.from('likes').delete().match({ content_id: postId, user_id: user.id, content_type: 'post' });
    } else {
      await supabase.from('likes').insert({ content_id: postId, user_id: user.id, content_type: 'post' });
    }
  };
  
  const handleDeletePost = async (postId, imageUrl, videoUrl) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if(error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
  };

  const handleDeleteAudioPost = async (commentId) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
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
                      showComments={!!openComments[item.id]}
                      onToggleComments={() => handleToggleComments(item.id)}
                      refreshBalance={refreshBalance}
                    />
                  ) : (
                    <AudioPostCard post={item} user={user} onDelete={handleDeleteAudioPost} />
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
                      showComments={!!openComments[item.id]}
                      onToggleComments={() => handleToggleComments(item.id)}
                      refreshBalance={refreshBalance}
                    />
                  ) : (
                     <AudioPostCard post={item} user={user} onDelete={handleDeleteAudioPost} />
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
