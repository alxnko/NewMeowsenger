"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import Link from "next/link";
import { ProtectedRoute } from "@/components/elements/protected-route";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
} from "@/components/elements/card";
import { FiUser, FiLock, FiAlertCircle, FiRepeat } from "react-icons/fi";

export default function SignupPage() {
  const { register, loading, error, validationErrors, clearErrors } = useAuth();
  const { t } = useLanguage();
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
      <div className="flex items-center justify-center min-h-[100dvh] bg-background px-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="flex flex-col gap-1 items-center pb-2">
            <h1 className="text-2xl font-semibold text-center lowercase">
              {t("signup")}
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center lowercase">
              {t("create_account_to_start_messaging")}
            </p>
          </CardHeader>

          <CardBody className="gap-4">
            {error && (
              <div className="p-3 text-sm rounded-md bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 flex items-center gap-2">
                <FiAlertCircle className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-10">
                <Input
                  id="username"
                  name="username"
                  label={t("username")}
                  labelPlacement="outside"
                  placeholder={t("choose_username")}
                  value={formData.username}
                  onChange={handleChange}
                  isRequired
                  startContent={
                    <FiUser className="text-neutral-400 flex-shrink-0" />
                  }
                  isInvalid={!!getFieldError("username")}
                  errorMessage={getFieldError("username")}
                  variant="bordered"
                  radius="sm"
                  classNames={{
                    label: "lowercase text-sm",
                    input: "lowercase",
                    errorMessage: "text-sm text-red-500",
                  }}
                />

                <Input
                  id="password"
                  name="password"
                  type="password"
                  label={t("password")}
                  labelPlacement="outside"
                  placeholder={t("create_password")}
                  value={formData.password}
                  onChange={handleChange}
                  isRequired
                  startContent={
                    <FiLock className="text-neutral-400 flex-shrink-0" />
                  }
                  isInvalid={!!getFieldError("password")}
                  errorMessage={getFieldError("password")}
                  variant="bordered"
                  radius="sm"
                  classNames={{
                    label: "lowercase text-sm",
                    input: "lowercase",
                    errorMessage: "text-sm text-red-500",
                  }}
                  description="Password must be at least 8 characters and contain a mix of letters and numbers"
                />

                <Input
                  id="password2"
                  name="password2"
                  type="password"
                  label={t("confirm_password")}
                  labelPlacement="outside"
                  placeholder={t("confirm_your_password")}
                  value={formData.password2}
                  onChange={handleChange}
                  isRequired
                  startContent={
                    <FiRepeat className="text-neutral-400 flex-shrink-0" />
                  }
                  isInvalid={!!getFieldError("password2")}
                  errorMessage={getFieldError("password2")}
                  variant="bordered"
                  radius="sm"
                  classNames={{
                    label: "lowercase text-sm",
                    input: "lowercase",
                    errorMessage: "text-sm text-red-500",
                  }}
                />
              </div>

              <Button
                type="submit"
                isLoading={loading}
                isDisabled={loading}
                color="success"
                fullWidth
                radius="sm"
                className="lowercase"
              >
                {loading ? t("creating_account") : t("signup")}
              </Button>
            </form>
          </CardBody>

          <CardFooter className="flex justify-center pt-0">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 lowercase">
              {t("already_have_account")}{" "}
              <Link href="/login" className="text-primary hover:underline">
                {t("login_here")}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
