import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import Logo from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  Shield, 
  Loader2,
  Search,
  Building2,
  MapPin,
  Target,
  Lock,
  Unlock,
  Eye,
  Pencil,
  Save,
  X,
  Trash2,
  Plus
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ALL_REGIONS } from "@/contexts/RegionContext";

interface Academy {
  id: string;
  name: string;
  subject: string;
  profile_image: string | null;
  target_regions: string[] | null;
  target_tags: string[] | null;
  tags: string[] | null;
  is_profile_locked: boolean | null;
  locked_by: string | null;
  locked_at: string | null;
  address: string | null;
  description: string | null;
}

const SuperAdminAcademiesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [academiesLoading, setAcademiesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
  const [editingAcademy, setEditingAcademy] = useState<Academy | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Edit form state
  const [editTargetRegions, setEditTargetRegions] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string>("");
  const [editTargetTags, setEditTargetTags] = useState<string>("");
  const [editName, setEditName] = useState<string>("");
  const [editSubject, setEditSubject] = useState<string>("");
  const [editAddress, setEditAddress] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deletingAcademy, setDeletingAcademy] = useState<Academy | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!loading && isSuperAdmin) {
      fetchAcademies();
    }
  }, [loading, isSuperAdmin]);

  const fetchAcademies = async () => {
    try {
      const { data, error } = await supabase
        .from("academies")
        .select("id, name, subject, profile_image, target_regions, target_tags, tags, is_profile_locked, locked_by, locked_at, address, description")
        .order("name");

      if (error) throw error;
      setAcademies((data as Academy[]) || []);
    } catch (error) {
      console.error("Error fetching academies:", error);
    } finally {
      setAcademiesLoading(false);
    }
  };

  const handleToggleLock = async (academy: Academy) => {
    const newLockState = !academy.is_profile_locked;

    try {
      const { error } = await supabase
        .from("academies")
        .update({
          is_profile_locked: newLockState,
          locked_by: newLockState ? userId : null,
          locked_at: newLockState ? new Date().toISOString() : null,
        })
        .eq("id", academy.id);

      if (error) throw error;

      setAcademies(prev => prev.map(a => 
        a.id === academy.id 
          ? { ...a, is_profile_locked: newLockState, locked_by: newLockState ? userId : null, locked_at: newLockState ? new Date().toISOString() : null }
          : a
      ));

      toast({ 
        title: newLockState ? "프로필 잠금" : "프로필 잠금 해제", 
        description: newLockState 
          ? "이제 학원이 타겟 설정을 변경할 수 없습니다." 
          : "학원이 타겟 설정을 변경할 수 있습니다."
      });
    } catch (error) {
      console.error("Error toggling lock:", error);
      toast({ title: "오류", description: "변경에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleStartEdit = (academy: Academy) => {
    setEditingAcademy(academy);
    setEditTargetRegions(academy.target_regions || []);
    setEditTags((academy.tags || []).join(", "));
    setEditTargetTags((academy.target_tags || []).join(", "));
    setEditName(academy.name);
    setEditSubject(academy.subject);
    setEditAddress(academy.address || "");
    setEditDescription(academy.description || "");
    setSelectedAcademy(null);
  };

  const handleSaveEdit = async () => {
    if (!editingAcademy) return;
    
    if (!editName.trim() || !editSubject.trim()) {
      toast({ title: "오류", description: "학원명과 과목은 필수입니다.", variant: "destructive" });
      return;
    }
    
    setSaving(true);
    try {
      const tagsArray = editTags.split(",").map(t => t.trim()).filter(t => t.length > 0);
      const targetTagsArray = editTargetTags.split(",").map(t => t.trim()).filter(t => t.length > 0);
      
      const { error } = await supabase
        .from("academies")
        .update({
          name: editName.trim(),
          subject: editSubject.trim(),
          address: editAddress.trim() || null,
          description: editDescription.trim() || null,
          target_regions: editTargetRegions,
          tags: tagsArray,
          target_tags: targetTagsArray,
        })
        .eq("id", editingAcademy.id);

      if (error) throw error;

      setAcademies(prev => prev.map(a => 
        a.id === editingAcademy.id 
          ? { 
              ...a, 
              name: editName.trim(),
              subject: editSubject.trim(),
              address: editAddress.trim() || null,
              description: editDescription.trim() || null,
              target_regions: editTargetRegions, 
              tags: tagsArray, 
              target_tags: targetTagsArray 
            }
          : a
      ));

      toast({ title: "저장 완료", description: "학원 정보가 수정되었습니다." });
      setEditingAcademy(null);
    } catch (error) {
      console.error("Error saving academy:", error);
      toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAcademy = async () => {
    if (!deletingAcademy) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("academies")
        .delete()
        .eq("id", deletingAcademy.id);

      if (error) throw error;

      setAcademies(prev => prev.filter(a => a.id !== deletingAcademy.id));
      toast({ title: "삭제 완료", description: `${deletingAcademy.name} 학원이 삭제되었습니다.` });
      setDeletingAcademy(null);
    } catch (error) {
      console.error("Error deleting academy:", error);
      toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };


  const handleRegionToggle = (regionId: string) => {
    setEditTargetRegions(prev => 
      prev.includes(regionId) 
        ? prev.filter(r => r !== regionId)
        : [...prev, regionId]
    );
  };

  const getRegionName = (regionId: string) => {
    return ALL_REGIONS.find(r => r.id === regionId)?.name || regionId;
  };

  const filteredAcademies = academies.filter(academy => 
    academy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    academy.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-app-shell flex flex-col items-center justify-center p-4">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">접근 권한이 없습니다</h1>
        <p className="text-muted-foreground text-center mb-6">
          이 페이지는 슈퍼관리자만 접근할 수 있습니다.
        </p>
        <Button onClick={() => navigate('/admin/home')}>
          관리자 홈으로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/super')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Logo size="sm" showText={false} />
          <span className="font-semibold text-foreground">등록 학원 관리</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Info Card */}
        <Card className="shadow-card bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium text-foreground text-sm mb-1">학원 프로필 관리</h3>
                <p className="text-xs text-muted-foreground">
                  슈퍼관리자는 학원을 추가/수정/삭제하고 강사, 강좌 정보를 직접 관리할 수 있습니다.
                  잠금을 활성화하면 학원이 타겟 설정을 변경할 수 없습니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="학원명 또는 과목 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats + Create Button */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Badge variant="secondary" className="gap-1">
              <Building2 className="w-3 h-3" />
              전체 {academies.length}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Lock className="w-3 h-3" />
              잠금 {academies.filter(a => a.is_profile_locked).length}
            </Badge>
          </div>
          <Button size="sm" onClick={() => navigate('/admin/super/academies/create')} className="gap-1">
            <Plus className="w-4 h-4" />
            학원 추가
          </Button>
        </div>

        {/* Academies List */}
        {academiesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="shadow-card">
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAcademies.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">학원이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAcademies.map((academy) => (
              <Card key={academy.id} className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden shrink-0">
                        {academy.profile_image ? (
                          <img
                            src={academy.profile_image}
                            alt={academy.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-primary font-bold text-sm">
                            {academy.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground text-sm truncate">
                            {academy.name}
                          </h3>
                          {academy.is_profile_locked && (
                            <Lock className="w-3.5 h-3.5 text-warning shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{academy.subject}</p>
                        <div className="flex flex-wrap gap-1">
                          {academy.target_regions?.slice(0, 2).map(region => (
                            <Badge key={region} variant="outline" className="text-[10px] px-1.5 py-0">
                              <MapPin className="w-2.5 h-2.5 mr-0.5" />
                              {getRegionName(region)}
                            </Badge>
                          ))}
                          {(academy.target_regions?.length || 0) > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              +{(academy.target_regions?.length || 0) - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedAcademy(academy)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigate(`/admin/super/academies/${academy.id}/edit`)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletingAcademy(academy)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Switch
                        checked={academy.is_profile_locked || false}
                        onCheckedChange={() => handleToggleLock(academy)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Academy Detail Dialog */}
      <Dialog open={!!selectedAcademy} onOpenChange={() => setSelectedAcademy(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAcademy?.name}
              {selectedAcademy?.is_profile_locked && <Lock className="w-4 h-4 text-warning" />}
            </DialogTitle>
            <DialogDescription>{selectedAcademy?.subject}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                타겟 지역
              </h4>
              <div className="flex flex-wrap gap-1">
                {selectedAcademy?.target_regions?.length ? (
                  selectedAcademy.target_regions.map(region => (
                    <Badge key={region} variant="secondary" className="text-xs">
                      {getRegionName(region)}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">설정된 지역이 없습니다</p>
                )}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <Target className="w-4 h-4" />
                학원 태그
              </h4>
              <div className="flex flex-wrap gap-1">
                {selectedAcademy?.tags?.length ? (
                  selectedAcademy.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">설정된 태그가 없습니다</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedAcademy(null)}>
              닫기
            </Button>
            <Button onClick={() => selectedAcademy && handleStartEdit(selectedAcademy)}>
              <Pencil className="w-4 h-4 mr-2" />
              수정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Academy Dialog */}
      <Dialog open={!!editingAcademy} onOpenChange={() => setEditingAcademy(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="w-4 h-4 shrink-0" />
              {editingAcademy?.name} 수정
            </DialogTitle>
            <DialogDescription>학원 정보를 수정합니다.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 py-4">
            {/* Basic Info */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="editName" className="text-sm font-medium">학원명 *</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="학원명 입력"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editSubject" className="text-sm font-medium">과목 *</Label>
                <Input
                  id="editSubject"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="수학, 영어, 국어 등"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editAddress" className="text-sm font-medium">주소</Label>
                <Input
                  id="editAddress"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="주소 입력"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="editDescription" className="text-sm font-medium">설명</Label>
                <Input
                  id="editDescription"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="학원 설명"
                  className="mt-1"
                />
              </div>
            </div>
            {/* Target Regions */}
            <div>
              <Label className="text-sm font-medium mb-3 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                타겟 지역 (Multi-select)
              </Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-secondary/30">
                {ALL_REGIONS.map(region => (
                  <div key={region.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`region-${region.id}`}
                      checked={editTargetRegions.includes(region.id)}
                      onCheckedChange={() => handleRegionToggle(region.id)}
                    />
                    <label 
                      htmlFor={`region-${region.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {region.name}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                선택된 지역: {editTargetRegions.length}개
              </p>
            </div>
            
            {/* Tags */}
            <div>
              <Label htmlFor="tags" className="text-sm font-medium mb-2 flex items-center gap-1">
                <Target className="w-4 h-4" />
                학원 태그 (쉼표로 구분)
              </Label>
              <Input
                id="tags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="입시전문, 소수정예, 1:1 맞춤"
              />
              <p className="text-xs text-muted-foreground mt-1">
                예: 입시전문, 소수정예, 내신대비
              </p>
            </div>

            {/* Target Tags */}
            <div>
              <Label htmlFor="targetTags" className="text-sm font-medium mb-2 flex items-center gap-1">
                <Target className="w-4 h-4 text-orange-500" />
                타겟 태그 (추천 알고리즘용)
              </Label>
              <Input
                id="targetTags"
                value={editTargetTags}
                onChange={(e) => setEditTargetTags(e.target.value)}
                placeholder="집중력부족, 수학약점, 내신대비"
              />
              <p className="text-xs text-muted-foreground mt-1">
                학부모 테스트 결과와 매칭되는 태그 (예: 집중력부족, 수학약점)
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingAcademy(null)} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              취소
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingAcademy} onOpenChange={() => setDeletingAcademy(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>학원 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingAcademy?.name}</strong> 학원을 정말 삭제하시겠습니까?
              <br />
              <span className="text-destructive">이 작업은 되돌릴 수 없으며, 관련된 모든 데이터(강좌, 게시물 등)가 함께 삭제됩니다.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAcademy}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperAdminAcademiesPage;
