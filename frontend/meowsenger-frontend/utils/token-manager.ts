/**
 * Secure token manager that uses in-memory storage with cookie fallback
 * This implementation is more secure than localStorage because:
 * 1. The token is primarily held in memory and not accessible via JavaScript from other tabs/windows
 * 2. For persistence across page refreshes, we use a httpOnly cookie (when available)
 * 3. We use a less sensitive sessionId in localStorage only for cross-tab communication
 */

import { v4 as uuidv4 } from "uuid";

// API URL from environment
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Generate a unique session ID for this browser tab
// If uuid import fails, use a timestamp-based random ID as fallback
let SESSION_ID: string;
try {
  SESSION_ID = uuidv4();
} catch (e) {
  // Fallback if uuid package isn't available
  SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// In-memory token storage (cleared when the page is refreshed)
let inMemoryToken: string | null = null;
let currentUser: any | null = null;

// Keys for storage and events
const SESSION_ID_KEY = "meowsenger_session_id";
const TOKEN_CHANGE_EVENT = "meowsenger_token_change";
const LOCAL_STORAGE_SESSION_KEY = "meowsenger_active_session";

// Direct fetch calls to avoid circular dependency with api-client
async function fetchSetCookie(token: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/auth/set-cookie`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Error setting cookie:", errorData);
      throw new Error(`Failed to set auth cookie: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to set auth cookie:", error);
    // Don't re-throw to prevent blocking the auth flow
  }
}

async function fetchClearCookie(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/auth/clear-cookie`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Error clearing cookie:", errorData);
      throw new Error(`Failed to clear auth cookie: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to clear auth cookie:", error);
    // Don't re-throw to prevent blocking the auth flow
  }
}

async function fetchGetToken(): Promise<{ token: string | null }> {
  try {
    const response = await fetch(`${API_URL}/api/auth/get-token`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Error getting token from cookie:", errorData);
      return { token: null };
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to get auth token from cookie:", error);
    return { token: null };
  }
}

/**
 * Set the authentication token both in memory and via API cookie
 */
export async function setToken(token: string, user: any): Promise<void> {
  // Set in memory
  inMemoryToken = token;
  currentUser = user;

  // Store the session ID in localStorage to identify this tab is logged in
  localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, SESSION_ID);
  localStorage.setItem(SESSION_ID_KEY, SESSION_ID);

  // Save the user data for use across the app
  localStorage.setItem("user", JSON.stringify(user));

  // Send the token to backend to set it as a httpOnly cookie
  try {
    await fetchSetCookie(token);
  } catch (error) {
    console.error("Failed to set auth cookie:", error);
  }

  // Notify other tabs about the login
  try {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: TOKEN_CHANGE_EVENT,
        newValue: "login",
      })
    );
  } catch (error) {
    console.error("Failed to dispatch storage event:", error);
  }
}

/**
 * Get the current authentication token
 */
export function getToken(): string | null {
  return inMemoryToken;
}

/**
 * Get the current user object
 */
export function getUser(): any | null {
  return currentUser;
}

/**
 * Check if the user is logged in
 */
export function isLoggedIn(): boolean {
  return !!inMemoryToken;
}

/**
 * Clear the authentication token both in memory and cookie
 */
export async function clearToken(): Promise<void> {
  // Clear from memory
  inMemoryToken = null;
  currentUser = null;

  // Remove the session ID from localStorage
  localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem("user");

  // Clear the cookie via API
  try {
    await fetchClearCookie();
  } catch (error) {
    console.error("Failed to clear auth cookie:", error);
  }

  // Notify other tabs about the logout
  try {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: TOKEN_CHANGE_EVENT,
        newValue: "logout",
      })
    );
  } catch (error) {
    console.error("Failed to dispatch storage event:", error);
  }
}

/**
 * Initialize the token manager - try to restore token from cookie
 */
export async function initTokenManager(): Promise<{
  token: string | null;
  user: any | null;
}> {
  // Check if we have a valid session in another tab
  const activeSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
  const storedUser = localStorage.getItem("user");

  // Try to restore the token from the cookie
  try {
    const response = await fetchGetToken();

    if (response.token) {
      inMemoryToken = response.token;
      if (storedUser) {
        try {
          currentUser = JSON.parse(storedUser);
        } catch (e) {
          console.error("Failed to parse stored user data");
          currentUser = null;
        }
      }
      return { token: response.token, user: currentUser };
    }
  } catch (error) {
    console.error("Failed to restore auth token:", error);
  }

  // If no token is available but another tab has a session, show a message
  if (activeSession && activeSession !== SESSION_ID) {
    console.log("Session active in another tab");
  }

  return { token: null, user: null };
}

// Listen for storage events from other tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === TOKEN_CHANGE_EVENT) {
      if (event.newValue === "logout") {
        // Another tab logged out, clear our memory too
        inMemoryToken = null;
        currentUser = null;
      } else if (event.newValue === "login" && !inMemoryToken) {
        // Another tab logged in, we should refresh to get the token
        window.location.reload();
      }
    }
  });
}
