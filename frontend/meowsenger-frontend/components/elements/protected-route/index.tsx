import { useAuth } from "@/contexts/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  authRequired?: boolean; // If true, redirects to landing page if not authenticated
  authRedirect?: boolean; // If true, redirects to chats if authenticated
}

/**
 * Component to protect routes based on authentication status
 * @param authRequired - If true, user must be logged in to access the route
 * @param authRedirect - If true, logged in users will be redirected away from this route
 */
export const ProtectedRoute = ({
  children,
  authRequired = false,
  authRedirect = false,
}: ProtectedRouteProps) => {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip the redirect if still loading authentication state
    if (loading) return;

    // Redirect if user is not authenticated and route requires authentication
    if (authRequired && !isLoggedIn) {
      router.push("/");
      return;
    }

    // Redirect if user is authenticated and route doesn't allow authenticated users
    if (authRedirect && isLoggedIn) {
      router.push("/chats");
      return;
    }
  }, [isLoggedIn, router, authRequired, authRedirect, loading, pathname]);

  // Show nothing while loading or during redirect
  if (
    loading ||
    (authRequired && !isLoggedIn) ||
    (authRedirect && isLoggedIn)
  ) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
