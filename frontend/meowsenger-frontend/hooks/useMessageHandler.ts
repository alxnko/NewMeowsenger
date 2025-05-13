"use client";

import { useCallback, useRef } from "react";
import { ChatMessage } from "@/contexts/chat-context";

/**
 * A custom hook that provides optimized message handling with built-in deduplication
 * and performance optimizations for chat applications.
 */
function useMessageHandler() {
  // Reference to track message IDs we've already processed
  const processedMessageIdsRef = useRef<Set<number>>(new Set());
  // Cache for optimistic messages to find and replace them efficiently
  const pendingMessagesRef = useRef<Map<string, ChatMessage>>(new Map());

  /**
   * Add a message to the processed tracking set
   */
  const trackProcessedMessage = useCallback((messageId: number) => {
    processedMessageIdsRef.current.add(messageId);
  }, []);

  /**
   * Check if a message has already been processed
   */
  const isMessageProcessed = useCallback((messageId: number) => {
    return processedMessageIdsRef.current.has(messageId);
  }, []);

  /**
   * Track an optimistic message that's pending confirmation
   */
  const trackPendingMessage = useCallback(
    (message: ChatMessage, key?: string) => {
      const trackingKey =
        key ||
        `${message.author}:${message.time}:${message.text.substring(0, 20)}`;
      pendingMessagesRef.current.set(trackingKey, message);
      return trackingKey;
    },
    []
  );

  /**
   * Find a matching pending message to replace with a confirmed one
   */ const findPendingMessage = useCallback(
    (content: string, author: string): ChatMessage | undefined => {
      // First try exact content match
      // Use Array.from to convert the Map entries to an array to avoid iterator issues
      const entries = Array.from(pendingMessagesRef.current);

      for (const [key, message] of entries) {
        if (
          message.isPending &&
          message.author === author &&
          message.text === content
        ) {
          pendingMessagesRef.current.delete(key);
          return message;
        }
      }

      // No exact match, return oldest pending message from author as fallback
      let oldestMessage: ChatMessage | undefined;
      let oldestKey: string | undefined;

      // Use forEach which is compatible with all JS versions
      pendingMessagesRef.current.forEach((message, key) => {
        if (message.isPending && message.author === author) {
          if (!oldestMessage || message.time < oldestMessage.time) {
            oldestMessage = message;
            oldestKey = key;
          }
        }
      });
      if (oldestKey) {
        pendingMessagesRef.current.delete(oldestKey);
      }

      return oldestMessage;
    },
    []
  );
  /**
   * Cleanup - remove all pending messages older than 30 seconds
   */
  const cleanupPendingMessages = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const keysToRemove: string[] = [];

    pendingMessagesRef.current.forEach((message, key) => {
      if (now - message.time > 30) {
        // 30 seconds
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach((key) => {
      pendingMessagesRef.current.delete(key);
    });

    return keysToRemove.length;
  }, []);

  /**
   * Reset the deduplication state
   */
  const resetState = useCallback(() => {
    processedMessageIdsRef.current.clear();
    pendingMessagesRef.current.clear();
  }, []);
  return {
    trackProcessedMessage,
    isMessageProcessed,
    trackPendingMessage,
    findPendingMessage,
    cleanupPendingMessages,
    resetState,
  };
}

export default useMessageHandler;
