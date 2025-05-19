"use client";
import {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authApi, AuthResponse, AUTH_ERROR_EVENT } from "@/utils/api-client";
import { useToast } from "./toast-context";
import * as tokenManager from "@/utils/token-manager";
import { useLanguage } from "./language-context";

export interface User {
  id: number;
  username: string;
  email: string;
  description: string;
  image_file: string;
  is_verified: boolean;
  is_tester: boolean;
  is_staff: boolean;
}

interface RegisterData {
  username: string;
  email?: string; // Make email optional
  password: string;
  password2: string;
  description?: string; // Make description optional
  image_file: string;
  rank?: number | null;
  is_tester?: boolean;
  is_verified?: boolean;
}

// Define a type for field-specific validation errors
export interface ValidationErrors {
  [key: string]: string | string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  validationErrors: ValidationErrors | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isTester: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  clearErrors: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] =
    useState<ValidationErrors | null>(null);
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useLanguage();

  // Initialize token manager and load user on initial mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Set a loading state while we attempt to restore auth
        setLoading(true);

        // Use a timeout to avoid blocking app rendering for too long
        const timeoutPromise = new Promise<{
          token: string | null;
          user: any | null;
        }>((_, reject) =>
          setTimeout(() => reject(new Error("Auth init timeout")), 5000)
        );

        // Race between normal init and timeout
        const { token: storedToken, user: storedUser } = await Promise.race([
          tokenManager.initTokenManager(),
          timeoutPromise,
        ]);

        if (storedToken && storedUser) {
          setUser(storedUser);
          setToken(storedToken);
          console.log("Auth restored from cookies and localStorage");
        } else {
          console.log("No stored auth found, user is logged out");
          // Ensure user is properly logged out
          await tokenManager.clearToken();
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
        // On error, try one more time to get auth without the timeout
        try {
          const { token: fallbackToken, user: fallbackUser } =
            await tokenManager.initTokenManager();
          if (fallbackToken && fallbackUser) {
            setUser(fallbackUser);
            setToken(fallbackToken);
            console.log("Auth restored on second attempt");
          } else {
            // If we still can't restore auth, clear any partial state
            await tokenManager.clearToken();
          }
        } catch (fallbackErr) {
          console.error("Failed final auth restore attempt:", fallbackErr);
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Add event listener for auth token invalid events
  useEffect(() => {
    const handleAuthError = () => {
      const errorMsg = "Authentication expired. Please log in again.";
      setError(errorMsg);
      showToast(errorMsg, "error");
      logout();
    };

    // Add event listener for AUTH_ERROR_EVENT
    window.addEventListener(AUTH_ERROR_EVENT, handleAuthError);

    // Clean up on unmount
    return () => {
      window.removeEventListener(AUTH_ERROR_EVENT, handleAuthError);
    };
  }, []);

  // Show errors as toasts when they change
  useEffect(() => {
    if (error) {
      showToast(error, "error");
    }
  }, [error, showToast]);

  // Only clear errors manually, not automatically
  const clearErrors = () => {
    setError(null);
    setValidationErrors(null);
  };

  const login = async (username: string, password: string) => {
    setLoading(true);
    clearErrors();

    try {
      // Convert username to lowercase
      const response = await authApi.login(username.toLowerCase(), password);

      if (response && response.token) {
        setUser(response.user);
        setToken(response.token);

        // Set token in secure token manager instead of localStorage
        await tokenManager.setToken(response.token, response.user);

        router.push("/chats");
      } else {
        setError(t("error_authentication_failed"));
      }
    } catch (err) {
      if (err instanceof Error) {
        // Check if the error message contains validation errors
        if (err.message.startsWith("Validation errors:")) {
          const errMessage = err.message.replace("Validation errors: ", "");
          const errParts = errMessage.split("; ");

          const errors: ValidationErrors = {};
          errParts.forEach((part) => {
            const colonIndex = part.indexOf(": ");
            if (colonIndex === -1) {
              errors["general"] = part;
              return;
            }

            const field = part.substring(0, colonIndex);
            const errorMsg = part.substring(colonIndex + 2);
            errors[field] = errorMsg;
          });

          setValidationErrors(errors);

          // Use translated error messages
          if (errors.username) {
            setError(t("error_invalid_credentials"));
          } else if (errors.password) {
            setError(t("error_invalid_credentials"));
          } else {
            setError(t("error_authentication_failed"));
          }
        } else if (
          err.message.includes("Invalid username or password") ||
          err.message.includes("401")
        ) {
          setError(t("error_invalid_credentials"));
        } else if (err.message.includes("API error: 500")) {
          setError(t("error_server"));
        } else {
          setError(err.message);
        }
      } else {
        setError(t("error_authentication_failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: RegisterData) => {
    setLoading(true);
    clearErrors();

    // Convert username to lowercase
    const dataToSend = {
      ...userData,
      username: userData.username.toLowerCase(),
      description: userData.description || "default",
    };

    try {
      const response = await authApi.register(dataToSend);

      if (response && response.token) {
        setUser(response.user);
        setToken(response.token);

        // Set token in secure token manager instead of localStorage
        await tokenManager.setToken(response.token, response.user);

        router.push("/chats");
      } else {
        setError(t("error_registration_failed"));
      }
    } catch (err) {
      if (err instanceof Error) {
        // Check if the error message contains validation errors
        if (err.message.startsWith("Validation errors:")) {
          const errMessage = err.message.replace("Validation errors: ", "");
          const errParts = errMessage.split("; ");

          const errors: ValidationErrors = {};
          errParts.forEach((part) => {
            // Parse field and message from each error part
            const colonIndex = part.indexOf(": ");
            if (colonIndex === -1) {
              // If no colon, treat as a general error
              errors["general"] = part;
              return;
            }

            const field = part.substring(0, colonIndex);
            const errorMsg = part.substring(colonIndex + 2); // +2 to skip ': '

            // Store the original message
            errors[field] = errorMsg;
          });

          setValidationErrors(errors);

          // Create a clear, user-friendly translated error summary
          let errorSummary: string;

          if (
            errors.password &&
            typeof errors.password === "string" &&
            errors.password.includes("too short")
          ) {
            errorSummary = t("password_too_short");
          } else if (
            errors.password &&
            typeof errors.password === "string" &&
            errors.password.includes("too common")
          ) {
            errorSummary = t("password_too_common");
          } else if (
            errors.password &&
            typeof errors.password === "string" &&
            errors.password.includes("entirely numeric")
          ) {
            errorSummary = t("password_entirely_numeric");
          } else if (
            errors.password &&
            typeof errors.password === "string" &&
            errors.password.includes("similar to")
          ) {
            errorSummary = t("password_similar_to_personal");
          } else if (errors.password2) {
            errorSummary = t("passwords_dont_match");
          } else if (
            errors.username &&
            typeof errors.username === "string" &&
            errors.username.includes("already exists")
          ) {
            errorSummary = t("username_taken");
          } else if (errors.password) {
            errorSummary =
              typeof errors.password === "string"
                ? errors.password
                : Array.isArray(errors.password)
                ? errors.password.join(", ")
                : String(errors.password);
          } else if (errors.username) {
            errorSummary =
              typeof errors.username === "string"
                ? errors.username
                : Array.isArray(errors.username)
                ? errors.username.join(", ")
                : String(errors.username);
          } else {
            // Fallback to generic error
            errorSummary = t("error_registration_failed");
          }

          setError(errorSummary);
        } else {
          // For non-validation errors, provide a user-friendly translated message
          if (err.message.includes("API error: 400")) {
            setError(t("error_registration_failed"));
          } else if (err.message.includes("API error: 500")) {
            setError(t("error_server"));
          } else {
            setError(err.message);
          }
        }
      } else {
        setError(t("error_registration_failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);

    try {
      if (token) {
        await authApi.logout(token);
      }

      // Clear token from secure token manager
      await tokenManager.clearToken();

      // Ensure state is reset
      setUser(null);
      setToken(null);

      // Redirect to login page
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);

      // Even if API call fails, clear local state
      setUser(null);
      setToken(null);
      await tokenManager.clearToken();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        validationErrors,
        isLoggedIn: !!user,
        isAdmin: user?.is_staff || false,
        isTester: user?.is_tester || false,
        login,
        register,
        logout,
        clearErrors,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
