"use client";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function SnippetModal({ open, onClose, onSave, text, initial }) {
  const [label, setLabel] = useState(initial?.label || "");
  const [note, setNote] = useState(initial?.note || "");

  useEffect(() => {
    if (open) {
      setLabel(initial?.label || "");
      setNote(initial?.note || "");
    }
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg p-4 w-[90%] max-w-sm">
        <h2 className="text-base font-semibold mb-2">Save Snippet</h2>
        <p className="text-sm mb-3 whitespace-pre-wrap max-h-40 overflow-y-auto border p-2 rounded">
          {text}
        </p>
        <input
          className="w-full border rounded px-2 py-1 text-sm mb-2"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
        />
        <textarea
          className="w-full border rounded px-2 py-1 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note or tag"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ label, note })}>Save</Button>
        </div>
      </div>
    </div>
  );
}
