"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function useSnippets() {
  const { user } = useAuth();
  const [snippets, setSnippets] = useState([]);

  // load from localStorage
  useEffect(() => {
    if (!user?.id) return;
    try {
      const saved = localStorage.getItem(`snippets_${user.id}`);
      if (saved) setSnippets(JSON.parse(saved));
    } catch (e) {}
  }, [user?.id]);

  // persist to localStorage
  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(`snippets_${user.id}`, JSON.stringify(snippets));
  }, [snippets, user?.id]);

  const addSnippet = (snippet) => {
    setSnippets((prev) => [snippet, ...prev]);
  };

  const updateSnippet = (id, updates) => {
    setSnippets((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deleteSnippet = (id) => {
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  };

  return { snippets, addSnippet, updateSnippet, deleteSnippet };
}
