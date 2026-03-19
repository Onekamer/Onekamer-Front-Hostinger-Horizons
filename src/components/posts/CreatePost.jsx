
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Loader2, X, Mic, Square, Play, Pause, Image as ImageIcon, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
 
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { uploadAudioFile } from '@/utils/audioStorage';
import { notifyMentions, notifyFollowersNewPost } from '@/services/oneSignalNotifications';
import { extractUniqueMentions } from '@/utils/mentions';
import { compressVideoIfIOS } from '@/lib/iosVideoCompression';

const SPONSORED_POSTS_ENABLED = false;

const getApiPrefix = () => {
  const isNative = typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() !== 'web';
  if (isNative) return import.meta.env.VITE_API_URL;
  return (import.meta.env.VITE_API_URL || '/api');
};

const API_PREFIX = (
  (typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() !== 'web')
    ? import.meta.env.VITE_API_URL
    : (import.meta.env.VITE_API_URL || '/api')
);

const getApiBaseCandidates = () => {
  const c = [];
  const isNative = typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() !== 'web';
  const abs = import.meta.env.VITE_API_URL;
  if (isNative) {
    if (abs) c.push(abs);
    c.push('https://onekamer.co/api');
    c.push('/api');
  } else {
    c.push('/api');
    if (abs) c.push(abs);
    c.push('https://onekamer.co/api');
  }
  return Array.from(new Set(c.filter(Boolean)));
};
const importToBunnyStream = async (cdnUrl, title = 'OneKamer Video') => {
  try {
    const res = await fetch(`${API_PREFIX}/stream/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceUrl: cdnUrl, title }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.embedUrl) return data.embedUrl;
  } catch (_) {}
  return null;
};

const AudioPlayer = ({ src, onCanPlay, mimeType }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
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
                    if (onCanPlay) onCanPlay(audio.duration);
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
            audio.addEventListener('canplaythrough', () => { setIsLoading(false); setAudioData(); });
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
                audio.removeEventListener('canplaythrough', () => { setIsLoading(false); setAudioData(); });
                audio.removeEventListener('error', onError);
            };
        }
    }, [src, onCanPlay]);

    const formatTime = (time) => {
        if (isNaN(time) || time === Infinity) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    return (
        <div className="flex items-center gap-2 bg-gray-200 rounded-full p-2 mt-2">
            <audio ref={audioRef} preload="auto" playsInline>
                {mimeType ? (
                  <source src={src} type={mimeType} />
                ) : (
                  <source src={src} />
                )}
            </audio>
            <Button onClick={togglePlayPause} size="icon" className="rounded-full w-8 h-8" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : (isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />)}
            </Button>
            <div className="w-full bg-gray-300 rounded-full h-1.5">
                <div
                    className="bg-[#2BA84A] h-1.5 rounded-full"
                    style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                ></div>
            </div>
            <span className="text-xs text-gray-600 w-20 text-center">{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
    );
};

const CreatePost = ({ onCreateSponsored }) => {
  const { user, profile } = useAuth();
  const [postText, setPostText] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const mediaInputRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState(null);
  const chunksRef = useRef([]);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);

  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);
  const mimeRef = useRef({ ext: "webm", type: "audio/webm" });
  const recorderPromiseRef = useRef(null);
  
  const isAudioRecordingSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const hasGUM = !!(navigator?.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
    const hasMR = typeof window.MediaRecorder !== 'undefined';
    return hasGUM && hasMR;
  }, []);


  const [mentionQuery, setMentionQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const editableDivRef = useRef(null);
  const [tagQuery, setTagQuery] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const lastRangeRef = useRef(null);

  useEffect(() => {
    const onSelChange = () => {
      try {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const div = editableDivRef.current;
        if (!div) return;
        const node = sel.anchorNode;
        if (node && div.contains(node)) {
          lastRangeRef.current = sel.getRangeAt(0).cloneRange();
        }
      } catch (_) {}
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, []);

  const handleInput = (e) => {
    const div = e.currentTarget;
    const text = div.innerText;
    setPostText(text);

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        try { lastRangeRef.current = range.cloneRange(); } catch (_) {}
        const textBeforeCursor = range.startContainer.textContent.substring(0, range.startOffset);
        // Autoriser espaces et caractères usuels dans les pseudos
        const mentionMatch = textBeforeCursor.match(/@([^\n@]{1,30})$/);
        
        if (mentionMatch) {
            setMentionQuery(mentionMatch[1]);
            setShowSuggestions(true);
            setShowTagSuggestions(false);
        } else {
            setShowSuggestions(false);
            const tagMatch = textBeforeCursor.match(/#([^\s#\n]{1,30})$/);
            if (tagMatch) {
              setTagQuery(tagMatch[1]);
              setShowTagSuggestions(true);
            } else {
              setShowTagSuggestions(false);
            }
        }
    }
  };

  const handleKeyDown = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        handleMentionSelect(suggestions[0].username);
      } else {
        await processAndColorizeMention(e);
      }
    } else if ([" ", ","].includes(e.key)) {
      await processAndColorizeMention(e);
    }
  };

  const processAndColorizeMention = async (e) => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const text = node.textContent.substring(0, range.startOffset);
    const match = text.match(/@([^\n@]{1,30})$/);

    if (match) {
      e.preventDefault();
      const username = match[1];
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username)
        .maybeSingle();
      
      if (data) {
        handleMentionSelect(username, true);
      } else {
        node.textContent += e.key;
        range.setStart(node, range.startOffset + 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      if (mentionQuery) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .ilike('username', `${mentionQuery}%`)
          .limit(5);

        if (!error) {
          setSuggestions(data);
        }
      }
    };

    const debounceFetch = setTimeout(() => {
      if (showSuggestions) {
        fetchUsers();
      }
    }, 300);

    return () => clearTimeout(debounceFetch);
  }, [mentionQuery, showSuggestions]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const [ev, an, bt, gr, fd] = await Promise.all([
          supabase.from('evenements').select('id, title').ilike('title', `%${tagQuery}%`).limit(3),
          supabase.from('annonces').select('id, titre').ilike('titre', `%${tagQuery}%`).limit(3),
          supabase.from('partenaires').select('id, name').ilike('name', `%${tagQuery}%`).limit(3),
          supabase.from('groupes').select('id, nom').ilike('nom', `%${tagQuery}%`).limit(3),
          supabase.from('faits_divers').select('id, title').ilike('title', `%${tagQuery}%`).limit(3),
        ]);
        const out = [];
        (ev.data || []).forEach((r) => out.push({ id: r.id, label: r.title, type: 'evenement', badge: 'Événement' }));
        (an.data || []).forEach((r) => out.push({ id: r.id, label: r.titre, type: 'annonce', badge: 'Annonce' }));
        (bt.data || []).forEach((r) => out.push({ id: r.id, label: r.name, type: 'partenaire', badge: 'Boutique' }));
        (gr.data || []).forEach((r) => out.push({ id: r.id, label: r.nom, type: 'groupe', badge: 'Groupe' }));
        (fd.data || []).forEach((r) => out.push({ id: r.id, label: r.title, type: 'faits_divers', badge: 'Actualité' }));
        setTagSuggestions(out.slice(0, 12));
      } catch (_) {}
    };
    const debounceFetch = setTimeout(() => {
      if (showTagSuggestions && tagQuery.length >= 1) {
        fetchTags();
      }
    }, 250);
    return () => clearTimeout(debounceFetch);
  }, [tagQuery, showTagSuggestions]);

  const handleTagPick = (item) => {
    try {
      editableDivRef.current.focus();
      const sel = window.getSelection();
      const root = editableDivRef.current;
      if (!root) return;
      let range = null;
      // Prioriser la dernière sélection connue dans l'éditeur
      if (lastRangeRef.current && root.contains(lastRangeRef.current.startContainer)) {
        try { range = lastRangeRef.current.cloneRange(); } catch (_) {}
      }
      if (!range) {
        if (!sel || !sel.rangeCount) return;
        range = sel.getRangeAt(0).cloneRange();
        // Si la sélection actuelle n'est pas dans l'éditeur, fallback à la fin
        if (!root.contains(range.startContainer)) {
          const rEnd = document.createRange();
          rEnd.selectNodeContents(root);
          rEnd.collapse(false);
          range = rEnd;
        }
      }
      const token = `[[ref:${item.type}:${item.id}]]`;

      // Essayer un remplacement local dans le nœud texte courant (plus fiable)
      let insertAt = { node: range.startContainer, offset: range.startOffset };
      let localDeleted = false;
      if (insertAt.node && insertAt.node.nodeType === 3) {
        try {
          const textNode = insertAt.node;
          const before = textNode.textContent.slice(0, insertAt.offset);
          const mm = before.match(/#([^\s#\n]{1,30})$/);
          if (mm) {
            const toDel = mm[0];
            const del = document.createRange();
            del.setStart(textNode, insertAt.offset - toDel.length);
            del.setEnd(textNode, insertAt.offset);
            insertAt = { node: textNode, offset: insertAt.offset - toDel.length };
            del.deleteContents();
            localDeleted = true;
          }
        } catch (_) {}
      }

      // Si non supprimé localement (cas rares: caret pas dans un TextNode), fallback sûr: insérer au caret actuel
      const r2 = document.createRange();
      r2.setStart(insertAt.node, insertAt.offset);
      r2.collapse(true);
      const space = document.createTextNode('\u00A0');
      const tag = document.createElement('span');
      tag.className = 'mention';
      tag.setAttribute('data-ref-type', String(item.type || ''));
      tag.setAttribute('data-ref-id', String(item.id || ''));
      tag.contentEditable = 'false';
      const shown = `#${(item.label || item.badge || '').trim()}`;
      tag.textContent = shown || '#contenu';
      r2.insertNode(tag);
      r2.setStartAfter(tag);
      r2.collapse(true);
      r2.insertNode(space);
      r2.setStartAfter(space);
      r2.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r2);
      setShowTagSuggestions(false);
      setTagQuery('');
      setPostText(editableDivRef.current.innerText);
    } catch (_) {}
  };

  // Sérialiser l’éditeur en texte avec tokens [[ref:type:id]] pour l’envoi backend
  const serializeEditorToTextWithTokens = useCallback(() => {
    const root = editableDivRef.current;
    if (!root) return postText || '';
    const parts = [];
    const walk = (node) => {
      if (!node) return;
      if (node.nodeType === 3) { // TEXT
        parts.push(node.nodeValue || '');
        return;
      }
      if (node.nodeType === 1) { // ELEMENT
        const el = node;
        try {
          const t = el.getAttribute && el.getAttribute('data-ref-type');
          const id = el.getAttribute && el.getAttribute('data-ref-id');
          if (t && id) {
            parts.push(`[[ref:${t}:${id}]]`);
            return;
          }
        } catch (_) {}
        // Explorer enfants
        const children = el.childNodes || [];
        for (let i = 0; i < children.length; i++) walk(children[i]);
        return;
      }
    };
    const kids = root.childNodes || [];
    for (let i = 0; i < kids.length; i++) walk(kids[i]);
    return parts.join('');
  }, [postText]);

  const handleMentionSelect = (username, isAuto) => {
    setShowSuggestions(false);
    setMentionQuery('');
    editableDivRef.current.focus();

    const sel = window.getSelection();
    let range = null;
    if (lastRangeRef.current) {
      try { range = lastRangeRef.current.cloneRange(); } catch (_) {}
    }
    if (!range && sel && sel.rangeCount) {
      range = sel.getRangeAt(0);
    }
    if (!range) return;

    let textNode = range.startContainer;
    if (textNode && textNode.nodeType !== 3 && sel && sel.anchorNode && sel.anchorNode.nodeType === 3) {
      textNode = sel.anchorNode;
    }
    const textContent = (textNode && textNode.textContent) || '';
    const endOffset = (textNode === range.startContainer) ? range.startOffset : (sel ? sel.anchorOffset : 0);
    const startOffset = textContent.lastIndexOf('@', endOffset - 1);

    if (startOffset === -1) return;

    try {
      range.setStart(textNode, startOffset);
      range.setEnd(textNode, endOffset);
    } catch (_) { return; }
    range.deleteContents();

    const mention = document.createElement("span");
    mention.className = "mention";
    mention.textContent = `@${username}`;
    mention.contentEditable = "false";

    const space = document.createTextNode("\u00A0");

    range.insertNode(mention);
    range.setStartAfter(mention);
    range.collapse(true);
    range.insertNode(space);
    range.setStartAfter(space);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);
    try { lastRangeRef.current = range.cloneRange(); } catch (_) {}

    setPostText(editableDivRef.current.innerText);
  };

  const highlightExistingMentions = async () => {
    const div = editableDivRef.current;
    if (!div) return;

    const text = div.innerText;
    const mentionRegex = /@(\w+)/g;
    let match;
    const mentions = [];
    while ((match = mentionRegex.exec(text)) !== null) {
        mentions.push(match[1]);
    }

    if (mentions.length === 0) return;

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('username')
        .in('username', mentions);

    if (error || !profiles) return;

    const validUsernames = new Set(profiles.map(p => p.username));
    let newHtml = div.innerHTML;

    validUsernames.forEach(username => {
        const regex = new RegExp(`@${username}(?!</span>)`, 'g');
        newHtml = newHtml.replace(regex, `<span class="mention" contenteditable="false">@${username}</span>`);
    });

    if (newHtml !== div.innerHTML) {
        div.innerHTML = newHtml;
        setPostText(div.innerText);
    }
  };

  const pickSupportedMime = () => {
    const ua = navigator.userAgent.toLowerCase();

    // iOS / Safari (incl. in-app/PWA) -> utiliser MP4/AAC
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("safari")) {
      if (window.MediaRecorder?.isTypeSupported?.("audio/mp4;codecs=mp4a.40.2")) {
        return { type: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" };
      }
      return { type: "audio/mp4", ext: "m4a" };
    }

    // Android (Chrome/Edge) -> préférer webm/opus, sinon mp4/aac
    if (ua.includes("android")) {
      if (window.MediaRecorder?.isTypeSupported?.("audio/webm;codecs=opus")) {
        return { type: "audio/webm;codecs=opus", ext: "webm" };
      }
      if (window.MediaRecorder?.isTypeSupported?.("audio/mp4;codecs=mp4a.40.2")) {
        return { type: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" };
      }
      return { type: "audio/mp4", ext: "m4a" };
    }

    // Desktop: webm (Chrome/Edge), ogg (Firefox), sinon mp4
    if (window.MediaRecorder?.isTypeSupported?.("audio/webm;codecs=opus")) {
      return { type: "audio/webm;codecs=opus", ext: "webm" };
    }
    if (window.MediaRecorder?.isTypeSupported?.("audio/ogg;codecs=opus")) {
      return { type: "audio/ogg;codecs=opus", ext: "ogg" };
    }
    if (window.MediaRecorder?.isTypeSupported?.("audio/mp4;codecs=mp4a.40.2")) {
      return { type: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" };
    }

    // Fallback universel
    return { type: "audio/mp4", ext: "m4a" };
  };

  const startRecording = async () => {
    try {
      setAudioBlob(null);
      setAudioDuration(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const dest = ctx.createMediaStreamDestination();
        osc.connect(dest);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } catch (e) {
        console.warn("AudioContext init échouée", e);
      }
      
      let resolveRecording;
      const recordingDone = new Promise((resolve) => (resolveRecording = resolve));
      recorderPromiseRef.current = recordingDone;

      const chosen = pickSupportedMime();

      // Vérifie le support réel du type choisi; si non supporté, laisse le navigateur décider
      const supportedMimeType = window.MediaRecorder?.isTypeSupported?.(chosen.type)
        ? chosen.type
        : undefined;

      // Conserver dans mimeRef le type effectivement utilisé si connu
      mimeRef.current = { type: supportedMimeType || chosen.type, ext: chosen.ext };

      // Instancie le MediaRecorder sans bitsPerSecond (plus fiable sur mobile)
      const mediaRecorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onerror = (e) => {
        console.error("MediaRecorder error:", e.error || e);
        resolveRecording(null);
      };

      mediaRecorder.onstop = async () => {
        clearInterval(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());

        await new Promise((r) => setTimeout(r, 500));

        const candidateType = (
          mediaRecorder?.mimeType ||
          (chunksRef.current && chunksRef.current[0]?.type) ||
          mimeRef.current?.type ||
          'audio/mp4'
        );
        const finalType = (candidateType || 'audio/mp4').split(';')[0];
        const finalBlob = new Blob(chunksRef.current, { type: finalType });

        console.log("🎧 Taille audio finale :", finalBlob.size, "octets");

        setAudioBlob(finalBlob);
        setRecording(false);
        setRecorder(null);
        resolveRecording(finalBlob);
      };

      mediaRecorder.ignoreMutedMedia = true;

      // Petit délai pour fiabiliser sur mobile (initialisation des pistes)
      await new Promise((r) => setTimeout(r, 300));

      // Démarre sans timeslice pour éviter les chunks vides sur iOS/Android
      mediaRecorder.start();

      setRecording(true);
      setRecorder(mediaRecorder);
      setRecordingTime(0);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingTime((s) => s + 1);
      }, 1000);

      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
      }, 60000);
    } catch (err) {
      console.error("Erreur d’enregistrement :", err);
      toast({
        title: "Erreur d'enregistrement",
        description: "Impossible d'accéder au microphone.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (recorder && recorder.state !== "inactive") {
      recorder.requestData?.();
      setTimeout(() => {
        if (recorder && recorder.state !== "inactive") {
            recorder.stop();
        }
      }, 300);
    }
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    // Réinitialiser audio si présent
    setAudioBlob(null);
    setAudioDuration(0);

    // Si une vidéo est sélectionnée, on force en média unique (pas de multi-images)
    const video = files.find((f) => String(f.type || '').startsWith('video/'));
    if (video) {
      setMediaFiles([]);
      setMediaPreviews([]);
      setMediaFile(video);
      setMediaPreviewUrl(URL.createObjectURL(video));
      try { event.target.value = ''; } catch (_) {}
      return;
    }

    // Sinon, ne garder que des images et accumuler (max 5)
    const imgs = files.filter((f) => String(f.type || '').startsWith('image/'));
    if (!imgs.length) return;
    setMediaFile(null);

    let mergedRef = [];
    setMediaFiles((prev) => {
      const seen = new Set(prev.map((p) => `${p.name}:${p.size}`));
      const merged = [...prev];
      for (const img of imgs) {
        const key = `${img.name}:${img.size}`;
        if (!seen.has(key)) { merged.push(img); seen.add(key); }
      }
      mergedRef = merged.slice(0, 5);
      return mergedRef;
    });
    setMediaPreviews(() => mergedRef.map((f) => URL.createObjectURL(f)));
    setMediaPreviewUrl((prev) => prev || (mergedRef[0] ? URL.createObjectURL(mergedRef[0]) : null));
    try { event.target.value = ''; } catch (_) {}
  };

  const handleSponsorClick = () => {
    toast({
      title: 'Créer un post sponsorisé ?',
      description: 'Post brillant avec la mention « Sponsorisé », soumis à validation et condition de paiement.',
      action: (
        <ToastAction altText="Créer" onClick={() => onCreateSponsored?.()}>Créer</ToastAction>
      ),
    });
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreviewUrl(null);
    if (mediaInputRef.current) {
      mediaInputRef.current.value = '';
    }
    setUploadProgress(0);
    setMediaFiles([]);
    setMediaPreviews([]);
  };
  
    const handleRemoveAudio = () => {
        setAudioBlob(null);
        setAudioDuration(0);
        recorderPromiseRef.current = null;
    };

  const formatRecordingTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const isIOSWebView = () => {
    try {
      const ua = navigator.userAgent || '';
      return /iphone|ipad|ipod/i.test(ua);
    } catch (_) { return false; }
  };

  const uploadFormDataXHR = (url, formData, timeoutMs = 600000) => new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.timeout = timeoutMs;
      try {
        xhr.upload.onprogress = (e) => {
          try {
            if (e && e.lengthComputable) {
              const p = Math.max(0, Math.min(100, Math.round((e.loaded * 100) / (e.total || 1))));
              setUploadProgress(p);
            }
          } catch (_) {}
        };
      } catch (_) {}
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            let data = null;
            try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) { reject(new Error("Réponse inattendue du serveur d'upload")); return; }
            if (!data?.success) { reject(new Error(data?.message || `Erreur d’upload BunnyCDN (code ${xhr.status})`)); return; }
            setUploadProgress(100);
            resolve(data);
          } else {
            reject(new Error(`Erreur d’upload BunnyCDN (code ${xhr.status})`));
          }
        }
      };
      xhr.onerror = () => reject(new Error('Erreur réseau pendant l’upload'));
      xhr.ontimeout = () => reject(new Error('Délai dépassé lors de l’upload (timeout)'));
      xhr.send(formData);
    } catch (e) { reject(e); }
  });

  const uploadToBunny = async (file, folder) => {
    console.log('[CreatePost] uploadToBunny start', { name: file?.name, type: file?.type, folder });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600000);
    try {
      const bases = getApiBaseCandidates();
      let lastErr = null;
      for (const base of bases) {
        try {
          if (isIOSWebView()) {
            const data = await uploadFormDataXHR(`${base}/upload`, formData, 600000);
            console.log('[CreatePost] uploadToBunny XHR success', data?.url);
            clearTimeout(timer);
            setUploadProgress(100);
            return data.url;
          } else {
            const response = await fetch(`${base}/upload`, { method: 'POST', body: formData, signal: controller.signal });
            console.log('[CreatePost] uploadToBunny response status', response?.status, 'via', base);
            const text = await response.text();
            let data = null;
            if (text) {
              try { data = JSON.parse(text); } catch (_) { throw new Error("Réponse inattendue du serveur d'upload"); }
            }
            if (!response.ok || !data?.success) {
              throw new Error(data?.message || `Erreur d’upload BunnyCDN (code ${response.status})`);
            }
            console.log('[CreatePost] uploadToBunny success', data?.url);
            clearTimeout(timer);
            setUploadProgress(100);
            return data.url;
          }
        } catch (e) {
          lastErr = e;
          continue;
        }
      }
      if (lastErr) throw lastErr;
      throw new Error('Aucun endpoint upload disponible');
    } catch (e) {
      if (e.name === 'AbortError') {
        console.warn('[CreatePost] uploadToBunny aborted by timeout');
        throw new Error("Délai dépassé lors de l’upload (timeout)");
      }
      throw e;
    } finally {
      clearTimeout(timer);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handlePublish = async () => {
    await highlightExistingMentions();
    const currentPostText = editableDivRef.current.innerText;
    const finalContent = serializeEditorToTextWithTokens();
    const mentionUsernames = extractUniqueMentions(currentPostText);
    let mentionProfiles = [];

    if (mentionUsernames.length) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('username', mentionUsernames);

      if (!profilesError && profilesData) {
        mentionProfiles = profilesData;
      }
    }

    if (!currentPostText.trim() && !mediaFile && !audioBlob) {
      if (!recorderPromiseRef.current) {
        toast({ title: 'Oups !', description: 'Le post ne peut pas être vide 😅', variant: 'destructive' });
        return;
      }
    }

    if (!user) {
      toast({ title: 'Erreur', description: 'Vous devez être connecté pour publier.', variant: 'destructive' });
      return;
    }
    
    if (recording) {
      toast({ title: "Patientez", description: "L’audio est encore en cours de traitement...", variant: "default" });
      return;
    }

    try {
      setLoading(true);

      let finalAudioBlob = audioBlob;
      if (recorderPromiseRef.current && !finalAudioBlob) {
        finalAudioBlob = await recorderPromiseRef.current;
      }

      if (finalAudioBlob) {
          if (!finalAudioBlob || finalAudioBlob.size < 2000) {
              toast({ title: 'Erreur audio', description: "L’audio semble vide ou trop court. Réessayez.", variant: 'destructive' });
              setLoading(false);
              return;
          }

          const { ext } = mimeRef.current;
          const audioFile = new File([finalAudioBlob], `audio-${Date.now()}.${ext}`, { type: finalAudioBlob.type });
          const { publicUrl: audioUrl } = await uploadAudioFile(audioFile, 'comments_audio');

          const normalizedDuration = Math.max(1, Math.round(audioDuration || recordingTime || 1));
          const { data: insertedPost, error: insertError } = await supabase
            .from('posts')
            .insert([
              {
                user_id: user.id,
                content: finalContent || '',
                likes_count: 0,
                comments_count: 0,
                audio_url: audioUrl,
                audio_duration: normalizedDuration,
              },
            ])
            .select()
            .single();
          if (insertError) throw insertError;

          if (mentionProfiles.length) {
            try {
              setTimeout(() => {
                try {
                  const idsKey = mentionProfiles.map((m) => m.id).filter(Boolean).sort().join(',');
                  const textKey = String(currentPostText || '').slice(0, 50);
                  const k = `nm:${insertedPost?.id || 'np'}:${idsKey}:${textKey}:audio`;
                  const last = Number((typeof sessionStorage !== 'undefined' && sessionStorage.getItem(k)) || 0);
                  if (Date.now() - last < 10000) return;
                  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(k, String(Date.now()));
                } catch (_) {}
                notifyMentions({
                  mentionedUserIds: mentionProfiles.map((m) => m.id),
                  authorName: profile?.username || user?.email || 'Un membre OneKamer',
                  excerpt: currentPostText,
                  postId: insertedPost?.id,
                  preview: { text80: currentPostText || '', mediaType: 'audio' },
                }).catch(() => {});
              }, 1500);
            } catch (notificationError) {
              console.error('Erreur notification OneSignal (commentaire audio):', notificationError);
            }
          }

          // Notifier les followers (audio post)
          try {
            setTimeout(async () => {
              try {
                const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('ok_notif_prefs') : null;
                if (raw) { try { const prefs = JSON.parse(raw); if (prefs && prefs.followers === false) return; } catch {} }
                const { data: rels } = await supabase
                  .from('user_follows')
                  .select('follower_id')
                  .eq('followee_id', user.id);
                const followerIds = Array.isArray(rels) ? rels.map(r => r.follower_id).filter((id) => id && id !== user.id) : [];
                if (!followerIds.length) return;
                const k = `nfp:${insertedPost?.id || 'np'}:audio:${String(currentPostText || '').slice(0,50)}`;
                const last = Number((typeof sessionStorage !== 'undefined' && sessionStorage.getItem(k)) || 0);
                if (Date.now() - last < 10000) return;
                if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(k, String(Date.now()));
                await notifyFollowersNewPost({
                  followerIds,
                  actorName: profile?.username || user?.email || 'Un membre OneKamer',
                  postId: insertedPost?.id,
                  excerpt: currentPostText,
                  preview: { text80: currentPostText || '', mediaType: 'audio' },
                });
              } catch (_) {}
            }, 1500);
          } catch (_) {}
      } else { 
          let postData = {
            user_id: user.id,
            content: finalContent,
            likes_count: 0,
            comments_count: 0,
          };
          
          let pendingEmbed = null;
          if (mediaFiles && mediaFiles.length > 0) {
            const imageUrls = [];
            for (const img of mediaFiles) {
              // Upload séquentiel
              const url = await uploadToBunny(img, "posts");
              imageUrls.push(url);
            }
            if (imageUrls.length) {
              postData.image_url = imageUrls[0];
              postData.image_urls = imageUrls;
            }
          } else if (mediaFile) {
            let fileToUpload = mediaFile;
            if (String(mediaFile?.type || '').startsWith('video/')) {
              try { fileToUpload = await compressVideoIfIOS(mediaFile, '720p'); } catch (_) {}
            }
            const mediaUrl = await uploadToBunny(fileToUpload, "posts");
            const mediaType = mediaFile.type.startsWith('image') ? 'image' : 'video';
            if (mediaType === 'image') {
              postData.image_url = mediaUrl;
            } else {
              postData.video_url = mediaUrl;
              pendingEmbed = null;
            }
          }
          
          const { data: insertedPost, error: insertError } = await supabase
            .from('posts')
            .insert([postData])
            .select()
            .single();
          if (insertError) throw insertError;

          if (insertedPost && mentionProfiles.length) {
            try {
              const mediaType = insertedPost?.image_url ? 'image' : (insertedPost?.video_url ? 'video' : null);
              const mediaUrl = insertedPost?.image_url || insertedPost?.video_url || null;
              setTimeout(() => {
                try {
                  const idsKey = mentionProfiles.map((m) => m.id).filter(Boolean).sort().join(',');
                  const textKey = String(currentPostText || '').slice(0, 50);
                  const mt = mediaType || 'text';
                  const k = `nm:${insertedPost?.id || 'np'}:${idsKey}:${textKey}:${mt}`;
                  const last = Number((typeof sessionStorage !== 'undefined' && sessionStorage.getItem(k)) || 0);
                  if (Date.now() - last < 10000) return;
                  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(k, String(Date.now()));
                } catch (_) {}
                notifyMentions({
                  mentionedUserIds: mentionProfiles.map((m) => m.id),
                  authorName: profile?.username || user?.email || 'Un membre OneKamer',
                  excerpt: currentPostText,
                  postId: insertedPost.id,
                  preview: { text80: currentPostText || '', mediaType, mediaUrl },
                }).catch(() => {});
              }, 1500);
            } catch (notificationError) {
              console.error('Erreur notification OneSignal (mentions):', notificationError);
            }
          }

          // Notifier les followers (post texte/image/vidéo)
          try {
            setTimeout(async () => {
              try {
                const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('ok_notif_prefs') : null;
                if (raw) { try { const prefs = JSON.parse(raw); if (prefs && prefs.followers === false) return; } catch {} }
                const { data: rels } = await supabase
                  .from('user_follows')
                  .select('follower_id')
                  .eq('followee_id', user.id);
                const followerIds = Array.isArray(rels) ? rels.map(r => r.follower_id).filter((id) => id && id !== user.id) : [];
                if (!followerIds.length) return;
                const mediaType = insertedPost?.image_url ? 'image' : (insertedPost?.video_url ? 'video' : null);
                const mediaUrl = insertedPost?.image_url || insertedPost?.video_url || null;
                const mt = mediaType || 'text';
                const k = `nfp:${insertedPost?.id || 'np'}:${mt}:${String(currentPostText || '').slice(0,50)}`;
                const last = Number((typeof sessionStorage !== 'undefined' && sessionStorage.getItem(k)) || 0);
                if (Date.now() - last < 10000) return;
                if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(k, String(Date.now()));
                await notifyFollowersNewPost({
                  followerIds,
                  actorName: profile?.username || user?.email || 'Un membre OneKamer',
                  postId: insertedPost.id,
                  excerpt: currentPostText,
                  preview: { text80: currentPostText || '', mediaType, mediaUrl },
                });
              } catch (_) {}
            }, 1500);
          } catch (_) {}
      }

      toast({
        title: '✅ Publication réussie',
        description: 'Votre post a été publié avec succès 🎉',
      });

      setPostText('');
      if(editableDivRef.current) editableDivRef.current.innerHTML = '';
      handleRemoveMedia();
      handleRemoveAudio();
    } catch (error) {
      console.error('Erreur de publication :', error.message);
      toast({
        title: 'Erreur de publication',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const MentionSuggestions = () => (
    showSuggestions && suggestions.length > 0 && (
      <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="mention-suggestion"
            onMouseDown={(e) => { e.preventDefault(); handleMentionSelect(s.username); }}
            onTouchStart={(e) => { e.preventDefault(); handleMentionSelect(s.username); }}
          >
            <Avatar className="w-6 h-6">
              <AvatarImage src={s.avatar_url} alt={s.username} />
              <AvatarFallback>{getInitials(s.username)}</AvatarFallback>
            </Avatar>
            <span>{s.username}</span>
          </div>
        ))}
      </div>
    )
  );

  return (
    <>
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="relative mb-3">
          <div
            ref={editableDivRef}
            contentEditable={!loading}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={highlightExistingMentions}
            className="editable"
            data-placeholder={`${
                profile?.username
                ? `Quoi de neuf, ${profile.username} ? Mentionnez un membre avec @ et un contenu avec #`
                : 'Quoi de neuf ? Mentionnez un membre avec @ et un contenu avec #'
            }`}
          />
          <MentionSuggestions />
          {showTagSuggestions && tagSuggestions.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-56 overflow-y-auto">
              {tagSuggestions.map((it) => (
                <div
                  key={`${it.type}-${it.id}`}
                  className="flex items-center justify-between gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer"
                  onMouseDown={(e) => { e.preventDefault(); handleTagPick(it); }}
                  onTouchStart={(e) => { e.preventDefault(); handleTagPick(it); }}
                >
                  <span className="text-sm truncate">{it.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#2BA84A]/10 text-[#2BA84A]">#{it.badge}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {mediaPreviewUrl && (
          <div className="relative mb-3">
            {mediaFile && mediaFile.type?.startsWith('video') ? (
              <div className="w-40 h-40">
                <video
                  src={mediaPreviewUrl}
                  controls
                  className="w-full h-full rounded-md object-cover"
                />
              </div>
            ) : (mediaFiles && mediaFiles.length > 1) ? (
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {mediaPreviews.map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt={`Aperçu ${idx + 1}`}
                    className="w-16 h-16 rounded-md object-cover flex-none"
                    draggable={false}
                  />
                ))}
              </div>
            ) : (
              <div className="w-40 h-40">
                <img
                  src={mediaPreviewUrl}
                  alt="Aperçu"
                  className="w-full h-full rounded-md object-cover"
                />
              </div>
            )}
            <Button
              size="icon"
              variant="destructive"
              onClick={handleRemoveMedia}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
            {uploadProgress > 0 && uploadProgress < 100 ? (
              <div className="absolute left-0 right-0 -bottom-5 text-xs text-gray-600">Envoi… {uploadProgress}%</div>
            ) : null}
          </div>
        )}
        
        {audioBlob && !recording && (
             <div className="relative p-2 bg-gray-100 rounded-lg mb-3">
                <AudioPlayer src={URL.createObjectURL(audioBlob)} onCanPlay={(d) => setAudioDuration(d)} mimeType={(mimeRef.current?.type || audioBlob.type || 'audio/mp4').split(';')[0]} />
                <Button size="icon" variant="destructive" onClick={handleRemoveAudio} className="absolute -top-1 -right-1 h-5 w-5 rounded-full">
                    <X className="h-3 w-3" />
                </Button>
            </div>
        )}
        {recording && (
          <div className="flex items-center gap-2 w-full bg-gray-100 p-2 rounded-lg mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-500 font-mono">{formatRecordingTime(recordingTime)}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-2">
               {!recording && !audioBlob && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => mediaInputRef.current?.click()}
                    disabled={loading}
                    aria-label="Ajouter média"
                >
                    <ImageIcon className="h-4 w-4" />
                </Button>
               )}
                <input
                    id="mediaInput"
                    ref={mediaInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileChange}
                    multiple
                    disabled={recording || !!audioBlob}
                />
                {!recording && !audioBlob && isAudioRecordingSupported && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={startRecording}
                    disabled={loading}
                    aria-label="Enregistrer audio"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
                {!recording && SPONSORED_POSTS_ENABLED && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSponsorClick}
                    aria-label="Créer post sponsorisé"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                {recording && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={stopRecording}
                  >
                    <Square className="h-4 w-4 mr-2" /> Stop
                  </Button>
                )}
            </div>

            <Button
              onClick={handlePublish}
              disabled={loading || (!editableDivRef.current?.innerText.trim() && !mediaFile && !audioBlob && !recorderPromiseRef.current) || recording}
              className="bg-gradient-to-r from-[#2BA84A] to-[#F5C300] text-white font-bold"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publier
            </Button>
        </div>

      </CardContent>
    </Card>
    </>
  );
};

export default CreatePost;
