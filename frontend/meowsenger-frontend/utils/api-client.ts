// API client for communicating with the backend
import { ChatBlock, ChatDetails, ChatMessage } from "@/contexts/chat-context";
import { getToken } from "./token-manager";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Create a custom event for handling auth errors
export const AUTH_ERROR_EVENT = "auth_token_invalid";

interface ApiOptions {
  method?: string;
  headers?: HeadersInit;
  body?: any;
  token?: string;
}

// API Response Types
export interface ApiResponse {
  status: boolean;
  message?: string;
}

export interface AuthResponse extends ApiResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    description: string;
    image_file: string;
    is_verified: boolean;
    is_tester: boolean;
    is_staff: boolean;
  };
}

export interface ChatsResponse extends ApiResponse {
  data: ChatBlock[];
  time: number;
}

export interface ChatResponse extends ApiResponse {
  chat: ChatDetails;
  messages: ChatMessage[];
}

export interface GroupResponse extends ApiResponse {
  id?: number;
  chat?: ChatDetails;
}

// Main API fetch function
export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body } = options;

  // Get token from options OR from in-memory storage if not provided
  // This will automatically check both memory and cookie storage
  const token = options.token || getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
    credentials: "include", // Always include credentials to support cookies
    mode: "cors", // Explicitly set CORS mode
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Log the full error response for debugging
      console.log("API Error Details:", errorData);

      // Handle 401 Unauthorized responses by dispatching an auth error event
      if (response.status === 401 && token) {
        console.log("Auth token invalid, triggering logout");
        // Dispatch a custom event to trigger logout
        window.dispatchEvent(new Event(AUTH_ERROR_EVENT));
        throw new Error("Authentication failed. Please log in again.");
      }

      // Format error message with more details
      let errorMessage = `API error: ${response.status}`;

      // For user-friendly password error messages
      const handlePasswordErrors = (errors: any): string[] => {
        const passwordErrors: string[] = [];
        if (errors.password) {
          const errMsgs: any[] = Array.isArray(errors.password)
            ? errors.password
            : [errors.password];

          // Process each password error with user-friendly messages
          errMsgs.forEach((msg: any) => {
            // Common Django password validation errors
            if (typeof msg === "string" && msg.includes("too short")) {
              passwordErrors.push("password_too_short");
            } else if (typeof msg === "string" && msg.includes("too common")) {
              passwordErrors.push("password_too_common");
            } else if (
              typeof msg === "string" &&
              msg.includes("entirely numeric")
            ) {
              passwordErrors.push("password_entirely_numeric");
            } else if (typeof msg === "string" && msg.includes("similar to")) {
              passwordErrors.push("password_similar_to_personal");
            } else {
              // For other error messages, preserve the original message
              passwordErrors.push(typeof msg === "string" ? msg : String(msg));
            }
          });
        }
        return passwordErrors;
      };

      // Handle different error response formats
      if (errorData.detail) {
        errorMessage = errorData.detail;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.non_field_errors) {
        // Django REST framework often returns non_field_errors for form-wide errors
        errorMessage = Array.isArray(errorData.non_field_errors)
          ? errorData.non_field_errors.join(", ")
          : errorData.non_field_errors;
      }

      // For validation errors, format them in a more structured way
      if (
        errorData.password ||
        errorData.username ||
        errorData.password2 ||
        errorData.errors
      ) {
        const validationErrors: string[] = [];

        // Handle password errors specially for better messages
        const passwordErrors = handlePasswordErrors(errorData);
        if (passwordErrors.length > 0) {
          passwordErrors.forEach((err) =>
            validationErrors.push(`password: ${err}`)
          );
        }

        // Handle other field errors
        Object.entries(errorData).forEach(([field, messages]) => {
          // Skip password field as we handled it separately
          if (field === "password") return;

          if (Array.isArray(messages)) {
            messages.forEach((msg) =>
              validationErrors.push(`${field}: ${msg}`)
            );
          } else if (typeof messages === "string") {
            validationErrors.push(`${field}: ${messages}`);
          } else if (typeof messages === "object" && messages !== null) {
            // Handle nested error objects
            Object.entries(messages as Record<string, any>).forEach(
              ([subField, subMsg]) => {
                const displayField =
                  subField === "" ? field : `${field}.${subField}`;
                validationErrors.push(`${displayField}: ${subMsg}`);
              }
            );
          }
        });

        if (validationErrors.length > 0) {
          errorMessage = `Validation errors: ${validationErrors.join("; ")}`;
        }
      }

      throw new Error(errorMessage);
    }

    // Check if the response is empty or not JSON
    const contentType = response.headers.get("content-type");
    if (
      response.status === 204 ||
      !contentType ||
      !contentType.includes("application/json")
    ) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    console.error(`API error for ${endpoint}:`, error);
    throw error;
  }
}

