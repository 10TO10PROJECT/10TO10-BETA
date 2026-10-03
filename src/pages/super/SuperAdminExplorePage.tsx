import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import SuperAdminBottomNavigation from "@/components/SuperAdminBottomNavigation";
import GlobalRegionSelector from "@/components/GlobalRegionSelector";
import { useRegion } from "@/contexts/RegionContext";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import { 
  Search, 
  MapPin, 
  Building2, 
  Loader2,
  BookOpen,
  Calculator,
  Languages,
  TestTube,
  Music,
  Palette,
  Dumbbell
} from "lucide-react";

interface Academy {
  id: string;
  name: string;
  subject: string;
  address: string | null;
  profile_image: string | null;
  target_grade: string | null;
  tags: string[] | null;
  is_mou: boolean | null;
  description: string | null;
}

const subjectCategories = [
  { id: "all", name: "전체", icon: Building2 },
  { id: "math", name: "수학", icon: Calculator },
  { id: "english", name: "영어", icon: Languages },
  { id: "korean", name: "국어", icon: BookOpen },
  { id: "science", name: "과학", icon: TestTube },
  { id: "music", name: "음악", icon: Music },
  { id: "art", name: "미술", icon: Palette },
  { id: "sports", name: "체육", icon: Dumbbell },
];

const SuperAdminExplorePage = () => {
  const navigate = useNavigate();
  const { selectedRegionName } = useRegion();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    fetchAcademies();
  }, [selectedRegionName, selectedCategory]);

  const fetchAcademies = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('academies')
        .select('id, name, subject, address, profile_image, target_grade, tags, is_mou, description');

      if (selectedRegionName && selectedRegionName !== '전체') {
        query = query.ilike('address', `%${selectedRegionName}%`);
      }

      if (selectedCategory !== "all") {
        const categoryMap: Record<string, string> = {
          math: '수학',
          english: '영어',
          korean: '국어',
          science: '과학',
          music: '음악',
          art: '미술',
          sports: '체육'
        };
        query = query.ilike('subject', `%${categoryMap[selectedCategory]}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setAcademies(data || []);
    } catch (error) {
      console.error('Error fetching academies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAcademies = academies.filter(academy =>
    academy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    academy.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold text-foreground">학원 탐색</h1>
            <GlobalRegionSelector />
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="학원명, 과목으로 검색"
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Category Tabs */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 pb-2">
            {subjectCategories.map((category) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  className="whitespace-nowrap gap-1.5"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <Icon className="w-4 h-4" />
                  {category.name}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Location Info */}
        {selectedRegionName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{selectedRegionName}</span>
            <Badge variant="secondary" className="ml-auto">
              {filteredAcademies.length}개 학원
            </Badge>
          </div>
        )}

        {/* Academy List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredAcademies.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {searchQuery ? '검색 결과가 없습니다' : '등록된 학원이 없습니다'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAcademies.map((academy) => (
              <Card
                key={academy.id}
                className="p-3 cursor-pointer hover:shadow-md transition-all border-border"
                onClick={() => navigate(`/super/academy/${academy.id}`)}
              >
                <div className="flex gap-3 items-center">
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {academy.profile_image ? (
                      <img
                        src={academy.profile_image}
                        alt={academy.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <BookOpen className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground text-sm truncate">
                      {academy.name}
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{academy.subject}</span>
                      {academy.tags?.slice(0, 2).map((tag) => (
                        <Badge 
                          key={tag} 
                          variant="secondary" 
                          className="text-xs px-1.5 py-0 h-5 bg-secondary/50"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <SuperAdminBottomNavigation />
    </div>
  );
};

export default SuperAdminExplorePage;
