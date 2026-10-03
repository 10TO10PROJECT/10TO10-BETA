import { useState, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedSuperAdminRouteProps {
  children: ReactNode;
}

const ProtectedSuperAdminRoute = ({ children }: ProtectedSuperAdminRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const bypassInDev = import.meta.env.DEV;

  useEffect(() => {
    if (bypassInDev) {
      setAuthorized(true);
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          const redirect = location.pathname + location.search;
          navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
          return;
        }
        
        // Check if user is super admin
        const { data: roleData, error } = await supabase
          .from('user_roles')
          .select('is_super_admin')
          .eq('user_id', session.user.id)
          .maybeSingle();
          
        if (error) {
          if (import.meta.env.DEV) {
            console.error('Super admin check error:', error);
          }
          const redirect = location.pathname + location.search;
          navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
          return;
        }
        
        if (!roleData || !roleData.is_super_admin) {
          const redirect = location.pathname + location.search;
          navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
          return;
        }
        
        setAuthorized(true);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Auth check error:', error);
        }
        navigate('/auth');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_OUT') {
          navigate('/auth');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname, location.search, bypassInDev]);

  if (loading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedSuperAdminRoute;
