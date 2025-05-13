"use client";

import { ChatMessage } from "@/contexts/chat-context";

/**
 * A memory efficient message cache utility to optimize
 * chat performance with large message history
 */
class MessageCache {
  private static instance: MessageCache;
  private caches: Map<number, Map<number, ChatMessage>>;
  private maxCacheSize = 1000; // Maximum messages in memory per chat

  private constructor() {
    this.caches = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MessageCache {
    if (!MessageCache.instance) {
      MessageCache.instance = new MessageCache();
    }
    return MessageCache.instance;
  }

  /**
   * Add a message to the cache for a specific chat
   */
  public addMessage(chatId: number, message: ChatMessage): void {
    if (!this.caches.has(chatId)) {
      this.caches.set(chatId, new Map());
    }

    const chatCache = this.caches.get(chatId)!;
    chatCache.set(message.id, message);

    // Trim cache if it grows too large
    if (chatCache.size > this.maxCacheSize) {
      this.trimCache(chatId);
    }
  }

  /**
   * Add multiple messages at once
   */
  public addMessages(chatId: number, messages: ChatMessage[]): void {
    for (const message of messages) {
      this.addMessage(chatId, message);
    }
  }

  /**
   * Get a message from the cache
   */
  public getMessage(
    chatId: number,
    messageId: number
  ): ChatMessage | undefined {
    return this.caches.get(chatId)?.get(messageId);
  }

  /**
   * Get all cached messages for a chat
   */
  public getMessages(chatId: number): ChatMessage[] {
    const chatCache = this.caches.get(chatId);
    if (!chatCache) return [];

    return Array.from(chatCache.values()).sort((a, b) => a.time - b.time);
  }

  /**
   * Check if a message exists in the cache
   */
  public hasMessage(chatId: number, messageId: number): boolean {
    return this.caches.get(chatId)?.has(messageId) || false;
  }

  /**
   * Delete a specific message from the cache
   */
  public deleteMessage(chatId: number, messageId: number): boolean {
    return this.caches.get(chatId)?.delete(messageId) || false;
  }

  /**
   * Clear all cached messages for a chat
   */
  public clearChat(chatId: number): void {
    this.caches.delete(chatId);
  }

  /**
   * Clear all cached messages
   */
  public clearAll(): void {
    this.caches.clear();
  }

  /**
   * Get the number of cached messages for a chat
   */
  public size(chatId: number): number {
    return this.caches.get(chatId)?.size || 0;
  }

  /**
   * Trim the cache to reduce memory usage
   * Retains the newest 75% of messages
   */
  private trimCache(chatId: number): void {
    const chatCache = this.caches.get(chatId);
    if (!chatCache) return;

    // Get messages sorted by time
    const messages = Array.from(chatCache.values()).sort(
      (a, b) => a.time - b.time
    );

    // Calculate how many messages to remove (25% of messages)
    const removeCount = Math.floor(messages.length * 0.25);

    // Remove oldest messages
    for (let i = 0; i < removeCount; i++) {
      chatCache.delete(messages[i].id);
    }

    console.log(
      `Trimmed message cache for chat ${chatId}: removed ${removeCount} old messages`
    );
  }
}

export default MessageCache;
