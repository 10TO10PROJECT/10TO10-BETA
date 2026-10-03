import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  MessageCircle, 
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send
} from "lucide-react";
import { toast } from "sonner";
import SuperAdminBottomNavigation from "@/components/SuperAdminBottomNavigation";

interface Inquiry {
  id: string;
  user_id: string;
  subject: string;
  content: string;
  status: 'pending' | 'answered' | 'closed';
  created_at: string;
  response?: string;
  user_email?: string;
}

const SuperAdminCustomerServicePage = () => {
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [response, setResponse] = useState("");
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    try {
      // 실제 구현 시 customer_inquiries 테이블에서 조회
      // 현재는 임시 데이터 사용
      setInquiries([
        {
          id: "1",
          user_id: "user1",
          subject: "학원 검색 관련 문의",
          content: "특정 지역의 학원이 검색되지 않습니다.",
          status: "pending",
          created_at: new Date().toISOString(),
          user_email: "user1@example.com"
        },
        {
          id: "2",
          user_id: "user2",
          subject: "설명회 신청 오류",
          content: "설명회 신청 버튼이 작동하지 않습니다.",
          status: "answered",
          created_at: new Date(Date.now() - 86400000).toISOString(),
          response: "확인 후 수정하였습니다. 다시 시도해주세요.",
          user_email: "user2@example.com"
        }
      ]);
    } catch (error) {
      console.error('Error fetching inquiries:', error);
      toast.error('문의 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!selectedInquiry || !response.trim()) {
      toast.error('답변 내용을 입력해주세요');
      return;
    }

    setResponding(true);
    try {
      // 실제 구현 시 customer_inquiries 테이블 업데이트
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setInquiries(prev => prev.map(inq => 
        inq.id === selectedInquiry.id 
          ? { ...inq, status: 'answered' as const, response } 
          : inq
      ));
      
      toast.success('답변이 전송되었습니다');
      setSelectedInquiry(null);
      setResponse("");
    } catch (error) {
      console.error('Error responding to inquiry:', error);
      toast.error('답변 전송에 실패했습니다');
    } finally {
      setResponding(false);
    }
  };

  const filteredInquiries = inquiries.filter(inq =>
    inq.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inq.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-600"><Clock className="w-3 h-3 mr-1" />대기중</Badge>;
      case 'answered':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="w-3 h-3 mr-1" />답변완료</Badge>;
      case 'closed':
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />종료</Badge>;
      default:
        return null;
    }
  };

  const pendingCount = inquiries.filter(i => i.status === 'pending').length;

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground">고객센터 관리</h1>
          {pendingCount > 0 && (
            <Badge className="ml-auto">{pendingCount}건 대기중</Badge>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="문의 검색..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-card">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{inquiries.length}</p>
              <p className="text-xs text-muted-foreground">전체</p>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">대기중</p>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {inquiries.filter(i => i.status === 'answered').length}
              </p>
              <p className="text-xs text-muted-foreground">답변완료</p>
            </CardContent>
          </Card>
        </div>

        {/* Inquiries List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredInquiries.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">문의 내역이 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredInquiries.map((inquiry) => (
              <Card 
                key={inquiry.id} 
                className="shadow-card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedInquiry(inquiry)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-foreground line-clamp-1">{inquiry.subject}</h3>
                    {getStatusBadge(inquiry.status)}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {inquiry.content}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{inquiry.user_email}</span>
                    <span>{new Date(inquiry.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Inquiry Detail Dialog */}
      <Dialog open={!!selectedInquiry} onOpenChange={() => setSelectedInquiry(null)}>
        <DialogContent className="max-w-lg mx-4">
          <DialogHeader>
            <DialogTitle>{selectedInquiry?.subject}</DialogTitle>
          </DialogHeader>
          
          {selectedInquiry && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{selectedInquiry.user_email}</span>
                {getStatusBadge(selectedInquiry.status)}
              </div>
              
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-sm">{selectedInquiry.content}</p>
              </div>
              
              {selectedInquiry.response && (
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-xs text-primary font-medium mb-1">답변</p>
                  <p className="text-sm">{selectedInquiry.response}</p>
                </div>
              )}
              
              {selectedInquiry.status === 'pending' && (
                <div className="space-y-3">
                  <Textarea
                    placeholder="답변을 입력하세요..."
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={4}
                  />
                  <Button 
                    className="w-full gap-2" 
                    onClick={handleRespond}
                    disabled={responding}
                  >
                    {responding ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    답변 보내기
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SuperAdminBottomNavigation />
    </div>
  );
};

export default SuperAdminCustomerServicePage;
