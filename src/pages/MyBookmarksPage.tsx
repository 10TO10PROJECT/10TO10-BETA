import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import BottomNavigation from "@/components/BottomNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Heart } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Bookmark = Database["public"]["Tables"]["bookmarks"]["Row"];
type Academy = Database["public"]["Tables"]["academies"]["Row"];

interface BookmarkWithAcademy extends Bookmark {
  academy?: Academy;
}

const MyBookmarksPage = () => {
  const navigate = useNavigate();
  const prefix = useRoutePrefix();
  const [bookmarks, setBookmarks] = useState<BookmarkWithAcademy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookmarks = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      try {
        const { data: bookmarkData, error: bookmarkError } = await supabase
          .from("bookmarks")
          .select("*")
          .eq("user_id", session.user.id);

        if (bookmarkError) throw bookmarkError;

        if (bookmarkData && bookmarkData.length > 0) {
          const academyIds = bookmarkData.map(b => b.academy_id);
          const { data: academyData } = await supabase
            .from("academies")
            .select("*")
            .in("id", academyIds);

          const bookmarksWithAcademies = bookmarkData.map(bookmark => ({
            ...bookmark,
            academy: academyData?.find(a => a.id === bookmark.academy_id)
          }));

          setBookmarks(bookmarksWithAcademies);
        } else {
          setBookmarks([]);
        }
      } catch (error) {
        console.error("Error fetching bookmarks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookmarks();
  }, []);

  const removeBookmark = async (bookmarkId: string) => {
    try {
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("id", bookmarkId);

      if (error) throw error;

      setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
      toast.success("찜 목록에서 삭제되었습니다");
    } catch (error) {
      console.error("Error removing bookmark:", error);
      toast.error("삭제에 실패했습니다");
    }
  };

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">찜한 학원</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : bookmarks.length === 0 ? (
          <Card className="shadow-card border-border">
            <CardContent className="p-6 text-center">
              <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">찜한 학원이 없습니다</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => navigate(`${prefix}/explore`)}
              >
                학원 둘러보기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookmarks.map((bookmark) => (
              <Card 
                key={bookmark.id} 
                className="shadow-card border-border cursor-pointer hover:shadow-soft transition-all"
                onClick={() => navigate(`${prefix}/academy/${bookmark.academy_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      {bookmark.academy?.profile_image ? (
                        <img 
                          src={bookmark.academy.profile_image} 
                          alt={bookmark.academy.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground text-sm truncate">
                        {bookmark.academy?.name || "학원"}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {bookmark.academy?.subject}
                      </p>
                      {bookmark.academy?.tags && bookmark.academy.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {bookmark.academy.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBookmark(bookmark.id);
                      }}
                      className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                      <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
};

export default MyBookmarksPage;
