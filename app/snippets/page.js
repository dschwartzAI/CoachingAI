"use client";
import useSnippets from '@/hooks/use-snippets';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SnippetModal from '@/components/SnippetModal';

export default function SnippetsPage() {
  const { snippets, deleteSnippet, updateSnippet } = useSnippets();
  const [editing, setEditing] = useState(null);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Snippets</h1>
      {snippets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No snippets saved.</p>
      ) : (
        <div className="space-y-4">
          {snippets.map((snip) => (
            <Card key={snip.id}>
              <CardHeader className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm">{snip.label || 'Untitled'}</CardTitle>
                  <p className="text-xs text-muted-foreground">{new Date(snip.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(snip)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteSnippet(snip.id)}>Delete</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm whitespace-pre-wrap">{snip.text}</p>
                {snip.note && <p className="text-xs text-muted-foreground">{snip.note}</p>}
                {snip.context && <p className="text-xs text-muted-foreground">From: {snip.context}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <SnippetModal
          open={true}
          text={editing.text}
          initial={{ label: editing.label, note: editing.note }}
          onClose={() => setEditing(null)}
          onSave={({ label, note }) => {
            updateSnippet(editing.id, { label, note });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
