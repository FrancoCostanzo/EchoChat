import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { ChatMessage } from '@/stores/chatStore';

interface UseChatScrollOptions {
  conversationId: string | undefined;
  messages: ChatMessage[];
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  loadMoreMessages: () => unknown;
}

/**
 * Scroll del timeline: salto al fondo al abrir, anclaje mientras cargan los
 * medios, carga de mensajes viejos conservando la posición y botón "ir al final".
 */
export default function useChatScroll({
  conversationId,
  messages,
  loadingMessages,
  hasMoreMessages,
  loadMoreMessages,
}: UseChatScrollOptions) {
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number | null>(null);
  const loadingMoreRef = useRef(false);
  const wasAtBottomRef = useRef(true);
  const initialLoadRef = useRef(false); // true after first batch of messages is rendered
  const anchorBottomRef = useRef(false); // keep pinned while media loads on open
  const anchorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevScrollTopRef = useRef(0);
  const prevContentHeightRef = useRef(0);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollContainerToBottom = useCallback((smooth = false) => {
    const el = containerRef.current;
    if (!el) return;
    const top = el.scrollHeight;
    if (smooth) {
      el.scrollTo({ top, behavior: 'smooth' });
    } else {
      el.scrollTop = top;
    }
  }, []);

  const startBottomAnchor = useCallback(() => {
    anchorBottomRef.current = true;
    if (anchorTimerRef.current) clearTimeout(anchorTimerRef.current);
    anchorTimerRef.current = setTimeout(() => {
      anchorBottomRef.current = false;
    }, 8000);
  }, []);

  // Reset al cambiar de conversación (antes que los efectos de scroll de abajo).
  useLayoutEffect(() => {
    if (!conversationId) return;
    initialLoadRef.current = false;
    prevScrollHeightRef.current = null;
    loadingMoreRef.current = false;
    wasAtBottomRef.current = true;
    anchorBottomRef.current = false;
    prevScrollTopRef.current = 0;
    prevContentHeightRef.current = 0;
    if (anchorTimerRef.current) clearTimeout(anchorTimerRef.current);
    setShowScrollBtn(false);
  }, [conversationId]);

  // Scroll to bottom on initial load / own new message, but not when loading
  // older messages. `conversationId` is a dependency on purpose: the messages
  // region remounts per conversation (keyed container), so the effect must
  // re-fire even when the cached `messages` array is already in place —
  // otherwise the fresh container would stay stuck at the top.
  useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null) return; // handled by the load-more layout effect
    if (loadingMoreRef.current) return;
    if (!containerRef.current || messages.length === 0) return;

    if (!initialLoadRef.current) {
      // First batch: jump instantly before paint so user never sees the top
      scrollContainerToBottom(false);
      wasAtBottomRef.current = true;
      initialLoadRef.current = true;
      startBottomAnchor();
      setShowScrollBtn(false);
      requestAnimationFrame(() => scrollContainerToBottom(false));
    } else if (wasAtBottomRef.current) {
      scrollContainerToBottom(true);
    }
  }, [messages, conversationId, scrollContainerToBottom, startBottomAnchor]);

  // Catch late layout shifts while still on initial open
  useLayoutEffect(() => {
    if (initialLoadRef.current || loadingMessages || messages.length === 0) return;
    scrollContainerToBottom(false);
    wasAtBottomRef.current = true;
    initialLoadRef.current = true;
    startBottomAnchor();
    setShowScrollBtn(false);
  }, [loadingMessages, messages.length, scrollContainerToBottom, startBottomAnchor]);

  // Re-scroll only when content grows (images/videos loading), not on user scroll
  useEffect(() => {
    const content = messagesContentRef.current;
    if (!content) return;
    prevContentHeightRef.current = content.getBoundingClientRect().height;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      const grew = h > prevContentHeightRef.current + 2;
      prevContentHeightRef.current = h;
      if (grew && (anchorBottomRef.current || wasAtBottomRef.current)) {
        scrollContainerToBottom(false);
      }
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [conversationId, scrollContainerToBottom]);

  // Restore scroll position after prepending older messages
  useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null) {
      const el = containerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
      }
      prevScrollHeightRef.current = null;
      loadingMoreRef.current = false;
    }
  }, [messages]);

  // Pide mensajes viejos recordando la altura actual para restaurar la posición.
  const loadOlder = useCallback(() => {
    loadingMoreRef.current = true;
    prevScrollHeightRef.current = containerRef.current?.scrollHeight ?? null;
    loadMoreMessages();
  }, [loadMoreMessages]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    if (scrollTop < prevScrollTopRef.current - 2) {
      // User scrolled up — stop auto-pinning to bottom
      anchorBottomRef.current = false;
      if (anchorTimerRef.current) clearTimeout(anchorTimerRef.current);
    }
    prevScrollTopRef.current = scrollTop;

    const distanceFromBottom = el.scrollHeight - scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 100;
    wasAtBottomRef.current = atBottom;
    if (atBottom) {
      setShowScrollBtn(false);
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    } else {
      setShowScrollBtn(true);
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = setTimeout(() => setShowScrollBtn(false), 2000);
    }
    // Don't auto-load older messages until the initial scroll-to-bottom completed
    if (!initialLoadRef.current) return;
    if (el.scrollTop < 80 && hasMoreMessages && !loadingMoreRef.current) {
      loadOlder();
    }
  }, [hasMoreMessages, loadOlder]);

  const scrollToBottom = useCallback(() => {
    scrollContainerToBottom(true);
  }, [scrollContainerToBottom]);

  return {
    containerRef,
    messagesContentRef,
    messagesEndRef,
    showScrollBtn,
    handleScroll,
    scrollToBottom,
    loadOlder,
  };
}