// Auth API calls
export const authApi = {
  login: (username: string, password: string): Promise<AuthResponse> =>
    apiFetch<AuthResponse>("/api/login/", {
      method: "POST",
      body: { username, password },
    }),

  register: (userData: {
    username: string;
    email?: string;
    password: string;
    password2: string;
    description: string;
    image_file: string;
    rank?: number | null;
    is_tester?: boolean;
    is_verified?: boolean;
  }): Promise<AuthResponse> =>
    apiFetch<AuthResponse>("/api/auth/register/", {
      method: "POST",
      body: userData,
    }),

  logout: (token: string): Promise<ApiResponse> =>
    apiFetch<ApiResponse>("/api/logout/", {
      method: "POST",
      token,
    }),

  // Get user preferences
  getUserPreferences: (
    token: string
  ): Promise<{ language: string; theme: string }> =>
    apiFetch<{ language: string; theme: string }>("/api/preferences/", {
      method: "GET",
      token,
    }),

  // Update user preferences
  updateUserPreferences: (
    token: string,
    preferences: { language?: string; theme?: string }
  ): Promise<{ language: string; theme: string }> =>
    apiFetch<{ language: string; theme: string }>("/api/preferences/", {
      method: "PUT",
      body: preferences,
      token,
    }),
};

// Chat API calls
export const chatApi = {
  getChats: (
    token: string,
    chats = 0,
    lastUpdate = 0
  ): Promise<ChatsResponse> =>
    apiFetch<ChatsResponse>("/api/c/get_chats", {
      method: "POST",
      body: { chats, lastUpdate },
      token,
    }),

  getChat: (
    token: string,
    from: string,
    limit: number = 30,
    beforeId?: number
  ): Promise<ChatResponse & { has_more: boolean; total_messages: number }> =>
    apiFetch<ChatResponse & { has_more: boolean; total_messages: number }>(
      "/api/c/get_chat",
      {
        method: "POST",
        body: {
          from,
          limit,
          before_id: beforeId,
        },
        token,
      }
    ),

  getGroup: (
    token: string,
    from: number,
    limit: number = 30,
    beforeId?: number
  ): Promise<ChatResponse & { has_more: boolean; total_messages: number }> =>
    apiFetch<ChatResponse & { has_more: boolean; total_messages: number }>(
      "/api/c/get_group",
      {
        method: "POST",
        body: {
          from,
          limit,
          before_id: beforeId,
        },
        token,
      }
    ),

  // Updated method to use the dedicated endpoint
  getOlderMessages: (
    token: string,
    chatId: number | string,
    beforeMessageId: number,
    limit: number = 30
  ): Promise<{ status: boolean; messages: ChatMessage[]; has_more: boolean }> =>
    apiFetch<{ status: boolean; messages: ChatMessage[]; has_more: boolean }>(
      "/api/c/get_older_messages",
      {
        method: "POST",
        body: {
          chat_id: chatId,
          before_id: beforeMessageId,
          limit,
        },
        token,
      }
    ),

  createGroup: (
    token: string,
    name: string,
    members: string[]
  ): Promise<GroupResponse> =>
    apiFetch<GroupResponse>("/api/c/create_group", {
      method: "POST",
      body: { name, members },
      token,
    }),

  addMember: (
    token: string,
    from: number,
    username: string,
    message: string
  ): Promise<ApiResponse> =>
    apiFetch<ApiResponse>("/api/c/add_member", {
      method: "POST",
      body: { from, username, message },
      token,
    }),

  removeMember: (
    token: string,
    from: number,
    username: string,
    message: string
  ): Promise<ApiResponse> =>
    apiFetch<ApiResponse>("/api/c/remove_member", {
      method: "POST",
      body: { from, username, message },
      token,
    }),

  leaveGroup: (
    token: string,
    from: number,
    message: string
  ): Promise<ApiResponse> =>
    apiFetch<ApiResponse>("/api/c/leave_group", {
      method: "POST",
      body: { from, message },
      token,
    }),

  addAdmin: (
    token: string,
    from: number,
    username: string,
    message: string
  ): Promise<ApiResponse> =>
    apiFetch<ApiResponse>("/api/c/add_admin", {
      method: "POST",
      body: { from, username, message },
      token,
    }),

  removeAdmin: (
    token: string,
    from: number,
    username: string,
    message: string
  ): Promise<ApiResponse> =>
    apiFetch<ApiResponse>("/api/c/remove_admin", {
      method: "POST",
      body: { from, username, message },
      token,
    }),

  sendMessage: (
    token: string,
    to: string | number,
    text: string,
    replyTo?: number,
    isForwarded: boolean = false
  ): Promise<ApiResponse> => {
    // Warning: This endpoint is not implemented in the Django backend
    // Messages should be sent using the WebSocket service instead
    console.warn(
      "API sendMessage is deprecated - use websocketService.sendChatMessage instead"
    );

    // Instead of making an API call, use the websocket utility directly
    // This is a fallback for compatibility until all code is migrated to WebSocket

    // Compatibility layer to maintain the same interface
    return Promise.resolve({
      status: false,
      message: "Please use WebSocket for sending messages",
    });
  },

  saveSettings: (
    token: string,
    id: number,
    name: string,
    description: string,
    message: string
  ): Promise<ApiResponse> =>
    apiFetch<ApiResponse>("/api/c/save_settings", {
      method: "POST",
      body: { id, name, description, message },
      token,
    }),
};
