import { useState, useEffect } from "react";
import { ArrowLeft, PartyPopper, Calendar, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRegion } from "@/contexts/RegionContext";
import BottomNavigation from "@/components/BottomNavigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface FeedPost {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  type: string;
  academy: {
    id: string;
    name: string;
    profile_image: string | null;
  };
  seminar?: {
    id: string;
    date: string;
    location: string | null;
  } | null;
}

const EventsPage = () => {
  const navigate = useNavigate();
  const { selectedRegion } = useRegion();
  const [events, setEvents] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("feed_posts")
          .select(`
            id,
            title,
            body,
            image_url,
            created_at,
            type,
            target_regions,
            academy:academies!inner (
              id,
              name,
              profile_image
            ),
            seminar:seminars (
              id,
              date,
              location
            )
          `)
          .eq("type", "event")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Filter by target_regions
        const filtered = (data || []).filter((post: any) => {
          const regions = post.target_regions || [];
          return regions.includes(selectedRegion);
        });

        setEvents(filtered.map((p: any) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          image_url: p.image_url,
          created_at: p.created_at,
          type: p.type,
          academy: {
            id: p.academy.id,
            name: p.academy.name,
            profile_image: p.academy.profile_image,
          },
          seminar: p.seminar ? {
            id: p.seminar.id,
            date: p.seminar.date,
            location: p.seminar.location,
          } : null,
        })));
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [selectedRegion]);

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">이벤트</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto py-6 px-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-xl mb-3" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <PartyPopper className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">진행중인 이벤트가 없습니다</h2>
            <p className="text-muted-foreground text-sm">
              선택한 지역에서 진행중인<br />
              이벤트가 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/community?post=${event.id}`)}
                className="bg-card rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              >
                {event.image_url && (
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="w-full h-40 object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {event.academy.profile_image ? (
                      <img
                        src={event.academy.profile_image}
                        alt={event.academy.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {event.academy.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">{event.academy.name}</span>
                  </div>
                  <h3 className="font-semibold mb-1">{event.title}</h3>
                  {event.body && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{event.body}</p>
                  )}
                  {event.seminar && (
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{format(new Date(event.seminar.date), "M월 d일 (EEE)", { locale: ko })}</span>
                      </div>
                      {event.seminar.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{event.seminar.location}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
};

export default EventsPage;
