"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Search,
  Edit2,
  Trash2,
  Copy,
  Tag,
  MessageSquare,
  FileText,
  Calendar,
  Filter,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import SnippetModal from './SnippetModal';
import { useAuth } from './AuthProvider';
import { getUserSnippets, deleteSnippet, updateSnippet, saveSnippet, getUserSnippetTags } from '@/lib/utils/snippets';
import { useToast } from '@/hooks/use-toast';

export default function SnippetsModal({ isOpen, onClose }) {
  const [snippets, setSnippets] = useState([]);
  const [filteredSnippets, setFilteredSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load snippets and tags when modal opens
  useEffect(() => {
    if (isOpen && user?.id) {
      loadSnippets();
      loadTags();
    }
  }, [isOpen, user?.id]);

  // Filter snippets when search term or tag changes
  useEffect(() => {
    filterSnippets();
  }, [snippets, searchTerm, selectedTag]);

  const loadSnippets = async () => {
    try {
      setLoading(true);
      const result = await getUserSnippets(user.id);
      setSnippets(result || []);
    } catch (error) {
      console.error('Failed to load snippets:', error);
      toast({ 
        title: "Error Loading Snippets", 
        description: error.message || "Could not load your snippets.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const tags = await getUserSnippetTags(user.id);
      setAvailableTags(tags || []);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const filterSnippets = () => {
    let filtered = snippets;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(snippet => 
        snippet.title.toLowerCase().includes(term) ||
        snippet.content.toLowerCase().includes(term) ||
        (snippet.note && snippet.note.toLowerCase().includes(term)) ||
        (snippet.tag && snippet.tag.toLowerCase().includes(term))
      );
    }

    if (selectedTag) {
      filtered = filtered.filter(snippet => snippet.tag === selectedTag);
    }

    setFilteredSnippets(filtered);
  };

  const handleEdit = (snippet) => {
    setEditingSnippet(snippet);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (snippetData) => {
    try {
      await updateSnippet(editingSnippet.id, snippetData);
      toast({ 
        title: "Snippet Updated", 
        description: "Your snippet has been updated successfully." 
      });
      setIsEditModalOpen(false);
      setEditingSnippet(null);
      loadSnippets(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to update snippet:', error);
      toast({ 
        title: "Error Updating Snippet", 
        description: error.message || "Could not update your snippet.", 
        variant: "destructive" 
      });
    }
  };

  const handleDelete = async (snippetId) => {
    if (confirm('Are you sure you want to delete this snippet?')) {
      try {
        await deleteSnippet(snippetId);
        toast({ 
          title: "Snippet Deleted", 
          description: "Your snippet has been deleted successfully." 
        });
        loadSnippets(); // Reload to refresh the list
      } catch (error) {
        console.error('Failed to delete snippet:', error);
        toast({ 
          title: "Error Deleting Snippet", 
          description: error.message || "Could not delete your snippet.", 
          variant: "destructive" 
        });
      }
    }
  };

  const handleCopy = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({ 
        title: "Copied to Clipboard", 
        description: "Snippet content has been copied." 
      });
    } catch (error) {
      console.error('Failed to copy snippet:', error);
      toast({ 
        title: "Copy Failed", 
        description: "Could not copy snippet to clipboard.", 
        variant: "destructive" 
      });
    }
  };

  const getSourceIcon = (sourceType) => {
    switch (sourceType) {
      case 'conversation': return <MessageSquare className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTag('');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              My Snippets
              {filteredSnippets.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  ({filteredSnippets.length} {filteredSnippets.length === 1 ? 'snippet' : 'snippets'})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 py-4 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search snippets by title, content, note, or tag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-background"
              >
                <option value="">All Tags</option>
                {availableTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              
              {(searchTerm || selectedTag) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="px-3"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Snippets List */}
          <ScrollArea className="flex-1 pr-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-sm text-muted-foreground">Loading snippets...</p>
                </div>
              </div>
            ) : filteredSnippets.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center max-w-md">
                  <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {snippets.length === 0 ? 'No Snippets Yet' : 'No Matching Snippets'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {snippets.length === 0 
                      ? 'Start by highlighting text in conversations to create your first snippet.'
                      : 'Try adjusting your search terms or filters to find what you\'re looking for.'
                    }
                  </p>
                  {(searchTerm || selectedTag) && (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {filteredSnippets.map((snippet) => (
                  <div key={snippet.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg truncate">{snippet.title}</h3>
                          {snippet.tag && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                              {snippet.tag}
                            </span>
                          )}
                        </div>
                        
                        <div className="bg-muted rounded-md p-3 mb-3">
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {snippet.content.length > 200 
                              ? `${snippet.content.substring(0, 200)}...` 
                              : snippet.content
                            }
                          </p>
                        </div>
                        
                        {snippet.note && (
                          <div className="mb-3">
                            <p className="text-sm text-muted-foreground">
                              <strong>Note:</strong> {snippet.note}
                            </p>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {getSourceIcon(snippet.sourceType)}
                            <span className="capitalize">{snippet.sourceType}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {(() => {
                                const rawDate = snippet.createdAt || snippet.created_at || snippet.createdAt?.toString() || snippet.created_at?.toString();
                                if (!rawDate) return 'Unknown';
                                const parsed = new Date(rawDate);
                                if (isNaN(parsed.getTime())) return 'Unknown';
                                return format(parsed, 'MMM d, yyyy');
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(snippet.content)}
                          className="h-8 w-8 p-0"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(snippet)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(snippet.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Snippet Modal */}
      {isEditModalOpen && (
        <SnippetModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingSnippet(null);
          }}
          onSave={handleSaveEdit}
          selectedText={null} // No selected text for editing
          existingSnippet={editingSnippet}
          sourceContext={null}
        />
      )}
    </>
  );
} 