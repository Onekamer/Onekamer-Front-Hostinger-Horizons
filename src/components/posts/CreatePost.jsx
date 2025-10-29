
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Loader2, X, Mic, Square, Play, Pause } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { uploadAudioFile } from '@/utils/audioStorage';
import { notifyMentions } from '@/services/oneSignalNotifications';
import { extractUniqueMentions } from '@/utils/mentions';

const AudioPlayer = ({ src, onCanPlay }) => {
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
                    if(onCanPlay) onCanPlay(audio.duration);
                }
                setCurrentTime(audio.currentTime);
                setIsLoading(false);
            }
            const setAudioTime = () => setCurrentTime(audio.currentTime);

            audio.addEventListener('loadeddata', setAudioData);
            audio.addEventListener('timeupdate', setAudioTime);
            audio.addEventListener('ended', () => setIsPlaying(false));
            audio.addEventListener('canplaythrough', () => {
                setIsLoading(false);
                setAudioData();
            });

            if (audio.readyState >= 2) {
              setAudioData();
            }

            return () => {
                audio.removeEventListener('loadeddata', setAudioData);
                audio.removeEventListener('timeupdate', setAudioTime);
                audio.removeEventListener('ended', () => setIsPlaying(false));
                audio.removeEventListener('canplaythrough', () => {
                    setIsLoading(false);
                    setAudioData();
                });
            }
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
            <audio ref={audioRef} src={src} preload="metadata"></audio>
            <Button onClick={togglePlayPause} size="icon" className="rounded-full w-8 h-8" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : (isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />)}
            </Button>
            <div className="w-full bg-gray-300 rounded-full h-1.5">
                <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                ></div>
            </div>
            <span className="text-xs text-gray-600 w-20 text-center">{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
    );
};

