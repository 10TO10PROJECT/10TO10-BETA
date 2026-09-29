import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/errorLogger";
import type { AuthRole } from "@/lib/sendIdTokenToBackend";

interface EmailSignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultRole?: AuthRole;
}

const EmailSignupDialog = ({ open, onOpenChange, onSuccess, defaultRole = "parent" }: EmailSignupDialogProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<AuthRole>(defaultRole);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setSelectedRole(defaultRole);
  }, [open, defaultRole]);

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      toast.error("모든 항목을 입력해주세요");
      return;
    }
    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("비밀번호가 일치하지 않습니다");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: { role: selectedRole },
        },
      });
      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        if (error.status === 429 || msg.includes("rate limit")) {
          toast.error("가입 요청이 많아 잠시 처리할 수 없습니다. 잠시 후 다시 시도해주세요.");
        } else if (msg.includes("invalid email") || msg.includes("unable to validate email")) {
          toast.error("유효하지 않은 이메일 형식입니다");
        } else if (msg.includes("already registered") || msg.includes("already in use") || msg.includes("user already exists")) {
          toast.error("이미 가입된 이메일입니다");
        } else if (msg.includes("password")) {
          toast.error("비밀번호는 6자 이상이어야 합니다");
        } else if (msg.includes("email address") && msg.includes("not authorized")) {
          toast.error("가입이 허용되지 않은 이메일입니다");
        } else {
          toast.error(error.message || "회원가입에 실패했습니다");
        }
        return;
      }
      if (data?.user?.id) {
        // 트리거가 role을 넣지만, student 등 선택 역할이 확실히 반영되도록 upsert
        const { error: roleError } = await supabase.from("user_roles").upsert(
          { user_id: data.user.id, role: selectedRole },
          { onConflict: "user_id" }
        );
        if (roleError) {
          logError("email-signup-dialog-role", roleError);
        }
        toast.success(
          data.session
            ? "회원가입이 완료되었습니다. 로그인해주세요."
            : "인증 메일을 보냈습니다. 메일의 링크로 인증한 뒤 로그인해주세요."
        );
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        onOpenChange(false);
        onSuccess();
      }
    } catch (error) {
      logError("email-signup-dialog", error);
      toast.error("회원가입에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">회원가입</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={selectedRole === "parent" ? "default" : "outline"}
              className="h-12 text-sm px-2"
              onClick={() => setSelectedRole("parent")}
            >
              학부모
            </Button>
            <Button
              variant={selectedRole === "student" ? "default" : "outline"}
              className="h-12 text-sm px-2"
              onClick={() => setSelectedRole("student")}
            >
              학생
            </Button>
            <Button
              variant={selectedRole === "admin" ? "default" : "outline"}
              className="h-12 text-sm px-2"
              onClick={() => setSelectedRole("admin")}
            >
              학원 관리자
            </Button>
          </div>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-12 h-14 text-lg"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-12 h-14 text-lg"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="password"
              placeholder="비밀번호 재입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-12 h-14 text-lg"
            />
          </div>
          <Button
            onClick={handleSignup}
            disabled={loading}
            className="w-full h-14 text-base"
          >
            {loading ? "처리 중..." : "회원가입"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailSignupDialog;
