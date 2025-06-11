import { createWorkshopContext } from "./workshop-context";

const _contextStore = new Map();

export function getOrCreateContext(conversationId) {
  if (!_contextStore.has(conversationId)) {
    _contextStore.set(conversationId, createWorkshopContext());
  }
  return _contextStore.get(conversationId);
}

export function saveContext(conversationId, context) {
  _contextStore.set(conversationId, context);
} 