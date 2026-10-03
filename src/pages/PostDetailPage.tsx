import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import FeedPostDetailSheet from "@/components/FeedPostDetailSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCommentCounts } from "@/lib/postComments";

export interface FeedPostForDetail {
  id: string;
  academy_id: string | null;
  type: 'notice' | 'admission' | 'seminar' | 'event' | 'academy-admission' | 'life-parenting' | 'free-talk';
  title: string;
  body: string | null;
  image_url: string | null;
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

const PostDetailPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = useRoutePrefix();
  const statePost = location.state?.post as FeedPostForDetail | undefined;

  const [post, setPost] = useState<FeedPostForDetail | null>(statePost ?? null);
  const [loading, setLoading] = useState(!statePost);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (statePost && statePost.id === postId) {
      setPost(statePost);
      setLoading(false);
      return;
    }
    if (!postId) {
      setLoading(false);
      setError("게시글을 찾을 수 없습니다.");
      return;
    }

    const fetchPost = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: row, error: fetchError } = await supabase
          .from("feed_posts")
          .select(`
            id,
            academy_id,
            type,
            title,
            body,
            image_url,
            like_count,
            created_at,
            seminar_id,
            author_id,
            academy:academies(id, name, profile_image)
          `)
          .eq("id", postId)
          .single();

        if (fetchError || !row) {
          setError("게시글을 불러올 수 없습니다.");
          setPost(null);
          return;
        }

        const postRow = row as Record<string, unknown>;
        const academy = postRow.academy as { id: string; name: string; profile_image: string | null } | null;
        const authorId = postRow.author_id as string | null;

        let author: { user_name: string | null } | null = null;
        let author_role_label: string | null = null;

        if (authorId) {
          const [{ data: profile }, { data: roleRow }] = await Promise.all([
            supabase.from("profiles").select("user_name").eq("id", authorId).maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", authorId).maybeSingle(),
          ]);
          author = profile ? { user_name: profile.user_name } : null;
          const role = roleRow?.role;
          author_role_label = role === "parent" ? "학부모" : role === "student" ? "학생" : role === "admin" ? "학원" : "운영자";
        }

        const postWithMeta: FeedPostForDetail = {
          id: row.id,
          academy_id: row.academy_id,
          type: row.type as FeedPostForDetail["type"],
          title: row.title,
          body: row.body,
          image_url: row.image_url,
          like_count: row.like_count,
          created_at: row.created_at,
          seminar_id: row.seminar_id,
          author_id: row.author_id,
          academy: academy ?? null,
          author: author ?? null,
          author_role_label,
          is_liked: false,
          comment_count: 0,
        };

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: likeRow } = await supabase
            .from("post_likes")
            .select("post_id")
            .eq("post_id", postId)
            .eq("user_id", session.user.id)
            .maybeSingle();
          postWithMeta.is_liked = !!likeRow;
          const counts = await fetchCommentCounts([postId]);
          postWithMeta.comment_count = counts[postId] ?? 0;
        }

        setPost(postWithMeta);
      } catch (e) {
        console.error(e);
        setError("게시글을 불러오는 중 오류가 발생했습니다.");
        setPost(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId, statePost?.id]);

  const handleLikeToggle = async (id: string, isLiked: boolean) => {
    if (!post) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    try {
      if (isLiked) {
        await supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", session.user.id);
      } else {
        await supabase.from("post_likes").insert({ post_id: id, user_id: session.user.id });
      }
      setPost((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              is_liked: !isLiked,
              like_count: prev.like_count + (isLiked ? -1 : 1),
            }
          : prev
      );
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app-shell">
        <div className="h-14 border-b border-border flex items-center px-4">
          <Skeleton className="h-9 w-9 rounded" />
          <Skeleton className="h-5 w-24 ml-4" />
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-app-shell flex flex-col">
        <div className="h-14 border-b border-border flex items-center px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-foreground"
            aria-label="뒤로가기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="flex-1 text-center font-semibold">글 상세</span>
          <div className="w-10" />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground">{error || "게시글을 찾을 수 없습니다."}</p>
        </div>
      </div>
    );
  }

  return (
    <FeedPostDetailSheet
      post={post}
      onBack={() => navigate(-1)}
      onLikeToggle={handleLikeToggle}
      onAcademyClick={(id) => navigate(`${prefix}/academy/${id}`)}
      onSeminarClick={(seminarId) => navigate(`${prefix}/seminar/${seminarId}`)}
      onDelete={(id) => {
        navigate(-1);
      }}
    />
  );
};

export default PostDetailPage;
