import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRegion, REGION_ALL } from "@/contexts/RegionContext";
import { useToast } from "@/hooks/use-toast";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import BottomNavigation from "@/components/BottomNavigation";
import Logo from "@/components/Logo";
import GlobalRegionSelector from "@/components/GlobalRegionSelector";
import FeedPostCard from "@/components/FeedPostCard";
import ParentCommunityPostDialog from "@/components/ParentCommunityPostDialog";
import { fetchCommentCounts } from "@/lib/postComments";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Bell, 
  PartyPopper, 
  Calendar, 
  Search,
  Loader2,
  GraduationCap,
  Megaphone,
  MessageCircle,
  Pencil,
  FileText,
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
  author_id?: string | null;
  academy?: {
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

const PAGE_SIZE = 15;
const COMMUNITY_DEBUG_LOG = true;

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

const CommunityPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedRegion } = useRegion();
  const prefix = useRoutePrefix();
  
  const [activeCommunityTab, setActiveCommunityTab] = useState<'academy' | 'parent'>('academy');
  const [activeFilter, setActiveFilter] = useState('all');
  const [feedSortOrder, setFeedSortOrder] = useState<'latest' | 'popular'>('latest');
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [bookmarkedAcademies, setBookmarkedAcademies] = useState<string[]>([]);
  const [isParentPostDialogOpen, setIsParentPostDialogOpen] = useState(false);
  const lastFilterKeyRef = useRef<string | null>(null);
  const debugLog = useCallback((message: string, payload?: unknown) => {
    if (!COMMUNITY_DEBUG_LOG) return;
    if (payload === undefined) {
      console.log(`[CommunityPage] ${message}`);
      return;
    }
    console.log(`[CommunityPage] ${message}`, payload);
  }, []);

  // Fetch function for infinite scroll
  const fetchPosts = useCallback(async (page: number): Promise<{ data: FeedPost[]; hasMore: boolean }> => {
    try {
      debugLog("fetchPosts:start", {
        page,
        activeCommunityTab,
        activeFilter,
        feedSortOrder,
        selectedRegion,
        isLoggedIn: Boolean(userId),
      });

      if (activeCommunityTab === 'parent') {
        let parentQuery = supabase
          .from("feed_posts")
          .select("*")
          .is("academy_id", null)
          .in("type", ["academy-admission", "life-parenting", "free-talk"]);

        if (activeFilter !== 'all') {
          parentQuery = parentQuery.eq("type", activeFilter);
        }

        const { data: parentPosts, error: parentPostsError } = await parentQuery.order("created_at", { ascending: false });
        if (parentPostsError) throw parentPostsError;
        debugLog("parentQuery:result", {
          count: parentPosts?.length || 0,
        });

        const authorIds = [...new Set((parentPosts || []).filter((post) => post.author_id).map((post) => post.author_id))] as string[];
        let authorsMap: Record<string, { user_name: string | null; role: string | null; is_super_admin: boolean | null }> = {};

        if (authorIds.length > 0) {
          const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
            supabase.from("profiles").select("id, user_name").in("id", authorIds),
            supabase.from("user_roles").select("user_id, role, is_super_admin").in("user_id", authorIds),
          ]);

          // 비로그인/권한 제한으로 profiles 조회가 막혀도 목록은 계속 노출
          const safeProfiles = profilesError ? [] : (profiles || []);

          // 비로그인/권한 제한으로 user_roles 조회가 막히면(rolesError),
          // 학부모 탭은 academy_id=null 커뮤니티 글을 그대로 노출한다.
          const roleMap =
            rolesError
              ? {}
              : (roles || []).reduce<Record<string, { role: string | null; is_super_admin: boolean | null }>>((acc, role) => {
                  acc[role.user_id] = { role: role.role, is_super_admin: role.is_super_admin };
                  return acc;
                }, {});

          authorsMap = safeProfiles.reduce<Record<string, { user_name: string | null; role: string | null; is_super_admin: boolean | null }>>((acc, profile) => {
            acc[profile.id] = {
              user_name: profile.user_name,
              role: rolesError ? "parent" : (roleMap[profile.id]?.role || null),
              is_super_admin: rolesError ? false : (roleMap[profile.id]?.is_super_admin || false),
            };
            return acc;
          }, authorsMap);

          debugLog("parentAuthorLookup:result", {
            authorIds: authorIds.length,
            profilesLoaded: safeProfiles.length,
          });
        }

        // rolesError가 나는 환경(비로그인 등)에서도 목록이 비지 않도록,
        // 기본적으로 academy_id=null 커뮤니티 글은 노출하고 라벨을 "학부모"로 고정한다.
        let allPosts = (parentPosts || []).map((post) => ({
          ...(post as FeedPost),
          academy: null,
          author: { user_name: post.author_id ? authorsMap[post.author_id]?.user_name || "학부모" : "학부모" },
          author_role_label: "학부모",
        }));

        allPosts = Array.from(new Map(allPosts.map((post) => [post.id, post])).values());
        allPosts.sort((a, b) =>
          feedSortOrder === 'latest'
            ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            : (b.like_count ?? 0) - (a.like_count ?? 0)
        );

        let posts = allPosts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

        if (userId && posts.length > 0) {
          const postIds = posts.map((p) => p.id);
          const { data: likes } = await supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", userId)
            .in("post_id", postIds);

          const likedPostIds = new Set(likes?.map((like) => like.post_id) || []);
          posts = posts.map((post) => ({
            ...post,
            is_liked: likedPostIds.has(post.id),
          }));
        }

        if (posts.length > 0) {
          try {
            const commentCounts = await fetchCommentCounts(posts.map((post) => post.id));
            posts = posts.map((post) => ({
              ...post,
              comment_count: commentCounts[post.id] || 0,
            }));
          } catch {
            posts = posts.map((post) => ({ ...post, comment_count: post.comment_count || 0 }));
          }
        }

        debugLog("fetchPosts:end(parent)", {
          returnedCount: posts.length,
          hasMore: posts.length === PAGE_SIZE,
        });
        return { data: posts, hasMore: posts.length === PAGE_SIZE };
      }

      let academyIds: string[] | null = null;

      // "전체"가 아닐 때만 지역별 학원 필터 적용
      if (selectedRegion && selectedRegion !== REGION_ALL) {
        const { data: academiesInRegion, error: academiesError } = await supabase
          .from("academies")
          .select("id")
          .contains("target_regions", [selectedRegion]);
        // 비로그인/권한 제한으로 academies 조회가 막히면 지역 필터를 적용하지 않는다.
        if (!academiesError) {
          academyIds = academiesInRegion?.map(a => a.id) || [];
          debugLog("regionAcademyFilter:applied", {
            selectedRegion,
            academyCountInRegion: academyIds.length,
          });
        } else {
          debugLog("regionAcademyFilter:error", academiesError);
        }
      }

      // Build queries for both academy posts and super admin posts
      let academyQuery = supabase
        .from("feed_posts")
        .select("*")
        .not("academy_id", "is", null);
      
      if (academyIds !== null) {
        // 특정 지역: 해당 지역 학원 글만
        if (academyIds.length > 0) {
          academyQuery = academyQuery.in("academy_id", academyIds);
        } else {
          academyQuery = academyQuery.eq("academy_id", "00000000-0000-0000-0000-000000000000"); // impossible match
        }
      }

      // Super admin posts (no academy_id)
      let superAdminQuery = supabase
        .from("feed_posts")
        .select("*")
        .is("academy_id", null)
        .in("type", ["notice", "admission", "seminar", "event"]);

      if (activeFilter !== 'all' && activeFilter !== 'bookmarked') {
        academyQuery = academyQuery.eq("type", activeFilter);
        superAdminQuery = superAdminQuery.eq("type", activeFilter);
      }

      const [academyResult, superAdminResult] = await Promise.all([
        academyQuery.order("created_at", { ascending: false }),
        superAdminQuery.order("created_at", { ascending: false })
      ]);
      debugLog("academyAndSuperAdminQuery:result", {
        academyError: academyResult.error || null,
        superAdminError: superAdminResult.error || null,
        academyCount: academyResult.data?.length || 0,
        superAdminCount: superAdminResult.data?.length || 0,
      });

      let allPosts: FeedPost[] = [];
      
      // Add academy posts (academy 조인 권한 이슈를 피하기 위해 2단계 조회)
      if (academyResult.data && academyResult.data.length > 0) {
        const rawAcademyPosts = academyResult.data as unknown as FeedPost[];
        const academyPostAcademyIds = [
          ...new Set(
            rawAcademyPosts
              .map((post) => post.academy_id)
              .filter((academyId): academyId is string => Boolean(academyId))
          ),
        ];

        let academyMap: Record<string, { id: string; name: string; profile_image: string | null }> = {};

        if (academyPostAcademyIds.length > 0) {
          const { data: academiesData, error: academiesDataError } = await supabase
            .from("academies")
            .select("id, name, profile_image")
            .in("id", academyPostAcademyIds);

          if (!academiesDataError && academiesData) {
            academyMap = academiesData.reduce<Record<string, { id: string; name: string; profile_image: string | null }>>((acc, academy) => {
              acc[academy.id] = {
                id: academy.id,
                name: academy.name,
                profile_image: academy.profile_image,
              };
              return acc;
            }, {});
            debugLog("academyLookup:result", {
              requestedAcademyIds: academyPostAcademyIds.length,
              loadedAcademies: academiesData.length,
            });
          } else {
            debugLog("academyLookup:error", academiesDataError);
          }
        }

        const normalizedAcademyPosts = rawAcademyPosts.map((post) => ({
          ...post,
          academy: post.academy_id
            ? (academyMap[post.academy_id] || {
                id: post.academy_id,
                name: "학원",
                profile_image: null,
              })
            : null,
          author_role_label: "학원",
        }));

        allPosts = [...normalizedAcademyPosts];
      }

      // Add super admin posts with author info
      if (superAdminResult.data && superAdminResult.data.length > 0) {
        const authorIds = [...new Set(superAdminResult.data.filter(p => p.author_id).map(p => p.author_id))];
        let authorsMap: Record<string, { user_name: string | null; role: string | null; is_super_admin: boolean | null }> = {};
        
        if (authorIds.length > 0) {
          const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
            supabase.from("profiles").select("id, user_name").in("id", authorIds),
            supabase.from("user_roles").select("user_id, role, is_super_admin").in("user_id", authorIds),
          ]);
          // 비로그인/권한 제한으로 profiles 조회가 막혀도 글 목록은 노출
          const safeProfiles = profilesError ? [] : (profiles || []);

          const roleMap =
            rolesError
              ? {}
              : (roles || []).reduce<Record<string, { role: string | null; is_super_admin: boolean | null }>>((acc, role) => {
                  acc[role.user_id] = { role: role.role, is_super_admin: role.is_super_admin };
                  return acc;
                }, {});

          authorsMap = safeProfiles.reduce((acc, p) => {
            acc[p.id] = {
              user_name: p.user_name,
              role: rolesError ? null : (roleMap[p.id]?.role || null),
              is_super_admin: rolesError ? true : (roleMap[p.id]?.is_super_admin || false),
            };
            return acc;
          }, {} as Record<string, { user_name: string | null; role: string | null; is_super_admin: boolean | null }>);
          debugLog("superAdminAuthorLookup:result", {
            authorIds: authorIds.length,
            profilesLoaded: safeProfiles.length,
          });
        }

        // user_roles 조회가 막혀도(super admin 여부 판단 불가) academy_id=null & (notice/admission/seminar/event) 글은 운영자 글로 취급해 노출
        const superAdminPosts = superAdminResult.data.map(post => ({
          ...post,
          academy: null,
          author: { user_name: post.author_id ? authorsMap[post.author_id]?.user_name || '관리자' : '관리자' },
          author_role_label: '운영자',
        })) as unknown as FeedPost[];

        allPosts = [...allPosts, ...superAdminPosts];
      }

      allPosts = Array.from(
        new Map(allPosts.map((post) => [post.id, post])).values()
      );

      allPosts.sort((a, b) =>
        feedSortOrder === 'latest'
          ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          : (b.like_count ?? 0) - (a.like_count ?? 0)
      );

      // Paginate
      const paginatedPosts = allPosts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      // Filter by bookmarked academies if needed
      let posts = paginatedPosts;
      if (activeFilter === 'bookmarked') {
        posts = posts.filter(post => post.academy_id && bookmarkedAcademies.includes(post.academy_id));
      }

      // Check which posts the user has liked
      if (userId && posts.length > 0) {
        const postIds = posts.map(p => p.id);
        const { data: likes } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", userId)
          .in("post_id", postIds);

        const likedPostIds = new Set(likes?.map(l => l.post_id) || []);
        posts = posts.map(post => ({
          ...post,
          is_liked: likedPostIds.has(post.id)
        }));
      }

      if (posts.length > 0) {
        try {
          const commentCounts = await fetchCommentCounts(posts.map((post) => post.id));
          posts = posts.map((post) => ({
            ...post,
            comment_count: commentCounts[post.id] || 0,
          }));
        } catch {
          posts = posts.map((post) => ({ ...post, comment_count: post.comment_count || 0 }));
        }
      }

      debugLog("fetchPosts:end(academy)", {
        mergedCount: allPosts.length,
        returnedCount: posts.length,
        hasMore: posts.length === PAGE_SIZE,
      });
      return { data: posts, hasMore: posts.length === PAGE_SIZE };
    } catch (error) {
      console.error("[CommunityPage] fetchPosts:error", error);
      return { data: [], hasMore: false };
    }
  }, [activeCommunityTab, selectedRegion, activeFilter, feedSortOrder, bookmarkedAcademies, userId, debugLog]);

  const {
    items: posts,
    setItems: setPosts,
    loading,
    loadingMore,
    hasMore,
    reset,
    setLoadMoreElement
  } = useInfiniteScroll<FeedPost>({ fetchFn: fetchPosts });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      debugLog("init:session", {
        hasSession: Boolean(session),
        userId: session?.user?.id || null,
      });
      if (session?.user) {
        setUserId(session.user.id);
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setUserRole(roleData?.role || null);
        debugLog("init:userRole", { role: roleData?.role || null });

        // Get bookmarked academies
        const { data: bookmarks } = await supabase
          .from("bookmarks")
          .select("academy_id")
          .eq("user_id", session.user.id);
        
        if (bookmarks) {
          setBookmarkedAcademies(bookmarks.map(b => b.academy_id));
          debugLog("init:bookmarksLoaded", { count: bookmarks.length });
        }
      }
    };
    init();
  }, [debugLog]);

  // Reset and refetch when filter, region, or sort changes
  useEffect(() => {
    const filterKey = JSON.stringify({
      activeCommunityTab,
      selectedRegion,
      activeFilter,
      feedSortOrder,
    });

    if (lastFilterKeyRef.current === null) {
      lastFilterKeyRef.current = filterKey;
      return;
    }

    // React StrictMode에서 mount 시 effect가 2회 실행될 수 있으므로
    // 실제 값 변화가 없으면 reset을 건너뛴다.
    if (lastFilterKeyRef.current === filterKey) {
      return;
    }

    lastFilterKeyRef.current = filterKey;
    debugLog("filtersChanged:reset", {
      activeCommunityTab,
      activeFilter,
      feedSortOrder,
      selectedRegion,
    });
    reset();
  }, [activeCommunityTab, selectedRegion, activeFilter, feedSortOrder, reset, debugLog]);

  useEffect(() => {
    debugLog("renderState", {
      postCount: posts.length,
      loading,
      loadingMore,
      hasMore,
      activeCommunityTab,
      activeFilter,
    });
  }, [posts.length, loading, loadingMore, hasMore, activeCommunityTab, activeFilter, debugLog]);

  const currentFilterOptions = activeCommunityTab === 'academy' ? academyFilterOptions : parentFilterOptions;

  const handleLikeToggle = async (postId: string, isLiked: boolean) => {
    if (!userId) {
      toast({ title: "로그인 필요", description: "좋아요를 누르려면 로그인하세요" });
      return;
    }

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

      // Update local state optimistically
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
      toast({ title: "오류", description: "좋아요 처리에 실패했습니다", variant: "destructive" });
    }
  };


  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <GlobalRegionSelector />
          <Logo size="sm" showText={false} />
        </div>
      </header>

      {/* Community Tabs + Filter Chips */}
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

          {/* Sort: 최신순 / 인기순 - 오른쪽 정렬 */}
          <div className="flex items-center justify-end gap-1 mt-2 mb-3">
            <button
              type="button"
              onClick={() => setFeedSortOrder('latest')}
              className={`text-sm transition-colors ${
                feedSortOrder === 'latest'
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              최신
            </button>
            <span className="text-muted-foreground/60">|</span>
            <button
              type="button"
              onClick={() => setFeedSortOrder('popular')}
              className={`text-sm transition-colors ${
                feedSortOrder === 'popular'
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              인기
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {loading && posts.length === 0 ? (
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
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 text-muted-foreground/80">
              <FileText className="w-16 h-16" strokeWidth={1.25} />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2 text-center">
              {activeCommunityTab === 'academy' ? '아직 등록된 소식이 없어요' : '아직 작성된 글이 없어요'}
            </h3>
            <p className="text-sm text-muted-foreground mb-8 text-center">
              {activeCommunityTab === 'academy'
                ? "새로운 학원 소식을 기다려주세요"
                : "첫 번째 글을 작성해보세요!"}
            </p>
            {activeCommunityTab === 'academy' ? (
              <Button
                onClick={() => navigate(`${prefix}/explore`)}
                className="gap-2 rounded-xl px-6"
              >
                <Search className="w-4 h-4" />
                탐색하러 가기
              </Button>
            ) : (
              <Button
                onClick={() => setIsParentPostDialogOpen(true)}
                className="gap-2 rounded-xl px-6"
              >
                <Pencil className="w-4 h-4" />
                글 작성하기
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
                onAcademyClick={(id) => navigate(`${prefix}/academy/${id}`)}
                onCardClick={() => navigate(`${prefix}/community/post/${post.id}`, { state: { post } })}
              />
            ))}
            
            {/* Infinite scroll trigger */}
            <div ref={setLoadMoreElement} className="py-4 flex justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">불러오는 중...</span>
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <p className="text-sm text-muted-foreground">모든 소식을 불러왔습니다</p>
              )}
            </div>
          </div>
        )}
      </main>

      {activeCommunityTab === 'parent' && userRole === 'parent' && (
        <>
          <button
            onClick={() => setIsParentPostDialogOpen(true)}
            className="fixed bottom-24 right-4 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-primary/90 transition-colors"
            aria-label="글쓰기"
          >
            <Pencil className="w-6 h-6" />
          </button>
          <ParentCommunityPostDialog
            open={isParentPostDialogOpen}
            onOpenChange={setIsParentPostDialogOpen}
            onSuccess={() => {
              reset();
            }}
          />
        </>
      )}

      <BottomNavigation />
    </div>
  );
};

export default CommunityPage;
