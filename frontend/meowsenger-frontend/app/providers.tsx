"use client";

import type { ThemeProviderProps } from "next-themes";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { AuthProvider } from "@/contexts/auth-context";
import { ChatProvider } from "@/contexts/chat-context";
import { LanguageProvider } from "@/contexts/language-context";
import { ToastProvider } from "@/contexts/toast-context";
import { CustomThemeProvider } from "@/contexts/theme-context";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider {...themeProps}>
        <ToastProvider>
          <AuthProvider>
            <LanguageProvider>
              <CustomThemeProvider>
                <ChatProvider>{children}</ChatProvider>
              </CustomThemeProvider>
            </LanguageProvider>
          </AuthProvider>
        </ToastProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
