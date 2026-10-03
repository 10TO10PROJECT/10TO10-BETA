import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  Share2, 
  Home, 
  Sparkles, 
  BookOpen, 
  Users, 
  Target,
  CheckCircle2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface StyleInfo {
  name: string;
  emoji: string;
  icon: typeof BookOpen;
  color: string;
  description: string;
  characteristics: string[];
  academyTags: string[];
}

const styleData: Record<string, StyleInfo> = {
  self_directed: {
    name: "자기주도형",
    emoji: "🎯",
    icon: Target,
    color: "bg-blue-500",
    description: "스스로 학습 계획을 세우고 실천하는 것을 좋아해요. 자율성이 보장되면서도 필요할 때 도움받을 수 있는 환경이 최적이에요.",
    characteristics: [
      "혼자서도 집중력을 유지해요",
      "목표 설정과 달성에 동기부여 받아요",
      "자기만의 학습 패턴이 있어요",
    ],
    academyTags: ["자기주도학습", "1:1 맞춤", "자율학습"],
  },
  balanced: {
    name: "균형형",
    emoji: "⚖️",
    icon: BookOpen,
    color: "bg-green-500",
    description: "혼자 공부하는 것과 함께 배우는 것의 균형을 잘 맞춰요. 체계적인 커리큘럼 안에서 자율성도 챙기는 학원이 좋아요.",
    characteristics: [
      "상황에 따라 유연하게 학습해요",
      "그룹 수업과 자습을 병행해요",
      "피드백을 잘 수용해요",
    ],
    academyTags: ["체계적 커리큘럼", "소수정예", "학습 피드백"],
  },
  interactive: {
    name: "소통형",
    emoji: "💬",
    icon: Users,
    color: "bg-purple-500",
    description: "선생님, 친구들과 함께 배우며 성장해요. 활발한 질의응답과 토론이 있는 학원에서 실력이 쑥쑥 늘어요.",
    characteristics: [
      "질문하는 것을 두려워하지 않아요",
      "그룹 활동에서 에너지를 얻어요",
      "설명하며 이해도가 깊어져요",
    ],
    academyTags: ["소통 중심", "토론식 수업", "그룹 스터디"],
  },
  mentored: {
    name: "밀착관리형",
    emoji: "🤝",
    icon: Sparkles,
    color: "bg-orange-500",
    description: "선생님의 세심한 케어와 체계적인 관리 속에서 최고의 성과를 내요. 1:1 맞춤 지도가 있는 학원이 찰떡이에요.",
    characteristics: [
      "구조화된 학습 환경을 선호해요",
      "정기적인 상담과 피드백이 효과적이에요",
      "명확한 목표와 방향 제시가 필요해요",
    ],
    academyTags: ["밀착관리", "1:1 맞춤", "출결관리"],
  },
};

interface Academy {
  id: string;
  name: string;
  profile_image: string | null;
  tags: string[] | null;
  subject: string;
  address: string | null;
}

const LearningStyleResult = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = useRoutePrefix();
  const { learningStyle } = location.state || { learningStyle: "balanced" };
  
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const style = styleData[learningStyle] || styleData.balanced;
  const StyleIcon = style.icon;

  useEffect(() => {
    fetchMatchingAcademies();
    saveLearningStyle();
  }, [learningStyle]);

  const saveLearningStyle = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ learning_style: learningStyle })
          .eq("id", user.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error("Error saving learning style:", error);
    } finally {
      setSaving(false);
    }
  };

  const fetchMatchingAcademies = async () => {
    try {
      // Fetch academies that have matching tags
      const { data, error } = await supabase
        .from("academies")
        .select("id, name, profile_image, tags, subject, address")
        .limit(5);

      if (error) throw error;

      // Filter and sort by matching tags
      const sortedAcademies = (data || [])
        .map(academy => {
          const matchCount = (academy.tags || []).filter(tag => 
            style.academyTags.some(styleTag => 
              tag.toLowerCase().includes(styleTag.toLowerCase())
            )
          ).length;
          return { ...academy, matchCount };
        })
        .sort((a, b) => b.matchCount - a.matchCount);

      setAcademies(sortedAcademies);
    } catch (error) {
      console.error("Error fetching academies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: "나의 학습 성향 테스트 결과",
        text: `저는 ${style.name} 학습자예요! ${style.emoji}`,
        url: window.location.href,
      });
    } catch {
      toast({
        title: "공유 링크가 복사되었어요",
        description: "친구에게 공유해보세요!",
      });
    }
  };

  const calculateMatchScore = (academyTags: string[] | null): number => {
    if (!academyTags) return 70;
    const matchCount = academyTags.filter(tag =>
      style.academyTags.some(styleTag =>
        tag.toLowerCase().includes(styleTag.toLowerCase())
      )
    ).length;
    return Math.min(70 + matchCount * 10, 98);
  };

  return (
    <div className="min-h-screen bg-app-shell pb-24">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground">테스트 결과</h1>
          <Button variant="ghost" size="icon" onClick={handleShare}>
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Result Card */}
        <Card className="overflow-hidden">
          <div className={`${style.color} p-6 text-white text-center`}>
            <div className="text-5xl mb-3">{style.emoji}</div>
            <h2 className="text-2xl font-bold mb-2">
              {style.name} 학습자
            </h2>
            <p className="text-white/90 text-sm">
              우리 아이와 찰떡궁합인 학원을 찾았어요!
            </p>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-foreground leading-relaxed">
              {style.description}
            </p>
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground text-sm">특징</h4>
              <ul className="space-y-2">
                {style.characteristics.map((char, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    {char}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {style.academyTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-primary/10 text-primary">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        </Card>

        {/* Matching Academies */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <StyleIcon className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">
              내 성향과 일치하는 우리 동네 학원
            </h3>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-14 h-14 rounded-lg bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-3 w-32 bg-muted rounded" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : academies.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">
                아직 등록된 학원이 없어요
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {academies.map((academy) => (
                <Card
                  key={academy.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`${prefix}/academy/${academy.id}`)}
                >
                  <div className="flex gap-3">
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
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
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground truncate">
                          {academy.name}
                        </h4>
                        <Badge className="bg-primary text-primary-foreground text-xs flex-shrink-0">
                          {calculateMatchScore(academy.tags)}% 일치
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {academy.subject}
                      </p>
                      {academy.address && (
                        <p className="text-xs text-muted-foreground truncate">
                          {academy.address}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-50">
        <div className="max-w-lg mx-auto">
          <Button 
            className="w-full gradient-primary text-primary-foreground" 
            size="lg"
            onClick={() => navigate(`${prefix}/home`)}
          >
            <Home className="w-4 h-4 mr-2" />
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LearningStyleResult;