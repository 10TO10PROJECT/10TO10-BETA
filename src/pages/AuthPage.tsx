import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { firebaseAuth } from "@/integrations/firebase/client";
import { signInWithPhoneNumber, RecaptchaVerifier, type ConfirmationResult } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Logo from "@/components/Logo";
import { Lock, ArrowRight, Phone, Mail, ArrowLeft, User, GraduationCap, Building2 } from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/errorLogger";
import { sendIdTokenToBackend, type AuthRole } from "@/lib/sendIdTokenToBackend";
import { formatPhoneWithDash, getDigitsOnly } from "@/lib/formatPhone";
import { supabase } from "@/integrations/supabase/client";
import EmailSignupDialog from "@/components/EmailSignupDialog";
import TermsAgreementScreen from "@/components/TermsAgreementScreen";

type AuthStep = "login" | "signup_terms" | "signup_phone" | "signup_role" | "signup_nickname";
type AuthMode = "phone" | "email";

/** Firebase 전화 인증이 이 호스트에서 허용되는지. localhost/127.0.0.1은 Firebase에서 불가. */
function isPhoneAuthAllowedHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname.toLowerCase();
  return h !== "localhost" && h !== "127.0.0.1";
}

/** redirect 쿼리에서 안전한 경로만 반환 (오픈 리다이렉트 방지) */
function getSafeRedirect(searchParams: URLSearchParams): string | null {
  const redirect = searchParams.get("redirect");
  if (!redirect || typeof redirect !== "string") return null;
  const path = redirect.trim();
  if (path === "" || !path.startsWith("/") || path.includes("//")) return null;
  return path;
}

const AuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectAfterAuth = getSafeRedirect(searchParams);
  const roleParam = searchParams.get("role");
  const initialMode: AuthMode =
    searchParams.get("mode") === "email" ? "email" : "phone";
  const initialRole: AuthRole =
    roleParam === "student" || roleParam === "admin" ? roleParam : "parent";

  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [step, setStep] = useState<AuthStep>("login");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AuthRole>(initialRole);
  
  // Phone auth states
  const [loginPhone, setLoginPhone] = useState("");
  const [loginShowVerification, setLoginShowVerification] = useState(false);
  const [loginVerificationCode, setLoginVerificationCode] = useState("");
  const [verificationSecondsLeft, setVerificationSecondsLeft] = useState(0); // 5분 = 300초
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const [recaptchaKey, setRecaptchaKey] = useState(0);
  const pendingPhoneRef = useRef<string | null>(null);
  const [nickname, setNickname] = useState(""); // 신규 휴대폰 회원가입 플로우 닉네임

  // Email auth states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [pendingPasswordChangeUserId, setPendingPasswordChangeUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const resetVerificationState = () => {
    setLoginShowVerification(false);
    setLoginVerificationCode("");
    setVerificationSecondsLeft(0);
    confirmationResultRef.current = null;
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore
      }
      recaptchaVerifierRef.current = null;
    }
  };

  const resetEmailState = () => {
    setEmail("");
    setPassword("");
    setMustChangePassword(false);
    setPendingPasswordChangeUserId(null);
    setNewPassword("");
    setConfirmNewPassword("");
  };

  // Email login handler
  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("이메일과 비밀번호를 입력해주세요");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) {
        toast.error(error.message || "로그인에 실패했습니다");
        return;
      }
      if (data?.session?.user?.id) {
        const userId = data.session.user.id;
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("require_password_change")
          .eq("user_id", userId)
          .maybeSingle();

        if (roleData?.require_password_change) {
          setMustChangePassword(true);
          setPendingPasswordChangeUserId(userId);
          setPassword("");
          toast.info("임시 비밀번호로 로그인되었습니다. 새 비밀번호를 설정해주세요.");
          return;
        }

        await navigateByDatabaseRole(userId);
        toast.success("로그인되었습니다");
      }
    } catch (error) {
      logError("email-login", error);
      toast.error("로그인에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  // Email signup handler
  const handleEmailSignup = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("이메일과 비밀번호를 입력해주세요");
      return;
    }
    if (password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { role: selectedRole },
        },
      });
      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        if (msg.includes("invalid email") || msg.includes("unable to validate email")) {
          toast.error("유효하지 않은 이메일 형식입니다");
        } else if (msg.includes("already registered") || msg.includes("already in use") || msg.includes("user already exists")) {
          toast.error("이미 가입된 이메일입니다");
        } else if (msg.includes("password")) {
          toast.error("비밀번호는 6자 이상이어야 합니다");
        } else {
          toast.error(error.message || "회원가입에 실패했습니다");
        }
        return;
      }
      if (data?.user?.id) {
        // 트리거가 role을 넣지만, 선택한 역할이 확실히 반영되도록 upsert
        const { error: roleError } = await supabase.from("user_roles").upsert(
          { user_id: data.user.id, role: selectedRole },
          { onConflict: "user_id" }
        );
        if (roleError) {
          logError("email-signup-role", roleError);
        }
        toast.success("회원가입이 완료되었습니다. 이메일을 확인해주세요.");
        setStep("login");
        resetEmailState();
      }
    } catch (error) {
      logError("email-signup", error);
      toast.error("회원가입에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteForcedPasswordChange = async () => {
    if (!pendingPasswordChangeUserId) {
      toast.error("사용자 정보를 확인할 수 없습니다. 다시 로그인해주세요.");
      return;
    }
    if (!newPassword.trim()) {
      toast.error("새 비밀번호를 입력해주세요");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("새 비밀번호는 6자 이상이어야 합니다");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("새 비밀번호 확인이 일치하지 않습니다");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        toast.error(updateError.message || "비밀번호 변경에 실패했습니다");
        return;
      }

      const { error: clearFlagError } = await supabase.functions.invoke("clear-password-change-required");
      if (clearFlagError) {
        toast.error("비밀번호는 변경되었지만 변경 상태 해제에 실패했습니다. 관리자에게 문의해주세요.");
        return;
      }

      setMustChangePassword(false);
      setPendingPasswordChangeUserId(null);
      setNewPassword("");
      setConfirmNewPassword("");
      await navigateByDatabaseRole(pendingPasswordChangeUserId);
      toast.success("비밀번호가 변경되었습니다.");
    } catch (error) {
      logError("email-force-password-change", error);
      toast.error("비밀번호 변경에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 로그인 후 이동: redirect 쿼리가 있으면 해당 경로, 없으면 역할별 메인. roleOverride(이메일 로그인 시 선택 역할)가 있으면 그 역할 홈으로 이동.
  const navigateByDatabaseRole = async (userId: string) => {
    // 1순위: redirect 쿼리로 돌아가기 (예: 세미나 상세 등)
    if (redirectAfterAuth) {
      navigate(redirectAfterAuth, { replace: true });
      return;
    }

    // 2순위: DB에 저장된 역할 기반 기본 홈으로 이동
    const fallback = "/p/home";
    try {
      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role, is_super_admin')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        logError('role-fetch', error);
        navigate(fallback);
        return;
      }
      
      // 역할이 없으면 기본 학부모 홈
      if (!roleData) {
        navigate(fallback);
        return;
      }
      
      if (roleData.is_super_admin) {
        navigate("/super/home");
      } else if (roleData.role === "admin") {
        navigate("/admin/home");
      } else if (roleData.role === "student") {
        navigate("/s/home");
      } else {
        navigate("/p/home");
      }
    } catch (error) {
      logError('navigate-by-role', error);
      navigate(fallback);
    }
  };


  const handleLoginRequestCode = () => {
    if (!loginPhone.trim()) {
      toast.error("휴대폰 번호를 입력해주세요");
      return;
    }
    if (!isPhoneAuthAllowedHost()) {
      toast.error("휴대폰 인증은 배포된 주소에서만 가능합니다. localhost에서는 이메일 로그인을 이용해 주세요.");
      return;
    }
    setLoading(true);
    pendingPhoneRef.current = loginPhone.trim();
    setRecaptchaKey((k) => k + 1);
  };

  useEffect(() => {
    if (recaptchaKey === 0) return;
    const phone = pendingPhoneRef.current;
    const container = recaptchaContainerRef.current;
    if (!phone || !container) {
      setLoading(false);
      return;
    }
    pendingPhoneRef.current = null;
    const digits = getDigitsOnly(phone);
    const phoneNum = digits.startsWith("82") ? `+${digits}` : `+82${digits.replace(/^0/, "")}`;
    // key={recaptchaKey}로 매 요청마다 새 div가 마운트되므로, 항상 컨테이너에만 그리면 "already rendered" 방지
    let cancelled = false;
    (async () => {
      try {
        const verifier = new RecaptchaVerifier(firebaseAuth, container, {
          size: "invisible",
        });
        recaptchaVerifierRef.current = verifier;
        if (cancelled) return;
        const result = await signInWithPhoneNumber(firebaseAuth, phoneNum, verifier);
        if (cancelled) return;
        confirmationResultRef.current = result;
        setLoginShowVerification(true);
        setVerificationSecondsLeft(300); // 5분
        toast.success("인증번호가 발송되었습니다. SMS를 확인해주세요.");
      } catch (error: unknown) {
        if (cancelled) return;
        logError("firebase-phone-request", error);
        const code = error && typeof error === "object" && "code" in error ? String((error as { code: string }).code) : "";
        const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "인증번호 발송에 실패했습니다";
        if (code === "auth/invalid-app-credential") {
          toast.error("앱 인증에 실패했습니다. 잠시 후 다시 시도해주세요.");
        } else if (code === "auth/captcha-check-failed") {
          toast.error("이 주소는 휴대폰 인증에 등록되어 있지 않습니다. Firebase 콘솔 → Authentication → 허용된 도메인에 현재 주소를 추가해 주세요.");
        } else if (code === "auth/too-many-requests") {
          toast.error("요청이 너무 많습니다. 잠시 후(몇 분~몇 시간) 다시 시도해 주세요.");
        } else {
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recaptchaKey]);

  // 5분 입력 제한 타이머
  useEffect(() => {
    if (!loginShowVerification || verificationSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setVerificationSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [loginShowVerification, verificationSecondsLeft]);

  const handleResendCode = () => {
    if (loading) return;
    if (!loginPhone.trim()) {
      toast.error("휴대폰 번호를 확인해주세요");
      return;
    }
    setLoading(true);
    pendingPhoneRef.current = loginPhone.trim();
    setRecaptchaKey((k) => k + 1);
  };

  const formatTimeLeft = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const handleLoginConfirm = async () => {
    const confirmation = confirmationResultRef.current;
    if (!confirmation || !loginVerificationCode.trim()) {
      toast.error("인증번호를 입력해주세요");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await confirmation.confirm(loginVerificationCode.trim());
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      const { ok, error: backendError, token_hash } = await sendIdTokenToBackend(
        idToken,
        selectedRole,
        false
      );
      if (!ok) {
        toast.error(backendError ?? "서버 인증 처리에 실패했습니다");
        if (backendError?.includes("가입된")) {
          toast.info("회원가입을 진행해 주세요.");
          setStep("signup_terms");
          resetVerificationState();
        }
        return;
      }
      if (token_hash) {
        const { data, error: otpError } = await supabase.auth.verifyOtp({
          token_hash,
          type: "magiclink",
        });
        if (otpError) {
          logError("supabase-verify-otp", otpError);
          toast.error("세션 설정에 실패했습니다. 다시 로그인해주세요.");
          return;
        }
        if (data?.session?.user?.id) {
          await navigateByDatabaseRole(data.session.user.id);
        } else {
          navigate(redirectAfterAuth ?? "/p/home", { replace: Boolean(redirectAfterAuth) });
        }
      } else {
        navigate(redirectAfterAuth ?? "/p/home", { replace: Boolean(redirectAfterAuth) });
      }
      toast.success("로그인되었습니다");
    } catch (error: unknown) {
      logError("firebase-phone-confirm", error);
      const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "인증에 실패했습니다";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /** 회원가입 플로우: 휴대폰 인증 완료 후 기존/신규 분기 */
  const handleSignupFlowConfirm = async () => {
    const confirmation = confirmationResultRef.current;
    if (!confirmation || !loginVerificationCode.trim()) {
      toast.error("인증번호를 입력해주세요");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await confirmation.confirm(loginVerificationCode.trim());
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      const { ok, error: backendError, token_hash } = await sendIdTokenToBackend(idToken, selectedRole, false);
      if (ok && token_hash) {
        const { data, error: otpError } = await supabase.auth.verifyOtp({
          token_hash,
          type: "magiclink",
        });
        if (otpError) {
          logError("supabase-verify-otp", otpError);
          toast.error("세션 설정에 실패했습니다. 로그인해주세요.");
          return;
        }
        if (data?.session?.user?.id) {
          await navigateByDatabaseRole(data.session.user.id);
        } else {
          navigate(redirectAfterAuth ?? "/p/home", { replace: Boolean(redirectAfterAuth) });
        }
        toast.success("로그인되었습니다");
        return;
      }
      if (!ok && backendError?.includes("가입된")) {
        setStep("signup_role");
        resetVerificationState();
        toast.success("인증이 완료되었습니다. 역할을 선택해 주세요.");
        return;
      }
      toast.error(backendError ?? "서버 인증 처리에 실패했습니다");
    } catch (error: unknown) {
      logError("firebase-signup-flow-confirm", error);
      const msg = error && typeof error === "object" && "message" in error ? String((error as { message: string }).message) : "인증에 실패했습니다";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /** 신규 회원: 닉네임 입력 후 회원가입 완료 */
  const handleSignupComplete = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      toast.error("닉네임을 입력해주세요");
      return;
    }
    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.error("인증 세션이 만료되었습니다. 휴대폰 인증부터 다시 진행해 주세요.");
      setStep("signup_terms");
      return;
    }
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const { ok, error: backendError, token_hash } = await sendIdTokenToBackend(idToken, selectedRole, true, trimmed);
      if (!ok) {
        toast.error(backendError ?? "회원가입에 실패했습니다");
        return;
      }
      if (token_hash) {
        const { data, error: otpError } = await supabase.auth.verifyOtp({
          token_hash,
          type: "magiclink",
        });
        if (otpError) {
          logError("supabase-verify-otp", otpError);
          toast.error("세션 설정에 실패했습니다. 로그인해주세요.");
          return;
        }
        if (data?.session?.user?.id) {
          await navigateByDatabaseRole(data.session.user.id);
        } else {
          navigate(redirectAfterAuth ?? "/p/home", { replace: Boolean(redirectAfterAuth) });
        }
      } else {
        navigate(redirectAfterAuth ?? "/p/home", { replace: Boolean(redirectAfterAuth) });
      }
      toast.success("회원가입이 완료되었습니다");
    } catch (error: unknown) {
      logError("firebase-signup-complete", error);
      toast.error("회원가입에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* 역할 선택으로 (학원 관리자 로그인은 이메일만 사용) */}
        {authMode === "email" && (
          <button
            type="button"
            onClick={() => {
              resetEmailState();
              if (roleParam === "admin") {
                navigate("/");
                return;
              }
              setAuthMode("phone");
              navigate("/auth");
            }}
            className="absolute top-4 left-4 p-2 text-muted-foreground hover:text-foreground"
            aria-label="역할 선택으로 돌아가기"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}

        {authMode === "phone" && step === "login" && (
          <button
            type="button"
            onClick={() => navigate("/")}
            className="absolute top-4 left-4 p-2 text-muted-foreground hover:text-foreground"
            aria-label="역할 선택으로 돌아가기"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}

        {/* Logo */}
        <div className="mb-8 animate-float">
          <Logo size="lg" />
        </div>

        {/* 약관 동의 (회원가입 플로우 1단계) */}
        {step === "signup_terms" && (
          <div className="w-full flex flex-col items-center animate-fade-up">
            <button
              onClick={() => setStep("login")}
              className="self-start p-2 text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <TermsAgreementScreen
              onNext={() => {
                setStep("signup_phone");
                resetVerificationState();
              }}
            />
          </div>
        )}

        {/* 역할 선택 (신규 회원 2단계) */}
        {(step === "signup_role" || step === "signup_nickname") && (
          <button
            onClick={() => (step === "signup_role" ? setStep("signup_phone") : setStep("signup_role"))}
            className="absolute top-4 left-4 p-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}

        {step === "signup_role" && (
          <div className="w-full max-w-sm space-y-6 animate-fade-up">
            <h2 className="text-xl font-semibold text-foreground text-center">역할 선택</h2>
            <p className="text-muted-foreground text-sm text-center">가입 유형을 선택해 주세요</p>
            <div className="grid grid-cols-1 gap-4">
              <Button
                variant={selectedRole === "parent" ? "default" : "outline"}
                className="h-auto py-5 flex items-center gap-4"
                onClick={() => setSelectedRole("parent")}
              >
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold">학부모</div>
                  <div className="text-xs text-muted-foreground">우리 아이 학원 찾기</div>
                </div>
              </Button>
              <Button
                variant={selectedRole === "student" ? "default" : "outline"}
                className="h-auto py-5 flex items-center gap-4"
                onClick={() => setSelectedRole("student")}
              >
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold">학생</div>
                  <div className="text-xs text-muted-foreground">내 학원 일정 관리</div>
                </div>
              </Button>
              <Button
                variant={selectedRole === "admin" ? "default" : "outline"}
                className="h-auto py-5 flex items-center gap-4"
                onClick={() => setSelectedRole("admin")}
              >
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold">학원 관계자</div>
                  <div className="text-xs text-muted-foreground">학원 등록 또는 참여</div>
                </div>
              </Button>
            </div>
            <Button
              className="w-full h-14 text-base"
              size="xl"
              onClick={() => setStep("signup_nickname")}
            >
              다음
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* 닉네임 설정 (신규 회원 3단계) */}
        {step === "signup_nickname" && (
          <div className="w-full max-w-sm space-y-6 animate-fade-up">
            <h2 className="text-xl font-semibold text-foreground text-center">닉네임 설정</h2>
            <p className="text-muted-foreground text-sm text-center">서비스에서 사용할 닉네임을 입력해 주세요</p>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="닉네임"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="pl-12 h-14 text-lg"
                maxLength={20}
              />
            </div>
            <Button
              onClick={handleSignupComplete}
              disabled={loading || !nickname.trim()}
              className="w-full h-14 text-base"
              size="xl"
            >
              {loading ? "처리 중..." : "회원가입 완료"}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* 로그인 / 휴대폰 입력 / 이메일 폼 */}
        {step !== "signup_terms" && step !== "signup_role" && step !== "signup_nickname" && (
        <div className="w-full max-w-sm animate-fade-up">
          <h2 className="text-xl font-semibold text-foreground text-center mb-2">
            {authMode === "email" ? "관리자 로그인" : step === "login" ? "로그인" : "회원가입"}
          </h2>
          <p className="text-muted-foreground text-sm text-center mb-6">
            {authMode === "email"
              ? "관리자 계정으로 로그인하세요"
              : step === "login"
                ? "휴대폰 번호로 로그인하세요"
                : "휴대폰 번호를 입력하고 인증해 주세요"}
          </p>

          {/* Email Auth Form */}
          {authMode === "email" && (
            <div className="space-y-4">
              {mustChangePassword ? (
                <>
                  <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-700">
                    임시 비밀번호 로그인 상태입니다. 보안을 위해 새 비밀번호를 설정해주세요.
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="새 비밀번호 (6자 이상)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-12 h-14 text-lg"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="새 비밀번호 확인"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="pl-12 h-14 text-lg"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleCompleteForcedPasswordChange}
                    disabled={loading}
                    className="w-full h-14 text-base"
                    size="xl"
                  >
                    {loading ? "변경 중..." : "새 비밀번호 설정"}
                  </Button>
                </>
              ) : (
                <>
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

              <Button
                onClick={handleEmailLogin}
                disabled={loading}
                className="w-full h-14 text-base"
                size="xl"
              >
                {loading ? "로그인 중..." : "로그인"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                onClick={() => setShowSignupDialog(true)}
                disabled={loading}
                variant="outline"
                className="w-full h-14 text-base"
                size="xl"
              >
                회원가입
              </Button>
                </>
              )}
              <EmailSignupDialog
                open={showSignupDialog}
                onOpenChange={setShowSignupDialog}
                onSuccess={() => {
                  setStep("login");
                  resetEmailState();
                }}
                defaultRole={selectedRole}
              />
            </div>
          )}

          {authMode === "phone" && (step === "login" || step === "signup_phone") && (
            <div className="space-y-4">
              <div key={recaptchaKey} ref={recaptchaContainerRef} id="firebase-recaptcha" className="sr-only" aria-hidden />
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="휴대폰 번호"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(formatPhoneWithDash(e.target.value))}
                  className="pl-12 h-14 text-lg"
                  disabled={loginShowVerification}
                />
              </div>
              {loginShowVerification && (
                <>
                  <div className="space-y-1">
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="SMS 인증 코드"
                        value={loginVerificationCode}
                        onChange={(e) => setLoginVerificationCode(e.target.value)}
                        className="pl-12 pr-14 h-14 text-lg"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground tabular-nums">
                        {formatTimeLeft(verificationSecondsLeft)}
                      </span>
                    </div>
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={loading}
                        className="text-sm text-primary font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                      >
                        {verificationSecondsLeft > 0
                          ? "인증번호가 오지 않나요?"
                          : "인증번호 다시 받기"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {!loginShowVerification ? (
                <Button
                  id="firebase-phone-auth-button"
                  onClick={handleLoginRequestCode}
                  disabled={loading}
                  className="w-full h-14 text-base"
                  size="xl"
                >
                  {loading ? "발송 중..." : "인증번호 받기"}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : step === "login" ? (
                <Button
                  onClick={handleLoginConfirm}
                  disabled={loading}
                  className="w-full h-14 text-base"
                  size="xl"
                >
                  {loading ? "처리 중..." : "로그인"}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSignupFlowConfirm}
                  disabled={loading}
                  className="w-full h-14 text-base"
                  size="xl"
                >
                  {loading ? "처리 중..." : "다음"}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              )}
            </div>
          )}

          <div className="mt-6 text-center">
            {authMode === "email" ? null : step === "login" ? (
              <p className="text-sm text-muted-foreground">
                계정이 없으신가요?{" "}
                <button
                  onClick={() => {
                    setStep("signup_terms");
                    resetVerificationState();
                    resetEmailState();
                  }}
                  className="text-primary font-medium hover:underline"
                >
                  회원가입
                </button>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                이미 계정이 있으신가요?{" "}
                <button
                  onClick={() => {
                    setStep("login");
                    resetVerificationState();
                    resetEmailState();
                  }}
                  className="text-primary font-medium hover:underline"
                >
                  로그인
                </button>
              </p>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pb-8 px-6">
        <p className="text-xs text-muted-foreground">
          시작하면 서비스 이용약관과 개인정보처리방침에 동의하게 됩니다
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
