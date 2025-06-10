'use client'

import { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';

const useAutoScroll = (messages, dependencies = []) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - Math.abs(scrollTop)) < 50 || Math.abs(scrollTop) < 50;
      setUserHasScrolled(!isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useLayoutEffect(() => {
    if (!messagesEndRef.current || !messagesContainerRef.current) {
      console.warn('Scroll refs not yet attached, skipping scroll');
      return;
    }

    if (!userHasScrolled) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (error) {
        console.error('Scroll failed:', error);
        messagesContainerRef.current.scrollTop = 0;
      }
    }
  }, [messages, userHasScrolled, ...dependencies]);

  const scrollToBottom = useCallback(() => {
    if (!messagesEndRef.current) {
      console.warn('Cannot scroll: ref not attached');
      return;
    }
    try {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setUserHasScrolled(false);
    } catch (error) {
      console.error('Manual scroll failed:', error);
    }
  }, []);

  return { messagesEndRef, messagesContainerRef, scrollToBottom, userHasScrolled };
};

export default useAutoScroll;
