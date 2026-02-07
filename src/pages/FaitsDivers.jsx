import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageCircle, ArrowLeft, Send, Share2, Loader2, FileImage as ImageIcon, X, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import imageCompression from 'browser-image-compression';
import MediaDisplay from '@/components/MediaDisplay';
import FavoriteButton from '@/components/FavoriteButton';
import { canUserAccess } from '@/lib/accessControl';
import { notifyNewFaitDivers, notifyMentionInComment } from '@/services/oneSignalNotifications';
import { extractUniqueMentions } from '@/utils/mentions';

const AddNewsForm = ({ categories, onArticleAdded }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    category_id: '',
    excerpt: '',
    full_content: '',
    image_url: '',
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setImagePreview(URL.createObjectURL(file));

    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      const fileExt = compressedFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('faits_divers')
        .upload(filePath, compressedFile);

      if (uploadError) {
        throw uploadError;
      }
      
      setFormData((prev) => ({ ...prev, image_url: uploadData.path }));
      toast({ title: 'Image prête à être publiée !' });
    } catch (error) {
      console.error('Error uploading image:', error);
      setImagePreview(null);
      toast({
        variant: 'destructive',
        title: "Erreur lors de l'upload de l'image",
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Vous devez être connecté pour publier.',
      });
      return;
    }
    
    const { title, category_id, excerpt, full_content, image_url } = formData;

    if (!title || !category_id || !excerpt || !full_content) {
        toast({ variant: "destructive", title: "Veuillez remplir tous les champs obligatoires."});
        return;
    }

    const { data: newArticle, error } = await supabase
      .from('faits_divers')
      .insert([
        {
          title,
          category_id,
          excerpt,
          full_content,
          image_url,
          author_id: user.id,
          likes_count: 0,
          comments_count: 0,
          favoris_count: 0,
        },
      ])
      .select('*, author:profiles(id, username, avatar_url), category:faits_divers_categories(id, nom)')
      .single();

    if (error) {
      console.error('Error inserting article:', error);
      toast({
        variant: 'destructive',
        title: "Erreur lors de la publication",
        description: error.message,
      });
    } else {
      toast({ title: 'Article publié !' });
      try {
        await notifyNewFaitDivers({
          articleId: newArticle.id,
          title: newArticle.title,
          authorName: newArticle.author?.username || user?.email || 'Un membre OneKamer',
          categoryName: newArticle.category?.nom || '',
          excerpt: newArticle.excerpt || '',
        });
      } catch (notificationError) {
        console.error('Erreur notification OneSignal (fait divers):', notificationError);
      }
      setFormData({
        title: '',
        category_id: '',
        excerpt: '',
        full_content: '',
        image_url: '',
      });
      setImagePreview(null);
      onArticleAdded(newArticle);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-[#E0222A] to-[#F5C300] text-white">+ Créer</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-white">
        <DialogHeader>
          <DialogTitle>Publier un fait divers</DialogTitle>
          <DialogDescription>
            Partagez une actualité avec la communauté.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Titre</Label>
            <Input id="title" name="title" value={formData.title} onChange={handleChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category_id" className="text-right">Catégorie</Label>
            <select id="category_id" name="category_id" value={formData.category_id} onChange={handleChange} className="col-span-3 flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm" required>
              <option value="" disabled>Choisir une catégorie</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nom}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
             <Label htmlFor="image" className="text-right">Image</Label>
             <Input id="image" type="file" accept="image/*" onChange={handleImageUpload} className="col-span-3" disabled={isUploading} />
          </div>
          {isUploading && <p className="col-span-4 text-center text-sm text-gray-500">Téléversement en cours...</p>}
          {imagePreview && (
            <div className="col-span-4">
                <img src={imagePreview} alt="Aperçu" className="rounded-lg mt-2 w-full max-h-40 object-cover" />
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="excerpt" className="text-right">Extrait</Label>
            <Textarea id="excerpt" name="excerpt" value={formData.excerpt} onChange={handleChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="full_content" className="text-right">Contenu</Label>
            <Textarea id="full_content" name="full_content" value={formData.full_content} onChange={handleChange} className="col-span-3 min-h-[120px]" required />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Annuler</Button></DialogClose>
            <Button type="submit" disabled={isUploading}>Publier</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};


const CommentAvatar = ({ avatarPath, username }) => {
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    const fetchAvatar = async () => {
      setAvatarUrl(null);
      if (avatarPath) {
        try {
          const { data, error } = await supabase.storage.from('avatars').createSignedUrl(avatarPath, 3600);
          if (error) throw error;
          if (data) setAvatarUrl(data.signedUrl);
        } catch (error) {
           console.error("Error creating signed URL for avatar:", error);
        }
      }
    };
    fetchAvatar();
  }, [avatarPath]);

  if (avatarUrl) {
    return <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full object-cover" />;
  }
  return (
    <div className="w-8 h-8 bg-[#2BA84A] text-white rounded-full flex items-center justify-center text-sm font-bold">
      {username?.charAt(0).toUpperCase() || '?'}
    </div>
  );
};

const CommentSection = ({ articleId }) => {
  const { user, profile, blockUser, unblockUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    const { data, error } = await supabase
      .from('faits_divers_comments')
      .select('*, user:profiles(id, username, avatar_url, is_deleted)')
      .eq('fait_divers_id', articleId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching comments', error);
    } else {
      const normalized = (data || []).map((c) => {
        const u = c?.user;
        if (u && u.is_deleted === true) {
          return { ...c, user: { ...u, id: null, username: 'Compte supprimé', avatar_url: null } };
        }
        return c;
      });
      const blockedSet = new Set((Array.isArray(profile?.blocked_user_ids) ? profile.blocked_user_ids : []).map(String));
      const filtered = normalized.filter((c) => {
        const uid = c?.user?.id || c?.user_id || null;
        return !uid || !blockedSet.has(String(uid));
      });
      setComments(filtered);
    }
    setLoadingComments(false);
  }, [articleId, profile?.blocked_user_ids]);

  useEffect(() => {
    fetchComments();
    const channel = supabase
      .channel(`comments-fait-divers-${articleId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'faits_divers_comments', filter: `fait_divers_id=eq.${articleId}` },
        async (payload) => {
          const blockedSet = new Set((Array.isArray(profile?.blocked_user_ids) ? profile.blocked_user_ids : []).map(String));
          if (payload?.new?.user_id && blockedSet.has(String(payload.new.user_id))) return;
          const { data: profileData, error: profileError } = await supabase
            .from('profiles').select('id, username, avatar_url, is_deleted').eq('id', payload.new.user_id).single();
          if (!profileError) {
            const userRaw = profileData || { username: 'Anonyme', avatar_url: null };
            const user = userRaw?.is_deleted ? { ...userRaw, id: null, username: 'Compte supprimé', avatar_url: null } : userRaw;
            setComments((prev) => [...prev, { ...payload.new, user }]);
          }
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, [articleId, fetchComments, profile?.blocked_user_ids]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!user) {
      toast({ title: 'Erreur', description: 'Vous devez être connecté.', variant: 'destructive' });
      return;
    }
    setIsPostingComment(true);
    try {
      const mentionUsernames = extractUniqueMentions(newComment);
      let mentionTargets = [];

      if (mentionUsernames.length) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username')
          .in('username', mentionUsernames);

        if (!profilesError && profilesData) {
          mentionTargets = profilesData;
        }
      }

      const { error } = await supabase
        .from('faits_divers_comments')
        .insert([{ 
          fait_divers_id: articleId,
          user_id: user.id,
          content: newComment,
        }]);
      if (error) throw error;
      setNewComment('');

      if (mentionTargets.length) {
        try {
          await notifyMentionInComment({
            mentionedUserIds: mentionTargets.map((target) => target.id),
            authorName: profile?.username || user?.email || 'Un membre OneKamer',
            articleId,
          });
        } catch (notificationError) {
          console.error('Erreur notification OneSignal (mention commentaire):', notificationError);
        }
      }
    } catch (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsPostingComment(false);
    }
  };

  return (
    <div className="pt-4 mt-4 border-t">
      <h3 className="text-lg font-semibold mb-4">Commentaires</h3>
      {loadingComments ? <Loader2 className="animate-spin" /> :
        comments.length > 0 ? (
          <div className="space-y-3 mb-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2 items-start">
                <div className="cursor-pointer" onClick={() => { if (comment.user?.id) navigate(`/profil/${comment.user.id}`) }}>
                  <CommentAvatar avatarPath={comment.user?.avatar_url} username={comment.user?.username} />
                </div>
                <div className="bg-gray-100 rounded-lg px-3 py-2 w-full">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold cursor-pointer" onClick={() => { if (comment.user?.id) navigate(`/profil/${comment.user.id}`) }}>{comment.user?.username}</p>
                    {user && comment.user?.id && String(comment.user.id) !== String(user.id) && (
                      (Array.isArray(profile?.blocked_user_ids) && profile.blocked_user_ids.map(String).includes(String(comment.user.id))) ? (
                        <button className="text-xs text-gray-600 hover:underline" onClick={() => unblockUser(comment.user.id)}>Ne plus bloquer</button>
                      ) : (
                        <button className="text-xs text-red-600 hover:underline" onClick={() => blockUser(comment.user.id)}>Bloquer</button>
                      )
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic mb-4">Soyez le premier à commenter !</p>
        )
      }
      <form onSubmit={handleAddComment} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Écrire un commentaire..." disabled={isPostingComment || !user} />
          <Button type="submit" size="icon" disabled={isPostingComment || !newComment.trim() || !user}>
            {isPostingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {!user && <p className="text-xs text-gray-500 mt-2">Vous devez être <a href="/compte" className="underline text-green-600">connecté</a> pour commenter.</p>}
      </form>
    </div>
  );
};

const NewsDetail = ({ news, onBack, onLikeToggle, isLiked, canManage, onEdit, onDelete }) => {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const { toast } = useToast();

  const handleShare = async (news) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: news.title,
          text: news.excerpt,
          url: window.location.href
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          toast({ title: "Erreur de partage", description: err.message, variant: "destructive" });
        }
      }
    } else {
      toast({ title: "Partage non disponible", description: "Votre navigateur ne supporte pas le partage natif." });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gradient-to-br from-[#FDF9F9] to-[#CDE1D5] overflow-y-auto pt-16 pb-16"
    >
      <div className="container mx-auto px-4">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Card className="shadow-xl rounded-2xl">
          {news.image_url && (
            <div className="h-64 w-full">
              <MediaDisplay bucket="faits_divers" path={news.image_url} alt={news.title} className="w-full h-full object-cover rounded-t-2xl" />
            </div>
          )}
          <CardHeader>
            <span className="bg-[#007AFF] text-white text-xs font-semibold px-2.5 py-1 rounded-full self-start">{news.category?.nom || 'Sans catégorie'}</span>
            <CardTitle className="text-2xl font-bold text-gray-800 mt-2">{news.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{news.full_content}</p>
            <div className="flex flex-wrap items-center gap-4 text-[#6B6B6B] border-t pt-4">
              <FavoriteButton contentType="fait_divers" contentId={news.id} />
              <button 
                className={`flex items-center gap-2 hover:text-[#E0222A] transition-colors ${isLiked ? 'text-red-500' : ''}`}
                onClick={() => onLikeToggle(news.id, isLiked)}
              >
                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                <span>{news.likes_count || 0}</span>
              </button>
              <button className="flex items-center gap-2 hover:text-[#2BA84A] transition-colors" onClick={() => setIsCommentsOpen(prev => !prev)}>
                <MessageCircle className="h-5 w-5" />
                <span>{news.comments_count || 0}</span>
              </button>
              <button className="flex items-center gap-2 hover:text-[#007AFF] transition-colors" onClick={() => handleShare(news)}>
                <Share2 className="h-5 w-5" />
              </button>
              {canManage && (
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => onEdit?.(news)}>
                    <Pencil className="w-4 h-4 mr-2" /> Modifier
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    onClick={async () => {
                      const ok = window.confirm('Confirmer la suppression de cet article ?');
                      if (!ok) return;
                      await onDelete?.(news);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                  </Button>
                </div>
              )}
            </div>
            <AnimatePresence>
              {isCommentsOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <CommentSection articleId={news.id} />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

const FaitsDivers = () => {
  const [newsList, setNewsList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);
  const [userLikes, setUserLikes] = useState({});
  const { user, session, profile } = useAuth();
  const { toast } = useToast();
  const [canCreate, setCanCreate] = useState(false);
  const [searchParams] = useSearchParams();

  const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
  const API_PREFIX = `${serverUrl.replace(/\/$/, '')}/api`;

  const isAdmin =
    profile?.is_admin === true ||
    profile?.is_admin === 1 ||
    profile?.is_admin === 'true' ||
    String(profile?.role || '').toLowerCase() === 'admin';

  const [editOpen, setEditOpen] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    category_id: '',
    excerpt: '',
    full_content: '',
    image_url: '',
  });
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [editUploading, setEditUploading] = useState(false);

  useEffect(() => {
    if (user) {
      canUserAccess(user, 'faits_divers', 'create').then(setCanCreate);
    }
  }, [user]);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('view_faits_divers_accessible')
        .select('*, author:profiles(id, username, avatar_url), category:faits_divers_categories(id, nom)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching news:', error);
        toast({ variant: 'destructive', title: 'Erreur de chargement', description: error.message });
        setNewsList([]);
      } else {
        setNewsList(data || []);
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur de chargement', description: e?.message || 'Impossible de charger les faits divers.' });
      setNewsList([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchUserLikes = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('faits_divers_likes')
      .select('fait_divers_id')
      .eq('user_id', user.id);
    
    if (error) {
        console.error('Error fetching user likes', error);
        return;
    }
    const likedIds = data.reduce((acc, like) => {
        acc[like.fait_divers_id] = true;
        return acc;
    }, {});
    setUserLikes(likedIds);
  }, [user]);

  useEffect(() => {
    fetchNews();
    fetchUserLikes();
  }, [fetchNews, fetchUserLikes]);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase.from('faits_divers_categories').select('*');
    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data || []);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Deeplink : ouverture automatique d'un article via ?articleId=
  useEffect(() => {
    if (!newsList || newsList.length === 0) return;
    const articleId = searchParams.get('articleId');
    if (!articleId) return;

    const found = newsList.find((n) => String(n.id) === String(articleId));
    if (found) {
      setSelectedNews(found);
    }
  }, [newsList, searchParams]);

  const handleNewsUpdate = useCallback((payload) => {
    setNewsList(currentList => currentList.map(item => {
      if (item.id === payload.new.id) {
        const updatedItem = { ...item, ...payload.new };
        if (!updatedItem.category && item.category) updatedItem.category = item.category;
        if (!updatedItem.author && item.author) updatedItem.author = item.author;
        return updatedItem;
      }
      return item;
    }));
    if (selectedNews && selectedNews.id === payload.new.id) {
      setSelectedNews(current => ({ ...current, ...payload.new }));
    }
  }, [selectedNews]);

  useEffect(() => {
    const faitsDiversChannel = supabase
      .channel('public:faits_divers')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'faits_divers' }, handleNewsUpdate)
      .subscribe();
  
    return () => {
      supabase.removeChannel(faitsDiversChannel);
    };
  }, [handleNewsUpdate]);
  
  const handleArticleAdded = (newArticle) => {
    setNewsList(prevList => [newArticle, ...prevList]);
  };

  const handleLikeToggle = async (newsId, isCurrentlyLiked) => {
    if (!user) {
        toast({ title: "Connexion requise", description: "Vous devez être connecté pour liker.", variant: 'destructive' });
        return;
    }
    
    setUserLikes(prev => ({ ...prev, [newsId]: !isCurrentlyLiked }));

    if (isCurrentlyLiked) {
        const { error } = await supabase.from('faits_divers_likes').delete().match({ user_id: user.id, fait_divers_id: newsId });
        if(error) console.error("Error unliking:", error);
    } else {
        const { error } = await supabase.from('faits_divers_likes').insert({ user_id: user.id, fait_divers_id: newsId });
        if(error) console.error("Error liking:", error);
    }
  };
  
  const handleInteractionPrompt = (e, message) => {
    e.stopPropagation();
    toast({ title: "Action requise", description: message });
  };
  
  const handleShare = (e, news) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: news.title,
        text: news.excerpt,
        url: window.location.href
      }).catch(err => {
        if (err.name !== 'AbortError') console.error('Share error:', err)
      });
    } else {
      toast({ title: "Partage non disponible", description: "Votre navigateur ne supporte pas le partage natif." });
    }
  };

  const openEditDialog = (news) => {
    if (!news) return;
    setEditingNews(news);
    setEditFormData({
      title: news.title || '',
      category_id: news.category_id || news.category?.id || '',
      excerpt: news.excerpt || '',
      full_content: news.full_content || '',
      image_url: news.image_url || '',
    });
    setEditImagePreview(null);
    setEditOpen(true);
  };

  const handleDeleteNews = async (news) => {
    if (!news?.id) return;
    if (!user) {
      toast({ title: 'Connexion requise', variant: 'destructive' });
      return;
    }

    const isOwner = news?.author_id === user.id || news?.author?.id === user.id;

    try {
      if (isAdmin && !isOwner) {
        const token = session?.access_token;
        if (!token) throw new Error('Session expirée');
        const resp = await fetch(`${API_PREFIX}/admin/faits-divers/${encodeURIComponent(news.id)}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const out = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(out?.error || 'Erreur serveur');
      } else {
        const { error } = await supabase.from('faits_divers').delete().eq('id', news.id);
        if (error) throw error;
      }

      setNewsList((prev) => (prev || []).filter((n) => String(n.id) !== String(news.id)));
      setSelectedNews(null);
      toast({ title: 'Supprimé', description: 'Article supprimé.' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Suppression impossible.', variant: 'destructive' });
    }
  };

  const handleEditImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setEditUploading(true);
    setEditImagePreview(URL.createObjectURL(file));

    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      const fileExt = compressedFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('faits_divers')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      setEditFormData((prev) => ({ ...prev, image_url: uploadData.path }));
      toast({ title: 'Image prête à être publiée !' });
    } catch (error) {
      console.error('Error uploading image:', error);
      setEditImagePreview(null);
      toast({ variant: 'destructive', title: "Erreur lors de l'upload de l'image", description: error.message });
    } finally {
      setEditUploading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!user || !editingNews?.id) return;

    const { title, category_id, excerpt, full_content, image_url } = editFormData;
    if (!title || !category_id || !excerpt || !full_content) {
      toast({ variant: 'destructive', title: 'Veuillez remplir tous les champs obligatoires.' });
      return;
    }

    const isOwner = editingNews?.author_id === user.id || editingNews?.author?.id === user.id;
    const payload = { title, category_id, excerpt, full_content, image_url };

    try {
      if (isAdmin && !isOwner) {
        const token = session?.access_token;
        if (!token) throw new Error('Session expirée');
        const resp = await fetch(`${API_PREFIX}/admin/faits-divers/${encodeURIComponent(editingNews.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const out = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(out?.error || 'Erreur serveur');
      } else {
        const { error } = await supabase
          .from('faits_divers')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingNews.id);
        if (error) throw error;
      }

      const updatedLocal = { ...editingNews, ...payload };
      setNewsList((prev) => (prev || []).map((n) => (String(n.id) === String(editingNews.id) ? { ...n, ...payload } : n)));
      setSelectedNews((cur) => (cur && String(cur.id) === String(editingNews.id) ? updatedLocal : cur));
      setEditingNews(updatedLocal);
      setEditOpen(false);
      toast({ title: 'Succès', description: 'Article modifié.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Faits Divers - OneKamer.co</title>
        <meta name="description" content="Actualités de la communauté camerounaise sur OneKamer.co" />
      </Helmet>

      
      
      <AnimatePresence>
        {selectedNews && (
          <NewsDetail 
            news={selectedNews} 
            onBack={() => setSelectedNews(null)} 
            onLikeToggle={handleLikeToggle}
            isLiked={!!userLikes[selectedNews.id]}
            canManage={Boolean((user && (selectedNews.author_id === user.id || selectedNews.author?.id === user.id)) || isAdmin)}
            onEdit={openEditDialog}
            onDelete={handleDeleteNews}
          />
        )}
      </AnimatePresence>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <DialogHeader>
            <DialogTitle>Modifier un fait divers</DialogTitle>
            <DialogDescription>Modifiez les informations de votre article.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-title" className="text-right">Titre</Label>
              <Input
                id="edit-title"
                value={editFormData.title}
                onChange={(e) => setEditFormData((p) => ({ ...p, title: e.target.value }))}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-category" className="text-right">Catégorie</Label>
              <select
                id="edit-category"
                value={editFormData.category_id}
                onChange={(e) => setEditFormData((p) => ({ ...p, category_id: e.target.value }))}
                className="col-span-3 flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                required
              >
                <option value="" disabled>Choisir une catégorie</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.nom}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-image" className="text-right">Image</Label>
              <Input id="edit-image" type="file" accept="image/*" onChange={handleEditImageUpload} className="col-span-3" disabled={editUploading} />
            </div>
            {editUploading && <p className="col-span-4 text-center text-sm text-gray-500">Téléversement en cours...</p>}
            {(editImagePreview || editFormData.image_url) && (
              <div className="col-span-4">
                {editImagePreview ? (
                  <img src={editImagePreview} alt="Aperçu" className="rounded-lg mt-2 w-full max-h-40 object-cover" />
                ) : (
                  <MediaDisplay bucket="faits_divers" path={editFormData.image_url} alt="Aperçu" className="rounded-lg mt-2 w-full max-h-40 object-cover" />
                )}
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-excerpt" className="text-right">Extrait</Label>
              <Textarea
                id="edit-excerpt"
                value={editFormData.excerpt}
                onChange={(e) => setEditFormData((p) => ({ ...p, excerpt: e.target.value }))}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-content" className="text-right">Contenu</Label>
              <Textarea
                id="edit-content"
                value={editFormData.full_content}
                onChange={(e) => setEditFormData((p) => ({ ...p, full_content: e.target.value }))}
                className="col-span-3 min-h-[120px]"
                required
              />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost">Annuler</Button></DialogClose>
              <Button type="submit" disabled={editUploading}>Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-between items-center mb-4 gap-4">
            <h1 className="text-3xl font-bold text-[#2BA84A]">Faits Divers</h1>
            {canCreate && (
              <AddNewsForm categories={categories} onArticleAdded={handleArticleAdded} />
            )}
          </div>
        </motion.div>

        <div className="space-y-4">
          {newsList.map((news, index) => (
            <motion.div
              key={news.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => setSelectedNews(news)}
              className="cursor-pointer"
            >
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="md:flex">
                  {news.image_url && (
                    <div className="md:w-1/3 h-48 md:h-auto">
                      <MediaDisplay bucket="faits_divers" path={news.image_url} alt={news.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className={news.image_url ? "md:w-2/3" : "w-full"}>
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-3 py-1 bg-[#007AFF] text-white rounded-full text-xs font-semibold">
                          {news.category?.nom || 'Général'}
                        </span>
                        <div className="flex items-center">
                          <div onClick={e => e.stopPropagation()}><FavoriteButton contentType="fait_divers" contentId={news.id} /></div>
                          <Button variant="ghost" size="icon" onClick={(e) => handleShare(e, news)}>
                            <Share2 className="h-5 w-5 text-gray-500" />
                          </Button>
                        </div>
                      </div>
                      <CardTitle>{news.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-[#6B6B6B] mb-4">{news.excerpt}</p>
                      <div className="flex items-center gap-4 text-[#6B6B6B]">
                        <button 
                          className="flex items-center gap-2 hover:text-[#E0222A] transition-colors"
                          onClick={(e) => handleInteractionPrompt(e, "Ouvrez l'article pour liker.")}
                        >
                          <Heart className={`h-5 w-5 ${userLikes[news.id] ? 'text-red-500 fill-current' : ''}`} />
                          <span>{news.likes_count || 0}</span>
                        </button>
                        <button 
                          className="flex items-center gap-2 hover:text-[#2BA84A] transition-colors"
                          onClick={(e) => handleInteractionPrompt(e, "Ouvrez l'article pour commenter.")}
                        >
                          <MessageCircle className="h-5 w-5" />
                          <span>{news.comments_count || 0}</span>
                        </button>
                      </div>
                    </CardContent>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
};

export default FaitsDivers;