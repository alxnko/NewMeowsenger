"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChatMessage } from "@/contexts/chat-context";

interface UseVirtualizedMessagesOptions {
  batchSize?: number;
  initialCount?: number;
  loadMoreThreshold?: number;
}

/**
 * Custom hook for efficient rendering of chat messages with virtualization and lazy loading
 */
export const useVirtualizedMessages = (
  allMessages: ChatMessage[],
  loadOlderMessages: () => Promise<boolean>,
  options: UseVirtualizedMessagesOptions = {}
) => {
  const { batchSize = 20, initialCount = 30, loadMoreThreshold = 5 } = options;

  // Track if we're loading and if there are more messages
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreAbove, setHasMoreAbove] = useState(true);

  // Virtualization state
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(initialCount);

  // Reference to preserve scroll position
  const scrollPositionRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isLoadingRef = useRef(false);

  // The virtualized messages to render
  const visibleMessages = allMessages.slice(
    visibleStartIndex,
    visibleStartIndex + visibleCount
  );

  // Load more messages when scrolling near the top
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;

      // Check if we're near the top and should load more
      if (
        scrollTop < loadMoreThreshold &&
        hasMoreAbove &&
        !isLoadingRef.current
      ) {
        // Save scroll position before loading
        scrollPositionRef.current = scrollHeight - scrollTop;
        loadMore();
      }

      // Dynamic virtualization - adjust visible window based on scroll position
      const containerHeight = container.clientHeight;
      const totalHeight = container.scrollHeight;
      const scrollRatio = scrollTop / (totalHeight - containerHeight);

      // Calculate new visible start index based on scroll position
      const totalMessages = allMessages.length;
      const newStartIndex = Math.max(
        0,
        Math.min(
          Math.floor(scrollRatio * (totalMessages - visibleCount)),
          totalMessages - visibleCount
        )
      );

      setVisibleStartIndex(newStartIndex);
    },
    [allMessages, hasMoreAbove, loadMoreThreshold, visibleCount]
  );

  // Load more messages (older messages at the top)
  const loadMore = useCallback(async () => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      const hasMore = await loadOlderMessages();
      setHasMoreAbove(hasMore);
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [loadOlderMessages]);

  // Restore scroll position after loading more messages
  useEffect(() => {
    if (containerRef.current && scrollPositionRef.current !== null) {
      const newScrollPosition =
        containerRef.current.scrollHeight - scrollPositionRef.current;
      containerRef.current.scrollTop = newScrollPosition;
      scrollPositionRef.current = null;
    }
  }, [allMessages.length]);

  // Increase visible count when allMessages increases significantly
  useEffect(() => {
    if (allMessages.length > visibleCount * 1.5) {
      setVisibleCount(Math.min(allMessages.length, visibleCount + batchSize));
    }
  }, [allMessages.length, visibleCount, batchSize]);

  return {
    visibleMessages,
    containerRef,
    handleScroll,
    isLoading,
    hasMoreAbove,
    loadMore,
    totalCount: allMessages.length,
    visibleStartIndex,
    visibleCount,
  };
};

export default useVirtualizedMessages;
