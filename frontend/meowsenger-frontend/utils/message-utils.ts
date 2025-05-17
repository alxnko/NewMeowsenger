/**
 * Utility functions for handling chat messages
 */

import { SystemMessageType } from "./system-message-utils";

/**
 * Translates system messages using the provided translation function
 * @param message - The system message to translate
 * @param t - The translation function from language context
 * @param systemMessageType - Optional type from structured system message
 * @param systemMessageParams - Optional parameters from structured system message
 * @returns The translated message
 */
export const translateSystemMessage = (
  message: string,
  t: (key: string, params?: any) => string,
  systemMessageType?: string,
  systemMessageParams?: Record<string, string | number>
): string => {
  // Return early for empty messages
  if (!message) return "";

  // If we have structured system message data, use it directly for translation
  if (systemMessageType && systemMessageParams) {
    switch (systemMessageType) {
      case SystemMessageType.USER_ADDED:
        return t("user_added_to_group", systemMessageParams);

      case SystemMessageType.USER_REMOVED:
        return t("user_removed_from_group", systemMessageParams);

      case SystemMessageType.ADMIN_ADDED:
        return t("user_made_admin", systemMessageParams);

      case SystemMessageType.ADMIN_REMOVED:
        return t("user_removed_admin", systemMessageParams);

      case SystemMessageType.GROUP_CREATED:
        return t("system_created_group", systemMessageParams);

      case SystemMessageType.GROUP_SETTINGS_UPDATED:
        return t("updated_group_settings", systemMessageParams);

      case SystemMessageType.USER_LEFT:
        return t("system_left_group", systemMessageParams);

      case SystemMessageType.USER_JOINED:
        return t("system_joined_group", systemMessageParams);

      case SystemMessageType.NO_MESSAGES:
        return t("no_messages_short");

      default:
        // If unknown type but we have params, try to use them
        console.log("Unknown system message type:", systemMessageType);
    }
  }

  // Handle exact matches for common system messages
  if (message === "no messages") {
    return t("no_messages_short");
  }

  // Extract parameters from legacy system messages

  // Pattern: "X made Y an admin" - User made admin
  const adminRegex = /^(.+) made (.+) an admin$/;
  const adminMatch = message.match(adminRegex);
  if (adminMatch) {
    return t("user_made_admin", {
      actor: adminMatch[1],
      target: adminMatch[2],
    });
  }

  // Pattern: "X updated group settings" - Group settings updated
  const settingsRegex = /^(.+) updated group settings$/;
  const settingsMatch = message.match(settingsRegex);
  if (settingsMatch) {
    return t("updated_group_settings", { actor: settingsMatch[1] });
  }

  // Pattern: "X was added to the group by Y" - Legacy format from backend
  const addedByRegex = /^(.+) was added to the group by (.+)$/;
  const addedByMatch = message.match(addedByRegex);
  if (addedByMatch) {
    return t("user_added_to_group", {
      target: addedByMatch[1],
      actor: addedByMatch[2],
    });
  }

  // Pattern: "X was добавил(а) to the group by Y в группу" - Malformed mixed language
  const mixedAddedRegex =
    /^(.+) was добавил\(а\) to the group by (.+) в группу$/;
  const mixedAddedMatch = message.match(mixedAddedRegex);
  if (mixedAddedMatch) {
    return t("user_added_to_group", {
      target: mixedAddedMatch[1],
      actor: mixedAddedMatch[2],
    });
  }

  // Pattern: "X added Y to the group" - Standard format
  const addedRegex = /^(.+) added (.+) to the group$/;
  const addedMatch = message.match(addedRegex);
  if (addedMatch) {
    return t("user_added_to_group", {
      actor: addedMatch[1],
      target: addedMatch[2],
    });
  }

  // First, normalize the message to lowercase for pattern matching
  const lowerMessage = message.toLowerCase();

  // Common system message patterns that need translation
  if (message.includes("joined the group")) {
    return t("system_joined_group", { user: message.split(" ")[0] });
  }

  if (message.includes("left the group")) {
    return t("system_left_group", { user: message.split(" ")[0] });
  }

  // User removed from group - pattern: "[remover] removed [removed] from the group"
  if (
    (lowerMessage.includes("removed") || lowerMessage.includes("remove")) &&
    (lowerMessage.includes("from the group") ||
      lowerMessage.includes("from group")) &&
    !lowerMessage.includes("admin")
  ) {
    try {
      const remover = message.split(" removed ")[0];
      const removed = message.split(" removed ")[1].split(" from the group")[0];
      return t("user_removed_from_group", { actor: remover, target: removed });
    } catch (e) {
      console.error("Error parsing user removed message:", message);
      return message;
    }
  }

  if (
    lowerMessage.includes("created") &&
    (lowerMessage.includes("group") || lowerMessage.includes("chat"))
  ) {
    return t("system_created_group", { user: message.split(" ")[0] });
  }

  // For any other system messages, just return as is
  console.log("Unhandled system message:", message);
  return message;
};