const CreatePost = () => {
  const { user, profile } = useAuth();
  const [postText, setPostText] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const mediaInputRef = useRef(null);
  
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState(null);
  const chunksRef = useRef([]);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);

  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);
  const mimeRef = useRef({ ext: "webm", type: "audio/webm" });
  const recorderPromiseRef = useRef(null);

  const [mentionQuery, setMentionQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const editableDivRef = useRef(null);

  const handleInput = (e) => {
    const div = e.currentTarget;
    const text = div.innerText;
    setPostText(text);

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const textBeforeCursor = range.startContainer.textContent.substring(0, range.startOffset);
        const mentionMatch = textBeforeCursor.match(/@(\w+)$/);
        
        if (mentionMatch) {
            setMentionQuery(mentionMatch[1]);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
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
    const match = text.match(/@(\w+)$/);

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

  const handleMentionSelect = (username, isAuto) => {
    setShowSuggestions(false);
    setMentionQuery('');
    editableDivRef.current.focus();

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    const textNode = range.startContainer;
    const textContent = textNode.textContent;
    const endOffset = range.startOffset;
    const startOffset = textContent.lastIndexOf('@', endOffset - 1);

    if (startOffset === -1) return;

    range.setStart(textNode, startOffset);
    range.setEnd(textNode, endOffset);
    range.deleteContents();

    const mention = document.createElement("span");
    mention.className = "mention";
    mention.textContent = `@${username}`;
    mention.contentEditable = "false";

    const space = document.createTextNode("\u00A0");

    range.insertNode(space);
    range.insertNode(mention);

    range.setStartAfter(space);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);

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
    if (window.MediaRecorder?.isTypeSupported("audio/webm;codecs=opus"))
      return { type: "audio/webm;codecs=opus", ext: "webm" };
    if (window.MediaRecorder?.isTypeSupported("audio/ogg;codecs=opus"))
      return { type: "audio/ogg;codecs=opus", ext: "ogg" };
    if (window.MediaRecorder?.isTypeSupported("audio/mp4;codecs=mp4a.40.2"))
      return { type: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" };
    return { type: "audio/webm", ext: "webm" };
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
      mimeRef.current = chosen;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: chosen.type,
        bitsPerSecond: 128000,
      });

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

        const { type } = mimeRef.current;
        const finalBlob = new Blob(chunksRef.current, {
          type: type.split(";")[0],
        });

        console.log("🎧 Taille audio finale :", finalBlob.size, "octets");

        setAudioBlob(finalBlob);
        setRecording(false);
        setRecorder(null);
        resolveRecording(finalBlob);
      };

      mediaRecorder.ignoreMutedMedia = true;
      mediaRecorder.start(1000);

      setRecording(true);
      setRecorder(mediaRecorder);
      setRecordingTime(0);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingTime((s) => s + 1);
      }, 1000);

      setTimeout(() => {
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
      }, 120000);
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
    const file = event.target.files[0];
    if (file) {
      setMediaFile(file);
      setMediaPreviewUrl(URL.createObjectURL(file));
      setAudioBlob(null);
      setAudioDuration(0);
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreviewUrl(null);
    if (mediaInputRef.current) {
      mediaInputRef.current.value = '';
    }
  };
  
    const handleRemoveAudio = () => {
        setAudioBlob(null);
        setAudioDuration(0);
        recorderPromiseRef.current = null;
    };

  const uploadToBunny = async (file, folder) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error("Erreur d’upload BunnyCDN");
    }
    return data.url;
  };

  const handlePublish = async () => {
    await highlightExistingMentions();
    const currentPostText = editableDivRef.current.innerText;
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
          const { data: insertedComment, error: insertError } = await supabase
            .from("comments")
            .insert({
              type: "audio",
              audio_url: audioUrl,
              user_id: user?.id,
              content_type: "echange",
              content: currentPostText || "",
              created_at: new Date(),
              audio_duration: normalizedDuration,
            })
            .select()
            .single();
          if (insertError) throw insertError;

          if (mentionProfiles.length) {
            try {
              await notifyMentions({
                mentionedUserIds: mentionProfiles.map((m) => m.id),
                authorName: profile?.username || user?.email || 'Un membre OneKamer',
                excerpt: currentPostText,
                postId: insertedComment?.id,
              });
            } catch (notificationError) {
              console.error('Erreur notification OneSignal (commentaire audio):', notificationError);
            }
          }
      } else { 
          let postData = {
            user_id: user.id,
            content: currentPostText,
            likes_count: 0,
            comments_count: 0,
          };
          
          if (mediaFile) {
            const mediaUrl = await uploadToBunny(mediaFile, "posts");
            const mediaType = mediaFile.type.startsWith('image') ? 'image' : 'video';
            if (mediaType === 'image') {
              postData.image_url = mediaUrl;
            } else {
              postData.video_url = mediaUrl;
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
              await notifyMentions({
                mentionedUserIds: mentionProfiles.map((m) => m.id),
                authorName: profile?.username || user?.email || 'Un membre OneKamer',
                excerpt: currentPostText,
                postId: insertedPost.id,
              });
            } catch (notificationError) {
              console.error('Erreur notification OneSignal (mentions):', notificationError);
            }
          }
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
            onClick={() => handleMentionSelect(s.username)}
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
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="relative mb-3">
          <div
            ref={editableDivRef}
            contentEditable={!loading && !recording}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={highlightExistingMentions}
            className="editable"
            data-placeholder={`${
                profile?.username
                ? `Quoi de neuf, ${profile.username} ? Mentionnez un membre avec @`
                : 'Quoi de neuf ? Mentionnez un membre avec @'
            }`}
          />
          <MentionSuggestions />
        </div>

        {mediaPreviewUrl && (
          <div className="relative mb-3 w-40 h-40">
            {mediaFile.type.startsWith('image') ? (
              <img
                src={mediaPreviewUrl}
                alt="Aperçu"
                className="w-full h-full rounded-md object-cover"
              />
            ) : (
              <video
                src={mediaPreviewUrl}
                controls
                className="w-full h-full rounded-md object-cover"
              />
            )}
            <Button
              size="icon"
              variant="destructive"
              onClick={handleRemoveMedia}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {audioBlob && !recording && (
             <div className="relative p-2 bg-gray-100 rounded-lg mb-3">
                <AudioPlayer src={URL.createObjectURL(audioBlob)} onCanPlay={(d) => setAudioDuration(d)} />
                <Button size="icon" variant="destructive" onClick={handleRemoveAudio} className="absolute -top-1 -right-1 h-5 w-5 rounded-full">
                    <X className="h-3 w-3" />
                </Button>
            </div>
        )}
        
        <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-2">
               {!recording && !audioBlob && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => mediaInputRef.current?.click()}
                    disabled={loading}
                >
                    📎 Ajouter média
                </Button>
               )}
                <input
                    id="mediaInput"
                    ref={mediaInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={recording || !!audioBlob}
                />
                
                {!mediaFile && (
                  !recording ? (
                    <Button
                      onClick={startRecording}
                      disabled={loading || !!audioBlob}
                      size="sm"
                      variant="ghost"
                    >
                      <Mic className="h-4 w-4 mr-2" /> Démarrer
                    </Button>
                  ) : (
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      size="sm"
                    >
                      <Square className="h-4 w-4 mr-2" /> Arrêter
                    </Button>
                  )
                )}
                {recording && (
                  <div className="ml-2 flex items-center gap-2 text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-mono text-sm">
                      {String(Math.floor(recordingTime / 60)).padStart(1,"0")}:
                      {String(recordingTime % 60).padStart(2,"0")}
                    </span>
                  </div>
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
  );
};

export default CreatePost;
