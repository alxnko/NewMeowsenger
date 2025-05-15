"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/elements/protected-route";

export default function LoginPage() {
  const { login, loading, error, validationErrors } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  // No automatic error clearing on useEffect - we only want to clear errors on form submission

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(username, password);
  };

  // Helper function to format error messages
  const getFieldError = (fieldName: string): string | null => {
    if (!validationErrors || !validationErrors[fieldName]) {
      return null;
    }

    const error = validationErrors[fieldName];
    return Array.isArray(error) ? error.join(", ") : error;
  };

  return (
    <ProtectedRoute authRedirect={true}>
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-xl shadow-lg">
          <div className="text-center">
            <h1 className="text-3xl font-bold">{t("login_to_meowsenger")}</h1>
            <p className="mt-2 text-muted-foreground">
              {t("welcome_back_enter_credentials")}
            </p>
          </div>

          {error && (
            <div className="p-3 text-sm text-white bg-red-500 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium">
                  {t("username")}
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full px-3 py-2 mt-1 border ${
                    getFieldError("username")
                      ? "border-red-500"
                      : "border-muted"
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background`}
                  placeholder={t("your_username")}
                />
                {getFieldError("username") && (
                  <p className="mt-1 text-sm text-red-500">
                    {getFieldError("username")}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium">
                  {t("password")}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-3 py-2 mt-1 border ${
                    getFieldError("password")
                      ? "border-red-500"
                      : "border-muted"
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background`}
                  placeholder={t("your_password")}
                />
                {getFieldError("password") && (
                  <p className="mt-1 text-sm text-red-500">
                    {getFieldError("password")}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 text-white bg-primary rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? t("logging_in") : t("log_in")}
            </button>

            <div className="text-center mt-4">
              <p className="text-muted-foreground">
                {t("dont_have_account")}{" "}
                <Link href="/signup" className="text-primary hover:underline">
                  {t("sign_up")}
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
