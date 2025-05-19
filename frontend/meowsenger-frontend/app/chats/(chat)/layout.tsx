"use client";

import { useAuth } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/elements/protected-route";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute authRequired={true}>
      <div className="h-full py-4">{children}</div>
    </ProtectedRoute>
  );
}
