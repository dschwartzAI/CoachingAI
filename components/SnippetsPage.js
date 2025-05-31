"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Edit, 
  Trash2, 
  Filter, 
  Calendar,
  MessageSquare,
  FileText,
  Bookmark,
  Tag,
  StickyNote
} from 'lucide-react';
import { format } from 'date-fns';
import SnippetModal from './SnippetModal';
import { useAuth } from './AuthProvider';
import { getUserSnippets, deleteSnippet, updateSnippet, saveSnippet, getUserSnippetTags } from '@/lib/utils/snippets';

export default function SnippetsPage() {
  const { user } = useAuth();
  const [snippets, setSnippets] = useState([]);
  const [filteredSnippets, setFilteredSnippets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSnippet, setEditingSnippet] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load snippets and tags
  useEffect(() => {
    if (user?.id) {
      loadSnippets();
      loadTags();
    }
  }, [user?.id]);

  // Filter snippets based on search and tag
  useEffect(() => {
    let filtered = snippets;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(snippet =>
        snippet.title.toLowerCase().includes(term) ||
        snippet.content.toLowerCase().includes(term) ||
        snippet.note?.toLowerCase().includes(term)
      );
    }

    if (selectedTag) {
      filtered = filtered.filter(snippet => snippet.tag === selectedTag);
    }

    setFilteredSnippets(filtered);
  }, [snippets, searchTerm, selectedTag]);

  const loadSnippets = async () => {
    try {
      setIsLoading(true);
      const userSnippets = await getUserSnippets(user.id);
      setSnippets(userSnippets);
    } catch (error) {
      console.error('Failed to load snippets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const tags = await getUserSnippetTags(user.id);
      setAvailableTags(tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleEditSnippet = (snippet) => {
    setEditingSnippet(snippet);
    setIsModalOpen(true);
  };

  const handleDeleteSnippet = async (snippetId) => {
    if (window.confirm('Are you sure you want to delete this snippet?')) {
      try {
        await deleteSnippet(snippetId, user.id);
        setSnippets(prev => prev.filter(s => s.id !== snippetId));
        // Reload tags in case this was the last snippet with a particular tag
        loadTags();
      } catch (error) {
        console.error('Failed to delete snippet:', error);
      }
    }
  };

  const handleSaveSnippet = async (snippetData) => {
    try {
      if (editingSnippet) {
        // Update existing snippet
        const updated = await updateSnippet(editingSnippet.id, snippetData, user.id);
        setSnippets(prev => prev.map(s => s.id === editingSnippet.id ? updated : s));
      } else {
        // Create new snippet
        const newSnippet = await saveSnippet(snippetData, user.id);
        setSnippets(prev => [newSnippet, ...prev]);
      }
      
      // Reload tags in case new tags were added
      loadTags();
      setEditingSnippet(null);
    } catch (error) {
      console.error('Failed to save snippet:', error);
      throw error;
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSnippet(null);
  };

  const getSourceIcon = (sourceType) => {
    switch (sourceType) {
      case 'conversation':
        return <MessageSquare className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      default:
        return <Bookmark className="h-4 w-4" />;
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTag('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your snippets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Snippets</h1>
          <p className="text-muted-foreground">
            Saved highlights and important content from your conversations
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {snippets.length} {snippets.length === 1 ? 'snippet' : 'snippets'}
        </Badge>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search snippets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background text-sm"
          >
            <option value="">All tags</option>
            {availableTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          
          {(searchTerm || selectedTag) && (
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Snippets List */}
      <ScrollArea className="flex-1">
        {filteredSnippets.length === 0 ? (
          <div className="text-center py-12">
            <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {snippets.length === 0 ? 'No snippets yet' : 'No snippets found'}
            </h3>
            <p className="text-muted-foreground">
              {snippets.length === 0 
                ? 'Start highlighting text in conversations to save your first snippet'
                : 'Try adjusting your search terms or filters'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSnippets.map(snippet => (
              <Card key={snippet.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{snippet.title}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {getSourceIcon(snippet.source_type)}
                          <span className="capitalize">{snippet.source_type}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(snippet.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSnippet(snippet)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSnippet(snippet.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="mb-3 p-3 bg-muted rounded-md text-sm">
                    {snippet.content}
                  </div>
                  
                  {snippet.note && (
                    <div className="mb-3 flex items-start gap-2 text-sm text-muted-foreground">
                      <StickyNote className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{snippet.note}</span>
                    </div>
                  )}
                  
                  {snippet.tag && (
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-xs">
                        {snippet.tag}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Edit Modal */}
      <SnippetModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveSnippet}
        existingSnippet={editingSnippet}
        selectedText={editingSnippet?.content}
      />
    </div>
  );
} 