"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { ProtectedRoute } from "@/components/elements/protected-route";

export default function SignupPage() {
  const { register, loading, error, validationErrors, clearErrors } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    password2: "",
    image_file: "default",
    rank: null,
    is_tester: false,
    is_verified: false,
  });

  // Clear errors when component unmounts
  useEffect(() => {
    return () => clearErrors();
  }, [clearErrors]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await register(formData);
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
            <h1 className="text-3xl font-bold">Sign Up for Meowsenger</h1>
            <p className="mt-2 text-muted-foreground">
              Create your account to start messaging
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
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 mt-1 border ${
                    getFieldError("username")
                      ? "border-red-500"
                      : "border-muted"
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background`}
                  placeholder="Choose a username"
                />
                {getFieldError("username") && (
                  <p className="mt-1 text-sm text-red-500">
                    {getFieldError("username")}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 mt-1 border ${
                    getFieldError("password")
                      ? "border-red-500"
                      : "border-muted"
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background`}
                  placeholder="Create a password"
                />
                {getFieldError("password") && (
                  <p className="mt-1 text-sm text-red-500">
                    {getFieldError("password")}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password2"
                  className="block text-sm font-medium"
                >
                  Confirm Password
                </label>
                <input
                  id="password2"
                  name="password2"
                  type="password"
                  required
                  value={formData.password2}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 mt-1 border ${
                    getFieldError("password2")
                      ? "border-red-500"
                      : "border-muted"
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background`}
                  placeholder="Confirm your password"
                />
                {getFieldError("password2") && (
                  <p className="mt-1 text-sm text-red-500">
                    {getFieldError("password2")}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 text-white bg-primary rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Sign up"}
            </button>

            <div className="text-center mt-4">
              <p className="text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Log in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
