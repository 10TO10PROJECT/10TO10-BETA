import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRegion, REGION_ALL } from "@/contexts/RegionContext";
import StudentBottomNavigation from "@/components/StudentBottomNavigation";
import Logo from "@/components/Logo";
import QuickActionMenu from "@/components/QuickActionMenu";
import AgentHeroCard from "@/components/AgentHeroCard";
import LearningStyleBanner from "@/components/LearningStyleBanner";
import GlobalRegionSelector from "@/components/GlobalRegionSelector";
import SeminarCarousel from "@/components/SeminarCarousel";
import AcademyNewsFeed from "@/components/AcademyNewsFeed";
import PostDetailDialog from "@/components/PostDetailDialog";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import TodayScheduleSection from "@/components/TodayScheduleSection";

interface Seminar {
  id: string;
  title: string;
  date: string;
  image_url: string | null;
  academy?: {
    name: string;
  } | null;
}

interface Post {
  id: string;
  title: string;
  content: string | null;
  category: string;
  image_url: string | null;
  created_at: string;
  academy: {
    id: string;
    name: string;
    profile_image: string | null;
  };
}

const StudentHomePage = () => {
  const { selectedRegion } = useRegion();
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingSeminars, setLoadingSeminars] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [learningStyle, setLearningStyle] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);

  const fetchSeminars = useCallback(async (regionId: string) => {
    try {
      setLoadingSeminars(true);

      const threeWeeksFromNow = new Date();
      threeWeeksFromNow.setDate(threeWeeksFromNow.getDate() + 21);
      const now = new Date().toISOString();
      const end = threeWeeksFromNow.toISOString();

      // 학원 소속 설명회 (academy_id 있음)
      const { data: academySeminars } = await supabase
        .from("seminars")
        .select(`
          id, title, date, image_url, location,
          academy:academies!inner (name, target_regions)
        `)
        .eq("status", "recruiting")
        .gte("date", now)
        .lte("date", end)
        .not("academy_id", "is", null);

      // 슈퍼관리자 설명회 (academy_id 없음) — 학부모 홈과 동일하게 포함
      const { data: superAdminSeminars } = await supabase
        .from("seminars")
        .select("id, title, date, image_url, location")
        .eq("status", "recruiting")
        .gte("date", now)
        .lte("date", end)
        .is("academy_id", null);

      // 지역이 있으면 해당 지역만, 없으면 학원 설명회 전부 + 슈퍼관리자 설명회 전부
      const filteredAcademy = (academySeminars || []).filter((s: any) => {
        if (!regionId || regionId === REGION_ALL) return true;
        return s.academy?.target_regions?.includes(regionId);
      });

      const academyList = filteredAcademy.map((s: any) => ({
        id: s.id,
        title: s.title,
        date: s.date,
        image_url: s.image_url,
        academy: s.academy ? { name: s.academy.name } : null,
      }));

      const superAdminList = (superAdminSeminars || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        date: s.date,
        image_url: s.image_url,
        academy: null as { name: string } | null,
      }));

      const allSeminars = [...academyList, ...superAdminList].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setSeminars(allSeminars);
    } catch (error) {
      console.error("Error fetching seminars:", error);
    } finally {
      setLoadingSeminars(false);
    }
  }, []);

  const fetchPosts = useCallback(async (regionId: string) => {
    try {
      setLoadingPosts(true);

      const { data, error } = await supabase
        .from("feed_posts")
        .select(`
          id,
          title,
          body,
          type,
          image_url,
          created_at,
          target_regions,
          academy:academies!inner (
            id,
            name,
            profile_image
          )
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const filtered = (data || []).filter((post: any) => {
        const regions = post.target_regions || [];
        if (!regionId || regionId === REGION_ALL) return true;
        return regions.includes(regionId);
      });

      setPosts(filtered.map((p: any) => ({
        id: p.id,
        title: p.title,
        content: p.body,
        category: p.type,
        image_url: p.image_url,
        created_at: p.created_at,
        academy: {
          id: p.academy.id,
          name: p.academy.name,
          profile_image: p.academy.profile_image,
        },
      })));
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    const checkUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("learning_style, user_name")
            .eq("id", user.id)
            .maybeSingle();
          
          if (profile?.learning_style) {
            setLearningStyle(profile.learning_style);
          }
          if (profile?.user_name) {
            setUserName(profile.user_name);
          }
        }
      } catch (error) {
        console.error("Error checking profile:", error);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkUserProfile();
  }, []);

  useEffect(() => {
    fetchSeminars(selectedRegion);
    fetchPosts(selectedRegion);
  }, [selectedRegion, fetchSeminars, fetchPosts]);

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    setPostDialogOpen(true);
  };


  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <GlobalRegionSelector />
          <div className="flex items-center gap-2">
            <Logo size="sm" showText={false} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto py-6">
        {/* Announcement Banner */}
        <section className="mb-4 px-4">
          <AnnouncementBanner />
        </section>


        {/* Greeting & Agent Hero & Quick Action Menu */}
        <section className="mb-6 bg-primary/10 mx-4 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            {userName || "학생"}님 안녕하세요!
          </h2>
          <AgentHeroCard role="student" />
          <QuickActionMenu isStudent />
        </section>

        {/* Learning Style Banner - 학습 성향 미설정 시에만 표시 */}
        {!checkingProfile && learningStyle === null && (
          <section className="mb-4 px-4">
            <LearningStyleBanner />
          </section>
        )}

        {/* Today's Schedule Section */}
        <section className="mb-6 px-4">
          <TodayScheduleSection />
        </section>

        {/* Empty Region State - EmptyRegionState 임시 미사용, 항상 캐러셀/피드 표시 */}
        <>
          <SeminarCarousel 
            seminars={seminars} 
            loading={loadingSeminars} 
          />
          <AcademyNewsFeed
            posts={posts}
            loading={loadingPosts}
            onPostClick={handlePostClick}
          />
        </>
      </main>

      {/* Post Detail Dialog */}
      <PostDetailDialog
        post={selectedPost}
        open={postDialogOpen}
        onClose={() => setPostDialogOpen(false)}
      />

      <StudentBottomNavigation />
    </div>
  );
};

export default StudentHomePage;
