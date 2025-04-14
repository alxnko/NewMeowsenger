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

  // Load user from localStorage on initial mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }

    setLoading(false);
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
    // Clear errors only when explicitly submitting the form
    clearErrors();
    setLoading(true);

    try {
      const response = await authApi.login(username, password);

      if (response && response.token) {
        setUser(response.user);
        setToken(response.token);

        localStorage.setItem("user", JSON.stringify(response.user));
        localStorage.setItem("token", response.token);

        router.push("/chats");
      } else {
        setError("Invalid login response");
      }
    } catch (err) {
      if (err instanceof Error) {
        // Check if the error message contains validation errors
        if (err.message.startsWith("Validation errors:")) {
          const errMessage = err.message.replace("Validation errors: ", "");
          const errParts = errMessage.split("; ");

          const errors: ValidationErrors = {};
          errParts.forEach((part) => {
            const [field, message] = part.split(": ");
            errors[field] = message;
          });

          setValidationErrors(errors);
          setError("Please correct the errors below");
        } else {
          setError(err.message);
        }
      } else {
        setError("Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: RegisterData) => {
    setLoading(true);
    clearErrors();

    // Add default description if not provided
    const dataToSend = {
      ...userData,
      description: userData.description || "default",
    };

    try {
      const response = await authApi.register(dataToSend);

      if (response && response.token) {
        setUser(response.user);
        setToken(response.token);

        localStorage.setItem("user", JSON.stringify(response.user));
        localStorage.setItem("token", response.token);

        router.push("/chats");
      } else {
        setError("Invalid registration response");
      }
    } catch (err) {
      if (err instanceof Error) {
        // Check if the error message contains validation errors
        if (err.message.startsWith("Validation errors:")) {
          const errMessage = err.message.replace("Validation errors: ", "");
          const errParts = errMessage.split("; ");

          const errors: ValidationErrors = {};
          errParts.forEach((part) => {
            const [field, message] = part.split(": ");
            errors[field] = message;
          });

          setValidationErrors(errors);
          setError("Please correct the errors below");
        } else {
          setError(err.message);
        }
      } else {
        setError("Registration failed");
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
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      setLoading(false);
      router.push("/login");
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
