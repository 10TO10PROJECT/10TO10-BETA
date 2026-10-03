import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import Logo from "@/components/Logo";
import ImageUpload from "@/components/ImageUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Bell, Megaphone, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { logError } from "@/lib/errorLogger";
import { postSchema, validateInput } from "@/lib/validation";

interface Post {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  category: string;
  created_at: string;
}

const categoryOptions = [
  { value: "notice", label: "공지", icon: Bell },
  { value: "news", label: "소식", icon: Megaphone },
  { value: "event", label: "이벤트", icon: PartyPopper },
];

const PostManagementPage = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("news");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAcademyAndPosts();
  }, []);

  const fetchAcademyAndPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: academy } = await supabase
        .from("academies")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (academy) {
        setAcademyId(academy.id);
        
        const { data: postsData } = await supabase
          .from("posts")
          .select("*")
          .eq("academy_id", academy.id)
          .order("created_at", { ascending: false });
        
        setPosts(postsData || []);
      }
    } catch (error) {
      logError("fetch-posts", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setCategory("news");
    setImageUrl("");
    setEditingPost(null);
  };

  const openEditDialog = (post: Post) => {
    setEditingPost(post);
    setTitle(post.title);
    setContent(post.content || "");
    setCategory(post.category);
    setImageUrl(post.image_url || "");
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!academyId) {
      toast.error("학원 정보를 찾을 수 없습니다");
      return;
    }

    // Validate input
    const validation = validateInput(postSchema, {
      title,
      content: content || null,
      category: category as "news" | "notice" | "event" | "review",
      image_url: imageUrl || null,
    });

    if (!validation.success) {
      toast.error((validation as { success: false; error: string }).error);
      return;
    }

    const validatedData = (validation as { success: true; data: { title: string; content?: string | null; category: string; image_url?: string | null } }).data;

    setSubmitting(true);
    try {
      if (editingPost) {
        const { error } = await supabase
          .from("posts")
          .update({
            title: validatedData.title,
            content: validatedData.content,
            category: validatedData.category,
            image_url: validatedData.image_url,
          })
          .eq("id", editingPost.id);

        if (error) throw error;
        toast.success("소식이 수정되었습니다");
      } else {
        const { error } = await supabase.from("posts").insert({
          academy_id: academyId,
          title: validatedData.title,
          content: validatedData.content,
          category: validatedData.category,
          image_url: validatedData.image_url,
        });

        if (error) throw error;
        toast.success("소식이 등록되었습니다");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchAcademyAndPosts();
    } catch (error) {
      logError("save-post", error);
      toast.error("저장에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId);

      if (error) throw error;
      toast.success("소식이 삭제되었습니다");
      fetchAcademyAndPosts();
    } catch (error) {
      logError("delete-post", error);
      toast.error("삭제에 실패했습니다");
    }
  };

  const getCategoryConfig = (cat: string) => {
    return categoryOptions.find(c => c.value === cat) || categoryOptions[1];
  };

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" showText={false} />
          <span className="text-xs font-medium text-primary bg-secondary px-2 py-1 rounded-full">
            소식 관리
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-foreground">학원 소식 관리</h1>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="w-4 h-4" />
                새 소식
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingPost ? "소식 수정" : "새 소식 작성"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>카테고리</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.icon className="w-4 h-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>제목 *</Label>
                  <Input
                    placeholder="소식 제목을 입력하세요"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>내용</Label>
                  <Textarea
                    placeholder="소식 내용을 입력하세요"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label>이미지</Label>
                  <ImageUpload
                    value={imageUrl}
                    onChange={setImageUrl}
                    folder="posts"
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "저장 중..." : editingPost ? "수정 완료" : "등록하기"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-6 text-center">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">등록된 소식이 없습니다</p>
              <p className="text-sm text-muted-foreground mt-1">
                새 소식을 작성해보세요
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const catConfig = getCategoryConfig(post.category);
              const CatIcon = catConfig.icon;
              
              return (
                <Card key={post.id} className="shadow-card">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {post.image_url && (
                        <img
                          src={post.image_url}
                          alt={post.title}
                          className="w-16 h-16 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            <CatIcon className="w-3 h-3 mr-1" />
                            {catConfig.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(post.created_at), "M월 d일", { locale: ko })}
                          </span>
                        </div>
                        <h3 className="font-medium text-foreground line-clamp-1">
                          {post.title}
                        </h3>
                        {post.content && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                            {post.content}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(post)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(post.id)}
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

      <AdminBottomNavigation />
    </div>
  );
};

export default PostManagementPage;
