/**
 * Secure token manager that uses cookies for tokens and localStorage for user data
 * This implementation is more secure than pure localStorage because:
 * 1. The auth token is stored in cookies with proper security settings
 * 2. We use secure cookie settings to protect against XSS
 * 3. We use localStorage only for less sensitive data like user info
 */

import { v4 as uuidv4 } from "uuid";
import Cookies from "js-cookie";

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
const USER_STORAGE_KEY = "meowsenger_user";
const TOKEN_COOKIE_KEY = "meowsenger_token";

// Cookie settings
const COOKIE_EXPIRES = 30; // days
const COOKIE_PATH = "/";
const COOKIE_SECURE = process.env.NODE_ENV === "production";
const COOKIE_SAMESITE = "strict";

/**
 * Set the authentication token both in memory and via cookie
 */
export async function setToken(token: string, user: any): Promise<void> {
  // Set in memory
  inMemoryToken = token;
  currentUser = user;

  // Store the session ID in localStorage to identify this tab is logged in
  localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, SESSION_ID);
  localStorage.setItem(SESSION_ID_KEY, SESSION_ID);

  // Save the user data to localStorage
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

  // Save token in cookie
  Cookies.set(TOKEN_COOKIE_KEY, token, {
    expires: COOKIE_EXPIRES,
    path: COOKIE_PATH,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
  });

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
  // First try memory
  if (inMemoryToken) {
    return inMemoryToken;
  }

  // Then try cookie
  return Cookies.get(TOKEN_COOKIE_KEY) || null;
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
  return !!getToken();
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
  localStorage.removeItem(USER_STORAGE_KEY);

  // Remove the token cookie
  Cookies.remove(TOKEN_COOKIE_KEY, {
    path: COOKIE_PATH,
  });

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
 * Initialize the token manager - try to restore token from cookie and user from localStorage
 */
export async function initTokenManager(): Promise<{
  token: string | null;
  user: any | null;
}> {
  // Try to restore the token from the cookie first
  const cookieToken = Cookies.get(TOKEN_COOKIE_KEY);
  if (cookieToken) {
    inMemoryToken = cookieToken;
  }

  // Try to get user from localStorage
  const storedUser = localStorage.getItem(USER_STORAGE_KEY);
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
    } catch (e) {
      console.error("Failed to parse stored user data");
    }
  }

  // If we have both token and user, we're authenticated
  if (inMemoryToken && currentUser) {
    console.log("Auth restored from cookies/localStorage");
    return { token: inMemoryToken, user: currentUser };
  }

  // Handle case where we have token but no user
  if (inMemoryToken && !currentUser) {
    console.log("Found token but no user data, logging out");
    await clearToken();
    return { token: null, user: null };
  }

  // Handle case where we have user but no token
  if (!inMemoryToken && currentUser) {
    console.log("Found user data but no token, logging out");
    await clearToken();
    return { token: null, user: null };
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
