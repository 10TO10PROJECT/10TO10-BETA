import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import { ArrowLeft, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BottomNavigation from "@/components/BottomNavigation";
import StudentBottomNavigation from "@/components/StudentBottomNavigation";

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  priority: number | null;
}

const AnnouncementsPage = () => {
  const navigate = useNavigate();
  const prefix = useRoutePrefix();
  const isStudent = prefix === "/s";
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data, error } = await supabase
          .from("announcements")
          .select("id, title, content, created_at, priority")
          .eq("is_active", true)
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        setAnnouncements(data || []);
      } catch (error) {
        console.error("Error fetching announcements:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">공지사항</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Megaphone className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              공지사항이 없습니다
            </h3>
            <p className="text-sm text-muted-foreground">
              새로운 공지사항이 등록되면 알려드릴게요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <Card
                key={announcement.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedAnnouncement(announcement)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="truncate">{announcement.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(announcement.created_at)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Announcement Detail Dialog */}
      <Dialog
        open={!!selectedAnnouncement}
        onOpenChange={() => setSelectedAnnouncement(null)}
      >
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-left">
              <Megaphone className="w-5 h-5 text-primary flex-shrink-0" />
              <span>{selectedAnnouncement?.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <p className="text-xs text-muted-foreground">
              {selectedAnnouncement && formatDate(selectedAnnouncement.created_at)}
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {selectedAnnouncement?.content}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {isStudent ? <StudentBottomNavigation /> : <BottomNavigation />}
    </div>
  );
};

export default AnnouncementsPage;