/**
 * Creates a date formatter that adds appropriate pluralization and translation for languages
 * This is useful to customize date-fns behavior with our translation system
 * @param t - The translation function from language context
 */
export const createDateFormatter = (
  t: (key: string, params?: any) => string
) => {
  return {
    format: (date: Date | number | string, format?: string): string => {
      // For now, we only implement the relative time format
      return formatRelativeTime(date, t);
    },
  };
};

/**
 * Formats a date to a relative time string (e.g. "2 days ago") with translations
 * @param date - The date to format
 * @param t - The translation function from language context
 * @returns The formatted relative time string
 */
export const formatRelativeTime = (
  date: Date | number | string,
  t: (key: string, params?: any) => string
): string => {
  const now = new Date();
  const parsedDate = typeof date === "object" ? date : new Date(date);
  const seconds = Math.round((now.getTime() - parsedDate.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const months = Math.round(days / 30);
  const years = Math.round(days / 365);

  // Helper function for pluralization with language-specific rules
  const pluralize = (
    singular: string,
    plural: string,
    count: number
  ): string => {
    // Russian language has complex pluralization rules
    if (t("language") === "русский") {
      // Special forms for Russian numbers
      // For counts ending in 1 (except 11), use singular
      if (count % 10 === 1 && count % 100 !== 11) {
        return t(singular, { count });
      }
      // For counts ending in 2-4 (except 12-14), use special form (handled in translation)
      else if (
        count % 10 >= 2 &&
        count % 10 <= 4 &&
        (count % 100 < 10 || count % 100 >= 20)
      ) {
        // Russian uses genitive singular for 2-4
        return t(plural, { count });
      }
      // For all other cases, use plural genitive
      else {
        return t(plural, { count });
      }
    }

    // For English (and other languages), simple singular/plural
    return count === 1 ? t(singular, { count }) : t(plural, { count });
  };

  if (seconds < 45) {
    return t("less_than_x_seconds_ago");
  } else if (seconds < 90) {
    return t("half_a_minute_ago");
  } else if (minutes < 45) {
    return pluralize("x_minutes_ago", "x_minutes_ago_plural", minutes);
  } else if (minutes < 90) {
    return t("about_x_hours_ago", { count: 1 });
  } else if (hours < 24) {
    return pluralize("about_x_hours_ago", "about_x_hours_ago_plural", hours);
  } else if (hours < 42) {
    return t("x_days_ago", { count: 1 });
  } else if (days < 30) {
    return pluralize("x_days_ago", "x_days_ago_plural", days);
  } else if (days < 45) {
    return t("about_x_months_ago", { count: 1 });
  } else if (days < 365) {
    return pluralize("about_x_months_ago", "about_x_months_ago_plural", months);
  } else if (years < 1.5) {
    return t("x_years_ago", { count: 1 });
  } else {
    return pluralize("x_years_ago", "x_years_ago_plural", years);
  }
};
