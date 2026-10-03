import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Newspaper, ChevronRight } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ko } from "date-fns/locale";
import SuperAdminBottomNavigation from "@/components/SuperAdminBottomNavigation";

interface FeedPost {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  type: string;
  created_at: string;
  like_count: number;
  academy_id: string | null;
  author_id: string | null;
  academy?: {
    id: string;
    name: string;
    profile_image: string | null;
  } | null;
  author?: {
    user_name: string | null;
  } | null;
}

interface Seminar {
  id: string;
  title: string;
  description: string | null;
  date: string;
  location: string | null;
  image_url: string | null;
  capacity: number | null;
  status: string;
  academy_id: string | null;
  author_id: string | null;
  academy?: {
    id: string;
    name: string;
    profile_image: string | null;
  } | null;
  author?: {
    user_name: string | null;
  } | null;
}

const SuperAdminCommunityViewPage = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("feed");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchPosts(), fetchSeminars()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_posts')
        .select(`
          id,
          title,
          body,
          image_url,
          type,
          created_at,
          like_count,
          academy_id,
          author_id,
          academy:academies(id, name, profile_image)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const authorIds = (data || [])
        .filter(post => post.author_id && !post.academy_id)
        .map(post => post.author_id);

      let authorsMap: Record<string, string | null> = {};
      if (authorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, user_name')
          .in('id', authorIds);

        if (profilesData) {
          authorsMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile.user_name;
            return acc;
          }, {} as Record<string, string | null>);
        }
      }

      setPosts((data || []).map(post => ({
        ...post,
        author: { user_name: post.author_id ? (authorsMap[post.author_id] || null) : null }
      })));
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const fetchSeminars = async () => {
    try {
      const { data, error } = await supabase
        .from('seminars')
        .select(`
          id,
          title,
          description,
          date,
          location,
          image_url,
          capacity,
          status,
          academy_id,
          author_id,
          academy:academies(id, name, profile_image)
        `)
        .eq('status', 'recruiting')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;

      const authorIds = (data || [])
        .filter(s => s.author_id && !s.academy_id)
        .map(s => s.author_id);

      let authorsMap: Record<string, string | null> = {};
      if (authorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, user_name')
          .in('id', authorIds);

        if (profilesData) {
          authorsMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile.user_name;
            return acc;
          }, {} as Record<string, string | null>);
        }
      }

      setSeminars((data || []).map(seminar => ({
        ...seminar,
        author: { user_name: seminar.author_id ? (authorsMap[seminar.author_id] || null) : null }
      })));
    } catch (error) {
      console.error('Error fetching seminars:', error);
    }
  };

  const getDDay = (dateStr: string) => {
    const targetDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    const diff = differenceInDays(targetDate, today);
    if (diff === 0) return "D-Day";
    if (diff > 0) return `D-${diff}`;
    return "종료";
  };

  const getDisplayName = (post: FeedPost) => {
    if (post.academy_id && post.academy) {
      return post.academy.name;
    }
    return post.author?.user_name || '운영자';
  };

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <h1 className="font-semibold text-foreground">커뮤니티</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-12 p-0">
            <TabsTrigger 
              value="feed" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <Newspaper className="w-4 h-4 mr-2" />
              피드
            </TabsTrigger>
            <TabsTrigger 
              value="seminars" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <Calendar className="w-4 h-4 mr-2" />
              설명회
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">게시물이 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/super/post/${post.id}`)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">{getDisplayName(post)}</span>
                      {!post.academy_id && (
                        <Badge variant="secondary" className="text-xs">운영자</Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{post.title}</h3>
                    {post.body && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{post.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{format(new Date(post.created_at), 'yyyy.MM.dd')}</span>
                      <span>•</span>
                      <span>좋아요 {post.like_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="seminars" className="mt-0 p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : seminars.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">예정된 설명회가 없습니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {seminars.map((seminar) => {
                  const dDay = getDDay(seminar.date);
                  const isUrgent = dDay === "D-Day" || (dDay.startsWith("D-") && parseInt(dDay.slice(2)) <= 3);
                  
                  return (
                    <Card
                      key={seminar.id}
                      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => navigate(`/super/seminar/${seminar.id}`)}
                    >
                      <div className="relative aspect-square bg-muted">
                        {seminar.image_url ? (
                          <img
                            src={seminar.image_url}
                            alt={seminar.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                            <span className="text-3xl">📚</span>
                          </div>
                        )}
                        <Badge
                          className={`absolute top-2 left-2 text-xs ${
                            isUrgent
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          {dDay}
                        </Badge>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-1 truncate">
                          {seminar.academy_id && seminar.academy 
                            ? seminar.academy.name 
                            : (seminar.author?.user_name || "운영자")}
                        </p>
                        <h4 className="font-medium text-foreground text-sm line-clamp-2 leading-tight mb-2">
                          {seminar.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(seminar.date), "M/d(EEE) a h시", { locale: ko })}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <SuperAdminBottomNavigation />
    </div>
  );
};

export default SuperAdminCommunityViewPage;
