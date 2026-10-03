import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import Logo from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Shield, 
  Loader2,
  Trash2,
  Search,
  Bell,
  Calendar,
  PartyPopper,
  Heart,
  Building2,
  GraduationCap,
  MessageCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FeedPost {
  id: string;
  academy_id: string | null;
  author_id: string | null;
  type: string;
  title: string;
  body: string | null;
  like_count: number;
  created_at: string;
  academy: {
    id: string;
    name: string;
    profile_image: string | null;
  } | null;
  /** 학원 없이 작성된 글의 표시용 (profiles.user_name) */
  authorName: string | null;
}

type TypeStyle = { label: string; icon: LucideIcon; color: string };

const typeConfig: Record<string, TypeStyle> = {
  notice: { label: '공지', icon: Bell, color: 'bg-blue-500 text-white' },
  seminar: { label: '설명회', icon: Calendar, color: 'bg-orange-500 text-white' },
  event: { label: '이벤트', icon: PartyPopper, color: 'bg-purple-500 text-white' },
  admission: { label: '입시', icon: GraduationCap, color: 'bg-emerald-600 text-white' },
  'academy-admission': { label: '학원·입학', icon: Building2, color: 'bg-teal-600 text-white' },
  'life-parenting': { label: '육아·생활', icon: Users, color: 'bg-pink-600 text-white' },
  'free-talk': { label: '자유수다', icon: MessageCircle, color: 'bg-slate-600 text-white' },
};

const defaultTypeStyle: TypeStyle = {
  label: '게시물',
  icon: MessageCircle,
  color: 'bg-muted text-foreground',
};

const getTypeStyle = (type: string): TypeStyle =>
  typeConfig[type] ?? defaultTypeStyle;

const COMMUNITY_TYPES = new Set([
  'admission',
  'academy-admission',
  'life-parenting',
  'free-talk',
]);

const SuperAdminPostsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isSuperAdmin) {
      fetchPosts();
    }
  }, [loading, isSuperAdmin]);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("feed_posts")
        .select(`
          id, academy_id, author_id, type, title, body, like_count, created_at,
          academy:academies(id, name, profile_image)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const rows = (data || []) as Array<{
        id: string;
        academy_id: string | null;
        author_id: string | null;
        type: string;
        title: string;
        body: string | null;
        like_count: number;
        created_at: string;
        academy:
          | { id: string; name: string; profile_image: string | null }
          | { id: string; name: string; profile_image: string | null }[]
          | null;
      }>;

      const authorIds = [
        ...new Set(
          rows
            .filter((r) => !r.academy_id && r.author_id)
            .map((r) => r.author_id as string)
        ),
      ];

      let authorsMap: Record<string, string | null> = {};
      if (authorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, user_name")
          .in("id", authorIds);

        if (profilesData) {
          authorsMap = profilesData.reduce(
            (acc, profile) => {
              acc[profile.id] = profile.user_name;
              return acc;
            },
            {} as Record<string, string | null>
          );
        }
      }

      const normalized: FeedPost[] = rows.map((row) => {
        const rawAcademy = row.academy;
        const academy = Array.isArray(rawAcademy)
          ? rawAcademy[0] ?? null
          : rawAcademy;

        return {
          id: row.id,
          academy_id: row.academy_id,
          author_id: row.author_id,
          type: row.type,
          title: row.title,
          body: row.body,
          like_count: row.like_count,
          created_at: row.created_at,
          academy,
          authorName:
            row.author_id && !row.academy_id
              ? authorsMap[row.author_id] ?? null
              : null,
        };
      });

      setPosts(normalized);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setPostsLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!deletePostId) return;

    try {
      const { error } = await supabase
        .from("feed_posts")
        .delete()
        .eq("id", deletePostId);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== deletePostId));
      toast({ title: "삭제 완료", description: "게시물이 삭제되었습니다." });
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
    } finally {
      setDeletePostId(null);
    }
  };

  const q = searchQuery.toLowerCase();
  const filteredPosts = posts.filter(
    (post) =>
      post.title.toLowerCase().includes(q) ||
      (post.academy?.name ?? "").toLowerCase().includes(q) ||
      (post.authorName ?? "").toLowerCase().includes(q)
  );

  const backPath = location.pathname.startsWith("/super")
    ? "/super/center"
    : "/admin/super";

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
        <p className="text-muted-foreground text-center mb-6">
          이 페이지는 슈퍼관리자만 접근할 수 있습니다.
        </p>
        <Button onClick={() => navigate('/admin/home')}>
          관리자 홈으로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Logo size="sm" showText={false} />
          <span className="font-semibold text-foreground">게시물 관리</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="게시물 또는 학원명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <Bell className="w-3 h-3" />
            공지 {posts.filter((p) => p.type === "notice").length}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Calendar className="w-3 h-3" />
            설명회 {posts.filter((p) => p.type === "seminar").length}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <PartyPopper className="w-3 h-3" />
            이벤트 {posts.filter((p) => p.type === "event").length}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <MessageCircle className="w-3 h-3" />
            커뮤니티{" "}
            {posts.filter((p) => COMMUNITY_TYPES.has(p.type)).length}
          </Badge>
        </div>

        {/* Posts List */}
        {postsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="shadow-card">
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">게시물이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((post) => {
              const config = getTypeStyle(post.type);
              const TypeIcon = config.icon;
              const sourceLabel =
                post.academy?.name ??
                post.authorName ??
                (post.academy_id == null ? "커뮤니티" : "학원 정보 없음");
              
              return (
                <Card key={post.id} className="shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={cn("text-xs px-2 py-0.5 gap-1", config.color)}>
                            <TypeIcon className="w-3 h-3" />
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(post.created_at), "M/d HH:mm", { locale: ko })}
                          </span>
                        </div>
                        <h3 className="font-medium text-foreground text-sm truncate mb-1">
                          {post.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{sourceLabel}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Heart className="w-3 h-3" />
                            {post.like_count}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => setDeletePostId(post.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletePostId} onOpenChange={() => setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>게시물 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 게시물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePost} className="bg-destructive text-destructive-foreground">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperAdminPostsPage;
