import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import Logo from "@/components/Logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultiImageUpload from "@/components/MultiImageUpload";
import { 
  ArrowLeft, 
  Shield, 
  Loader2,
  Plus,
  Bell,
  Calendar,
  PartyPopper,
  GraduationCap,
  Megaphone,
  Trash2,
  Edit
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FeedPost {
  id: string;
  academy_id: string | null;
  type: string;
  title: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  author_id: string | null;
  author?: {
    user_name: string | null;
  };
  academy?: {
    id: string;
    name: string;
    profile_image: string | null;
  } | null;
}

interface AcademyOption {
  id: string;
  name: string;
  profile_image: string | null;
}

const postTypes = [
  { value: 'notice', label: '학원 소식', icon: Megaphone },
  { value: 'admission', label: '입시 정보', icon: GraduationCap },
  { value: 'seminar', label: '설명회', icon: Calendar },
  { value: 'event', label: '이벤트', icon: PartyPopper },
];

const SuperAdminCommunityPage = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [academyOptions, setAcademyOptions] = useState<AcademyOption[]>([]);
  const [academySearch, setAcademySearch] = useState("");
  const [selectedAcademyId, setSelectedAcademyId] = useState<string>("");
  
  // Form state
  const [type, setType] = useState('notice');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isSuperAdmin) {
      fetchInitialData();
    }
  }, [loading, isSuperAdmin]);

  const fetchInitialData = async () => {
    await Promise.all([fetchPosts(), fetchAcademies()]);
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_posts')
        .select(`
          *,
          academy:academies(id, name, profile_image)
        `)
        .not('academy_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch author names
      const authorIds = [...new Set((data || []).filter(p => p.author_id).map(p => p.author_id))];
      let authorsMap: Record<string, string> = {};
      
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, user_name')
          .in('id', authorIds);
        
        if (profiles) {
          authorsMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.user_name || '운영자';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      setPosts((data || []).map(post => ({
        ...post,
        author: { user_name: post.author_id ? (authorsMap[post.author_id] || null) : null },
      })));
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('게시물을 불러오는데 실패했습니다');
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchAcademies = async () => {
    try {
      const { data, error } = await supabase
        .from("academies")
        .select("id, name, profile_image")
        .order("name", { ascending: true });

      if (error) throw error;
      setAcademyOptions((data || []) as AcademyOption[]);
    } catch (error) {
      console.error("Error fetching academies:", error);
      toast.error("학원 목록을 불러오는데 실패했습니다");
    }
  };

  const resetForm = () => {
    setType('notice');
    setTitle('');
    setBody('');
    setImageUrls([]);
    setAcademySearch("");
    setSelectedAcademyId("");
    setEditingPost(null);
  };

  const handleOpenDialog = (post?: FeedPost) => {
    if (post) {
      setEditingPost(post);
      setType(post.type);
      setTitle(post.title);
      setBody(post.body || '');
      setSelectedAcademyId(post.academy_id || "");
      setAcademySearch("");
      if (post.image_url) {
        try {
          const parsed = JSON.parse(post.image_url);
          setImageUrls(Array.isArray(parsed) ? parsed : [post.image_url]);
        } catch {
          setImageUrls(post.image_url ? [post.image_url] : []);
        }
      } else {
        setImageUrls([]);
      }
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }
    if (!body.trim()) {
      toast.error("내용을 입력해주세요");
      return;
    }
    if (!selectedAcademyId) {
      toast.error("게시할 학원을 선택해주세요");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('로그인이 필요합니다');
        return;
      }

      const postData = {
        type,
        title: title.trim(),
        body: body.trim() || null,
        image_url: JSON.stringify(imageUrls),
        author_id: session.user.id,
        academy_id: selectedAcademyId,
        target_regions: [],
        updated_at: new Date().toISOString(),
      };

      if (editingPost) {
        const { error } = await supabase
          .from('feed_posts')
          .update(postData)
          .eq('id', editingPost.id);

        if (error) throw error;
        toast.success('게시물이 수정되었습니다');
      } else {
        const { error } = await supabase
          .from('feed_posts')
          .insert(postData);

        if (error) throw error;
        toast.success('게시물이 등록되었습니다');
      }

      setDialogOpen(false);
      resetForm();
      fetchPosts();
    } catch (error) {
      console.error('Error saving post:', error);
      toast.error('게시물 저장에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('이 게시물을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('feed_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      toast.success('게시물이 삭제되었습니다');
      fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('게시물 삭제에 실패했습니다');
    }
  };

  const getTypeConfig = (typeValue: string) => {
    return postTypes.find(t => t.value === typeValue) || postTypes[0];
  };

  const filteredAcademies = academyOptions.filter((academy) =>
    academy.name.toLowerCase().includes(academySearch.trim().toLowerCase())
  );
  const selectedAcademy =
    academyOptions.find((academy) => academy.id === selectedAcademyId) || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-app-shell flex flex-col items-center justify-center p-4">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">접근 권한이 없습니다</h1>
        <Button onClick={() => navigate('/admin/home')}>돌아가기</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/super')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Logo size="sm" showText={false} />
          <span className="font-semibold text-foreground">커뮤니티 게시물 관리</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Add Button */}
        <Button onClick={() => handleOpenDialog()} className="w-full gap-2">
          <Plus className="w-4 h-4" />
          새 게시물 등록
        </Button>

        {/* Posts List */}
        {postsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-6 text-center text-muted-foreground">
              등록된 게시물이 없습니다
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const config = getTypeConfig(post.type);
              const Icon = config.icon;
              return (
                <Card key={post.id} className="shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-xs text-muted-foreground">{config.label}</span>
                        </div>
                        <h3 className="font-medium text-foreground truncate">{post.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {post.academy?.name || "학원 정보 없음"}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>게시자 {post.author?.user_name || '운영자'}</span>
                          <span>·</span>
                          <span>{format(new Date(post.created_at), 'M/d HH:mm', { locale: ko })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(post)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(post.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border-0">
          <DialogHeader>
            <DialogTitle>{editingPost ? '게시물 수정' : '새 게시물 등록'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>유형 *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {postTypes.map((pt) => {
                    const Icon = pt.icon;
                    return (
                      <SelectItem key={pt.value} value={pt.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{pt.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>게시할 학원 선택 *</Label>
              <Input
                placeholder="학원명 검색"
                value={academySearch}
                onChange={(e) => setAcademySearch(e.target.value)}
              />
              <Select value={selectedAcademyId} onValueChange={setSelectedAcademyId}>
                <SelectTrigger>
                  <SelectValue placeholder="학원을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAcademies.map((academy) => (
                    <SelectItem key={academy.id} value={academy.id}>
                      {academy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAcademy && (
                <div className="flex items-center gap-3 rounded-md border border-border p-2">
                  <div className="h-9 w-9 rounded-full overflow-hidden bg-secondary shrink-0">
                    {selectedAcademy.profile_image ? (
                      <img
                        src={selectedAcademy.profile_image}
                        alt={selectedAcademy.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-primary font-semibold">
                        {selectedAcademy.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{selectedAcademy.name}</p>
                    <p className={cn("text-xs", "text-muted-foreground")}>선택된 게시 학원</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>제목 *</Label>
              <Input
                placeholder="게시물 제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>내용 *</Label>
              <Textarea
                placeholder="게시물 내용"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label>이미지 (선택, 최대 5장)</Label>
              <MultiImageUpload
                values={imageUrls}
                onChange={setImageUrls}
                folder="feed-posts"
                maxImages={5}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !body.trim() || !selectedAcademyId}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? '저장 중...' : editingPost ? '수정' : '등록'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminCommunityPage;
