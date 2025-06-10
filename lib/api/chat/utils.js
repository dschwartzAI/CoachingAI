export function generateThreadTitle(message) {
  if (!message || !message.content) return 'New conversation';
  const maxLength = 30;
  let title = message.content.trim().replace(/\s+/g, ' ');
  if (title.length > maxLength) {
    title = title.substr(0, maxLength).split(' ').slice(0, -1).join(' ') + '...';
  }
  return title || 'New conversation';
}
