import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRegion, REGION_ALL } from "@/contexts/RegionContext";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import BottomNavigation from "@/components/BottomNavigation";
import Logo from "@/components/Logo";
import AdminHeader from "@/components/AdminHeader";
import GlobalRegionSelector from "@/components/GlobalRegionSelector";
import AcademyMap from "@/components/AcademyMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Search, Filter, Heart, Calendar, Clock, Users, Building2, X } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Academy = Database["public"]["Tables"]["academies"]["Row"] & {
  target_regions?: string[];
};

interface Seminar {
  id: string;
  title: string;
  description: string | null;
  date: string;
  location: string | null;
  capacity: number | null;
  status: "recruiting" | "closed";
  subject: string | null;
  target_grade: string | null;
  academy?: {
    name: string;
    target_regions?: string[];
  };
}

const ExplorePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedRegion } = useRegion();
  const prefix = useRoutePrefix();
  const initialTab = searchParams.get("tab") === "seminars" ? "seminars" : "academies";
  
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>(
    searchParams.get("subject") || "전체"
  );
  const [selectedGrade, setSelectedGrade] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [searchResultDrawerOpen, setSearchResultDrawerOpen] = useState(false);
  const aboveMapRef = useRef<HTMLDivElement>(null);
  const [aboveMapHeight, setAboveMapHeight] = useState(0);

  useEffect(() => {
    const el = aboveMapRef.current;
    if (!el) return;
    const update = () => setAboveMapHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (mapExpanded) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mapExpanded]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchBookmarks(session.user.id);
      }
    });
  }, []);

  useEffect(() => {
    fetchAcademies();
    fetchSeminars();
  }, [selectedRegion]);

  const fetchAcademies = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("academies")
        .select("*")
        .order("is_mou", { ascending: false })
        .order("created_at", { ascending: false });

      // "전체"가 아니면 해당 지역 학원만 표시. target_regions가 비어 있거나 null인 학원(신규 등록)도 포함해 목록에 노출
      if (selectedRegion !== REGION_ALL) {
        query = query.or(
          `target_regions.cs.{"${selectedRegion}"},target_regions.is.null`
        );
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setAcademies((data as Academy[]) || []);
    } catch (error) {
      console.error("Error fetching academies:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeminars = async () => {
    try {
      const { data, error } = await supabase
        .from("seminars")
        .select(`
          *,
          academy:academies (
            name,
            target_regions
          )
        `)
        .order("status", { ascending: true })
        .order("date", { ascending: true });

      if (error) throw error;
      
      // 슈퍼관리자 설명회(academy_id 없음)는 지역과 무관하게 표시
      const filtered = ((data as any) || []).filter((seminar: any) => {
        if (!seminar.academy_id || selectedRegion === REGION_ALL) return true;
        const regions = seminar.academy?.target_regions || [];
        return regions.includes(selectedRegion);
      });
      
      setSeminars(filtered);
    } catch (error) {
      console.error("Error fetching seminars:", error);
    }
  };

  const fetchBookmarks = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("academy_id")
        .eq("user_id", userId);

      if (error) throw error;
      setBookmarkedIds(new Set(data?.map(b => b.academy_id) || []));
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
    }
  };

  const toggleBookmark = async (academyId: string) => {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }

    const isBookmarked = bookmarkedIds.has(academyId);

    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("academy_id", academyId);

        if (error) throw error;

        setBookmarkedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(academyId);
          return newSet;
        });
        toast.success("찜 목록에서 삭제되었습니다");
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({
            user_id: user.id,
            academy_id: academyId
          });

        if (error) throw error;

        setBookmarkedIds(prev => new Set(prev).add(academyId));
        toast.success("찜 목록에 추가되었습니다");
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      toast.error("오류가 발생했습니다");
    }
  };

  const subjects = ["전체", "수학", "영어", "국어", "과학", "코딩", "음악", "미술"];
  const grades = ["전체", "초등학생", "중학생", "고등학생"];

  const filteredAcademies = academies.filter(academy => {
    const matchesSubject = selectedSubject === "전체" || academy.subject === selectedSubject;
    const matchesSearch = searchQuery === "" || 
      academy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      academy.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  const filteredSeminars = seminars.filter(seminar => {
    const matchesSubject = selectedSubject === "전체" || seminar.subject === selectedSubject;
    const matchesGrade = selectedGrade === "전체" || seminar.target_grade === selectedGrade;
    const matchesSearch = searchQuery === "" || 
      seminar.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesGrade && matchesSearch;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div ref={aboveMapRef}>
        {/* Header */}
        <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <GlobalRegionSelector />
            <div className="flex items-center gap-2">
              <AdminHeader />
              <Logo size="sm" showText={false} />
            </div>
          </div>
        </header>

        {/* Toggle Tabs */}
        <div className="bg-card border-b border-border">
          <div className="max-w-lg mx-auto px-4 py-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="academies" className="gap-1">
                  <Building2 className="w-4 h-4" />
                  학원 찾기
                </TabsTrigger>
                <TabsTrigger value="seminars" className="gap-1">
                  <Calendar className="w-4 h-4" />
                  설명회 찾기
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Search */}
        <div className="bg-card border-b border-border">
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={activeTab === "academies" ? "학원명, 과목으로 검색" : "설명회 제목으로 검색"}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (activeTab === "academies" && mapExpanded) {
                      setSearchResultDrawerOpen(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      activeTab === "academies" &&
                      mapExpanded
                    ) {
                      e.preventDefault();
                      setSearchResultDrawerOpen(true);
                    }
                  }}
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted border-none text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <Button variant="outline" size="icon" className="shrink-0">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Map Area (Academies only) */}
      {activeTab === "academies" &&
        (mapExpanded ? (
          <div
            className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full max-w-lg z-50 bg-background"
            style={{ top: aboveMapHeight }}
          >
            <div className="relative w-full h-full">
              <AcademyMap
                expanded
                focusedAcademy={
                  searchResultDrawerOpen &&
                  filteredAcademies.length > 0 &&
                  filteredAcademies[0].latitude != null &&
                  filteredAcademies[0].longitude != null
                    ? {
                        id: filteredAcademies[0].id,
                        latitude: filteredAcademies[0].latitude,
                        longitude: filteredAcademies[0].longitude,
                      }
                    : null
                }
                onAcademyInfoClick={(id) => navigate(`${prefix}/academy/${id}`)}
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-3 right-3 z-[60] rounded-full shadow-md"
                onClick={() => {
                  setMapExpanded(false);
                  setSearchResultDrawerOpen(false);
                }}
                aria-label="지도 접기"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        ) : (
          <AcademyMap
            onMapClick={() => setMapExpanded(true)}
            onAcademyInfoClick={(id) => navigate(`${prefix}/academy/${id}`)}
          />
        ))}

      {/* 검색 결과 Drawer (확대된 지도에서만) */}
      {activeTab === "academies" && mapExpanded && (
        <Drawer open={searchResultDrawerOpen} onOpenChange={setSearchResultDrawerOpen}>
          <DrawerContent
            className="max-w-lg mx-auto max-h-[85vh] flex flex-col"
            overlayClassName="bg-transparent pointer-events-none"
            bottomOffset={64}
          >
            <DrawerHeader>
              <DrawerTitle className="text-center">검색 결과</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-8 flex-1 overflow-y-auto min-h-0">
              <p className="text-sm text-muted-foreground mb-4">
                총 <span className="text-primary font-semibold">{filteredAcademies.length}개</span> 학원
              </p>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : filteredAcademies.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">검색 결과가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAcademies.map((academy) => (
                    <div
                      key={academy.id}
                      onClick={() => {
                        setSearchResultDrawerOpen(false);
                        navigate(`${prefix}/academy/${academy.id}`);
                      }}
                      className="bg-card border border-border rounded-xl p-4 shadow-card hover:shadow-soft transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex gap-4">
                        <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                          {academy.profile_image ? (
                            <img
                              src={academy.profile_image}
                              alt={academy.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl font-bold text-primary">
                              {academy.name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-foreground truncate">{academy.name}</h4>
                              <p className="text-sm text-muted-foreground">{academy.subject} 전문</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBookmark(academy.id);
                              }}
                              className="p-1.5 hover:bg-muted rounded-full transition-colors shrink-0 ml-2"
                            >
                              <Heart
                                className={`w-5 h-5 transition-colors ${
                                  bookmarkedIds.has(academy.id)
                                    ? "fill-red-500 text-red-500"
                                    : "text-muted-foreground hover:text-red-500"
                                }`}
                              />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {academy.is_mou && (
                              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                                MOU
                              </Badge>
                            )}
                            {academy.tags &&
                              academy.tags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                          </div>
                          {academy.address && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {academy.address}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Filter Tags */}
      {!(activeTab === "academies" && mapExpanded) && (
      <div className="max-w-lg mx-auto px-4 py-3 border-b border-border bg-card">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-2">
          {subjects.map((subject) => (
            <Button
              key={subject}
              variant={selectedSubject === subject ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setSelectedSubject(subject)}
            >
              {subject}
            </Button>
          ))}
        </div>
        {activeTab === "seminars" && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {grades.map((grade) => (
              <Button
                key={grade}
                variant={selectedGrade === grade ? "secondary" : "ghost"}
                size="sm"
                className="shrink-0"
                onClick={() => setSelectedGrade(grade)}
              >
                {grade}
              </Button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Results */}
      {!(activeTab === "academies" && mapExpanded) && (
      <main className="max-w-lg mx-auto px-4 py-4">
        {activeTab === "academies" ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              총 <span className="text-primary font-semibold">{filteredAcademies.length}개</span> 학원
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredAcademies.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">검색 결과가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAcademies.map((academy) => (
                  <div
                    key={academy.id}
                    onClick={() => navigate(`${prefix}/academy/${academy.id}`)}
                    className="bg-card border border-border rounded-xl p-4 shadow-card hover:shadow-soft transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                        {academy.profile_image ? (
                          <img 
                            src={academy.profile_image} 
                            alt={academy.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl font-bold text-primary">
                            {academy.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground truncate">{academy.name}</h4>
                            <p className="text-sm text-muted-foreground">{academy.subject} 전문</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleBookmark(academy.id); }}
                            className="p-1.5 hover:bg-muted rounded-full transition-colors shrink-0 ml-2"
                          >
                            <Heart 
                              className={`w-5 h-5 transition-colors ${
                                bookmarkedIds.has(academy.id) 
                                  ? "fill-red-500 text-red-500" 
                                  : "text-muted-foreground hover:text-red-500"
                              }`} 
                            />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {academy.is_mou && (
                            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                              MOU
                            </Badge>
                          )}
                          {academy.tags && academy.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        {academy.address && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {academy.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              총 <span className="text-primary font-semibold">{filteredSeminars.length}개</span> 설명회
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredSeminars.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">검색 결과가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSeminars.map((seminar) => (
                  <div
                    key={seminar.id}
                    onClick={() => navigate(`${prefix}/seminar/${seminar.id}`)}
                    className="bg-card border border-border rounded-xl p-4 shadow-card hover:shadow-soft transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                        <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={seminar.status === "recruiting" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {seminar.status === "recruiting" ? "모집중" : "마감"}
                          </Badge>
                          {seminar.subject && (
                            <Badge variant="outline" className="text-xs">
                              {seminar.subject}
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-semibold text-foreground line-clamp-1">
                          {seminar.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(seminar.date)} {formatTime(seminar.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {seminar.capacity || 30}명
                          </span>
                        </div>
                        {seminar.academy && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {seminar.academy.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      )}

      <BottomNavigation />
    </div>
  );
};

export default ExplorePage;
