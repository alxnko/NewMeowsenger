/**
 * Utility functions for creating structured system messages
 */

import { WebSocketMessage } from "./websocket-service";

/**
 * Types of system messages
 */
export enum SystemMessageType {
  USER_ADDED = 'user_added',
  USER_REMOVED = 'user_removed',
  ADMIN_ADDED = 'admin_added',
  ADMIN_REMOVED = 'admin_removed',
  GROUP_CREATED = 'group_created',
  GROUP_SETTINGS_UPDATED = 'group_settings_updated',
  USER_LEFT = 'user_left',
  USER_JOINED = 'user_joined',
  NO_MESSAGES = 'no_messages'
}

/**
 * Helper function to create system message parameters for the WebSocket API
 */
export const createSystemMessageParams = (
  type: SystemMessageType,
  params: Record<string, string | number>
): { system_message_type: string; system_message_params: Record<string, string | number> } => {
  return {
    system_message_type: type,
    system_message_params: params
  };
};

/**
 * Generate system message for making a user an admin
 */
export const generateMakeAdminSystemMessage = (
  actorUsername: string,
  targetUsername: string
): Partial<WebSocketMessage> => {
  return {
    content: `${actorUsername} made ${targetUsername} an admin`,
    system_message_type: SystemMessageType.ADMIN_ADDED,
    system_message_params: {
      actor: actorUsername,
      target: targetUsername
    }
  };
};

/**
 * Generate system message for removing admin rights
 */
export const generateRemoveAdminSystemMessage = (
  actorUsername: string,
  targetUsername: string
): Partial<WebSocketMessage> => {
  return {
    content: `${actorUsername} removed admin rights from ${targetUsername}`,
    system_message_type: SystemMessageType.ADMIN_REMOVED,
    system_message_params: {
      actor: actorUsername,
      target: targetUsername
    }
  };
};

/**
 * Generate system message for updating group settings
 */
export const generateUpdateSettingsSystemMessage = (
  actorUsername: string
): Partial<WebSocketMessage> => {
  return {
    content: `${actorUsername} updated group settings`,
    system_message_type: SystemMessageType.GROUP_SETTINGS_UPDATED,
    system_message_params: {
      actor: actorUsername
    }
  };
};

/**
 * Generate system message for adding a user to a group
 */
export const generateAddUserSystemMessage = (
  actorUsername: string,
  targetUsername: string
): Partial<WebSocketMessage> => {
  return {
    content: `${actorUsername} added ${targetUsername} to the group`,
    system_message_type: SystemMessageType.USER_ADDED,
    system_message_params: {
      actor: actorUsername,
      target: targetUsername
    }
  };
};

/**
 * Generate system message for removing a user from a group
 */
export const generateRemoveUserSystemMessage = (
  actorUsername: string,
  targetUsername: string
): Partial<WebSocketMessage> => {
  return {
    content: `${actorUsername} removed ${targetUsername} from the group`,
    system_message_type: SystemMessageType.USER_REMOVED,
    system_message_params: {
      actor: actorUsername,
      target: targetUsername
    }
  };
};
