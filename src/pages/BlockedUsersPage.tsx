import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import BottomNavigation from "@/components/BottomNavigation";
import StudentBottomNavigation from "@/components/StudentBottomNavigation";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";

type BlockedItem = {
  id: string;
  blocked_user_id: string;
  created_at: string;
  user_name: string;
  image_url: string | null;
};

const BlockedUsersPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedItem[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const routePrefix = useMemo(() => {
    if (location.pathname.startsWith("/admin")) return "/admin";
    if (location.pathname.startsWith("/s")) return "/s";
    return "/p";
  }, [location.pathname]);

  const formatBlockedDate = (isoDate: string) => {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  useEffect(() => {
    const loadBlockedUsers = async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const currentUserId = session?.user?.id ?? null;
        setUserId(currentUserId);
        if (!currentUserId) {
          setBlockedUsers([]);
          return;
        }

        const { data: blocks, error: blocksError } = await supabase
          .from("user_blocks")
          .select("id, blocked_user_id, created_at")
          .eq("blocker_id", currentUserId)
          .order("created_at", { ascending: false });

        if (blocksError) throw blocksError;

        const blockedIds = [...new Set((blocks || []).map((b) => b.blocked_user_id))];
        let profileMap: Record<string, { user_name: string | null; image_url: string | null }> = {};

        if (blockedIds.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, user_name, image_url")
            .in("id", blockedIds);

          if (profileError) throw profileError;

          profileMap = (profiles || []).reduce<Record<string, { user_name: string | null; image_url: string | null }>>(
            (acc, profile) => {
              acc[profile.id] = {
                user_name: profile.user_name,
                image_url: profile.image_url,
              };
              return acc;
            },
            {}
          );
        }

        const mapped: BlockedItem[] = (blocks || []).map((block) => ({
          id: block.id,
          blocked_user_id: block.blocked_user_id,
          created_at: block.created_at,
          user_name: profileMap[block.blocked_user_id]?.user_name?.trim() || "익명의 사용자",
          image_url: profileMap[block.blocked_user_id]?.image_url || null,
        }));

        setBlockedUsers(mapped);
      } catch (error) {
        console.error("Error loading blocked users:", error);
        toast.error("차단 목록을 불러오지 못했습니다");
      } finally {
        setLoading(false);
      }
    };

    loadBlockedUsers();
  }, []);

  const handleUnblock = async (blockedUserId: string) => {
    if (!userId) return;

    setUnblockingId(blockedUserId);
    try {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", userId)
        .eq("blocked_user_id", blockedUserId);

      if (error) throw error;

      setBlockedUsers((prev) => prev.filter((item) => item.blocked_user_id !== blockedUserId));
      toast.success("차단을 해제했습니다");
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast.error("차단 해제에 실패했습니다");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      <header className="sticky top-0 bg-card/90 backdrop-blur border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`${routePrefix}/my`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground">차단 목록 관리</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        <p className="text-sm text-muted-foreground mb-3">차단한 사용자의 글과 댓글이 숨겨집니다</p>

        <Card className="shadow-card border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">차단 목록을 불러오는 중...</div>
            ) : blockedUsers.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">차단한 사용자가 없습니다.</div>
            ) : (
              <div>
                {blockedUsers.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.user_name}
                          className="w-12 h-12 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                          {item.user_name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{item.user_name}</p>
                        <p className="text-sm text-muted-foreground">{formatBlockedDate(item.created_at)} 차단</p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="rounded-full min-w-20"
                      disabled={unblockingId === item.blocked_user_id}
                      onClick={() => handleUnblock(item.blocked_user_id)}
                    >
                      {unblockingId === item.blocked_user_id ? "해제 중..." : "해제"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {routePrefix === "/p" && <BottomNavigation />}
      {routePrefix === "/s" && <StudentBottomNavigation />}
      {routePrefix === "/admin" && <AdminBottomNavigation />}
    </div>
  );
};

export default BlockedUsersPage;