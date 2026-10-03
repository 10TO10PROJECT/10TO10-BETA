import { useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

const ProtectedAdminRoute = ({ children }: ProtectedAdminRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/auth?role=admin&mode=email');
          return;
        }
        
        // Check if user has admin role in the database
        const { data: roleData, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();
          
        if (error) {
          // Log only in development
          if (import.meta.env.DEV) {
            console.error('Role fetch error:', error);
          }
          navigate('/home');
          return;
        }
        
        if (!roleData || roleData.role !== 'admin') {
          navigate('/home');
          return;
        }
        
        setAuthorized(true);
      } catch (error) {
        // Log only in development
        if (import.meta.env.DEV) {
          console.error('Auth check error:', error);
        }
          navigate('/auth?role=admin&mode=email');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          navigate('/auth?role=admin&mode=email');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

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

export default ProtectedAdminRoute;
