import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRegion } from "@/contexts/RegionContext";
import { useToast } from "@/hooks/use-toast";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import Logo from "@/components/Logo";
import FeedPostCard from "@/components/FeedPostCard";
import CreatePostDialog from "@/components/CreatePostDialog";
import { fetchCommentCounts } from "@/lib/postComments";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Newspaper, 
  Plus,
  PartyPopper, 
  Calendar, 
  GraduationCap,
  Megaphone,
  Bell,
  MessageCircle,
  Pencil
} from "lucide-react";

interface FeedPost {
  id: string;
  academy_id: string | null;
  type: 'notice' | 'admission' | 'seminar' | 'event' | 'academy-admission' | 'life-parenting' | 'free-talk';
  title: string;
  body: string | null;
  image_url: string | null;
  target_regions: string[];
  like_count: number;
  created_at: string;
  seminar_id?: string | null;
  academy: {
    id: string;
    name: string;
    profile_image: string | null;
  } | null;
  author?: {
    user_name: string | null;
  } | null;
  author_role_label?: string | null;
  is_liked?: boolean;
  comment_count?: number;
}

const academyFilterOptions = [
  { id: 'all', label: '전체', icon: null },
  { id: 'notice', label: '학원 소식', icon: Megaphone },
  { id: 'admission', label: '입시 정보', icon: GraduationCap },
  { id: 'seminar', label: '설명회', icon: Calendar },
  { id: 'event', label: '이벤트', icon: PartyPopper },
];

const parentFilterOptions = [
  { id: 'all', label: '전체', icon: null },
  { id: 'academy-admission', label: '학원·입시정보', icon: GraduationCap },
  { id: 'life-parenting', label: '생활·육아', icon: Bell },
  { id: 'free-talk', label: '자유수다', icon: MessageCircle },
];

const AdminCommunityPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedRegion } = useRegion();
  
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCommunityTab, setActiveCommunityTab] = useState<'academy' | 'parent'>('academy');
  const [activeFilter, setActiveFilter] = useState('all');
  const [userId, setUserId] = useState<string | null>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [canManagePosts, setCanManagePosts] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);

        // Prefer academy_members 기반으로 academyId/권한을 결정 (원장 외 멤버도 지원)
        const { data: member } = await supabase
          .from("academy_members")
          .select("academy_id, role, status, permissions")
          .eq("user_id", session.user.id)
          .eq("status", "approved")
          .limit(1)
          .maybeSingle();

        if (member?.academy_id) {
          setAcademyId(member.academy_id);
          const perms = (member as any).permissions as any;
          const can = member.role === "owner" || perms?.manage_posts === true;
          setCanManagePosts(can);
          return;
        }

        // Fallback: legacy owner_id 기반
        const { data: academy } = await supabase
          .from("academies")
          .select("id")
          .eq("owner_id", session.user.id)
          .maybeSingle();

        if (academy) {
          setAcademyId(academy.id);
          setCanManagePosts(true);
        }
      }
    };
    init();
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      let filteredPosts: FeedPost[] = [];

      if (activeCommunityTab === 'parent') {
        let parentQuery = supabase
          .from("feed_posts")
          .select("*")
          .is("academy_id", null)
          .in("type", ["academy-admission", "life-parenting", "free-talk"])
          .order("created_at", { ascending: false })
          .limit(100);

        if (activeFilter !== 'all') {
          parentQuery = parentQuery.eq("type", activeFilter);
        }

        const { data: parentPosts, error: parentError } = await parentQuery;
        if (parentError) throw parentError;

        const authorIds = [...new Set((parentPosts || []).filter((p) => p.author_id).map((p: any) => p.author_id))] as string[];
        const authorsMap: Record<string, { user_name: string | null }> = {};

        if (authorIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, user_name")
            .in("id", authorIds);

          (profiles || []).forEach((p) => {
            authorsMap[p.id] = { user_name: p.user_name };
          });
        }

        // 관리자 화면에서는 user_roles RLS로 인해 role 기반 필터가 비어버릴 수 있어,
        // 학부모 탭은 academy_id=null 글을 그대로 노출한다. (표시 라벨은 "학부모"로 고정)
        filteredPosts = (parentPosts || []).map((post: any) => ({
          ...(post as FeedPost),
          academy: null,
          author: { user_name: post.author_id ? authorsMap[post.author_id]?.user_name || "학부모" : "학부모" },
          author_role_label: "학부모",
        }));
      } else {
        let academyQuery = supabase
          .from("feed_posts")
          .select(`
            *,
            academy:academies!inner(id, name, profile_image)
          `)
          .not("academy_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);

        if (activeFilter !== 'all') {
          academyQuery = academyQuery.eq("type", activeFilter);
        }

        const { data, error } = await academyQuery;
        if (error) throw error;
        filteredPosts = (data || []) as unknown as FeedPost[];
      }

      // Check which posts the user has liked
      if (userId && filteredPosts.length > 0) {
        const postIds = filteredPosts.map(p => p.id);
        const { data: likes } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", userId)
          .in("post_id", postIds);

        const likedPostIds = new Set(likes?.map(l => l.post_id) || []);
        filteredPosts = filteredPosts.map(post => ({
          ...post,
          is_liked: likedPostIds.has(post.id)
        }));
      }

      if (filteredPosts.length > 0) {
        const commentCounts = await fetchCommentCounts(filteredPosts.map((post) => post.id));
        filteredPosts = filteredPosts.map((post) => ({
          ...post,
          comment_count: commentCounts[post.id] || 0,
        }));
      }

      setPosts(filteredPosts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast({ title: "오류", description: "소식을 불러오지 못했습니다", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeCommunityTab, activeFilter, selectedRegion, userId, toast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleLikeToggle = async (postId: string, isLiked: boolean) => {
    if (!userId) return;

    try {
      if (isLiked) {
        await supabase
          .from("post_likes")
          .delete()
          .eq("user_id", userId)
          .eq("post_id", postId);
      } else {
        await supabase
          .from("post_likes")
          .insert({ user_id: userId, post_id: postId });
      }

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            is_liked: !isLiked,
            like_count: post.like_count + (isLiked ? -1 : 1)
          };
        }
        return post;
      }));
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handlePostCreated = () => {
    setIsCreateDialogOpen(false);
    fetchPosts();
    toast({ title: "등록 완료", description: "소식이 등록되었습니다" });
  };

  const currentFilterOptions = activeCommunityTab === 'academy' ? academyFilterOptions : parentFilterOptions;

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size="sm" showText={false} />
          </div>
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold">커뮤니티</span>
          </div>
        </div>
      </header>

      {/* Community Tabs + Category Chips */}
      <div className="sticky top-14 bg-white z-30 border-b border-border">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-0">
          {/* Top tabs: 학원 / 학부모 */}
          <div className="flex border-b border-border">
            <button
              onClick={() => {
                setActiveCommunityTab("academy");
                setActiveFilter("all");
              }}
              className={`flex-1 pb-2 text-center text-sm font-medium transition-colors border-b-2 ${
                activeCommunityTab === "academy"
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent"
              }`}
            >
              학원
            </button>
            <button
              onClick={() => {
                setActiveCommunityTab("parent");
                setActiveFilter("all");
              }}
              className={`flex-1 pb-2 text-center text-sm font-medium transition-colors border-b-2 ${
                activeCommunityTab === "parent"
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent"
              }`}
            >
              학부모
            </button>
          </div>

          {/* Category chips (text only) */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-3">
            {currentFilterOptions.map((option) => {
              const isActive = activeFilter === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => setActiveFilter(option.id)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm whitespace-nowrap
                    transition-all border shrink-0
                    ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-transparent"
                    }
                  `}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="h-3" />
        </div>
      </div>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-card rounded-xl border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <Newspaper className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">
              {activeCommunityTab === 'academy' ? '아직 등록된 소식이 없어요' : '아직 작성된 글이 없어요'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {activeCommunityTab === 'academy' ? '첫 번째 소식을 등록해보세요' : '첫 번째 글을 기다려주세요'}
            </p>
            {activeCommunityTab === 'academy' && academyId && canManagePosts && (
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                소식 작성하기
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                onLikeToggle={handleLikeToggle}
                onAcademyClick={(id) => navigate(`/p/academy/${id}`)}
                onCardClick={() => navigate(`/admin/community/post/${post.id}`, { state: { post } })}
              />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      {activeCommunityTab === 'academy' && academyId && canManagePosts && (
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          className="fixed bottom-24 right-4 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-primary/90 transition-colors"
        >
          <Pencil className="w-6 h-6" />
        </button>
      )}

      {activeCommunityTab === 'academy' && academyId && canManagePosts && (
        <CreatePostDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          academyId={academyId}
          onSuccess={handlePostCreated}
        />
      )}

      <AdminBottomNavigation />
    </div>
  );
};

export default AdminCommunityPage;
