export interface Thread {
  id: string;
  title: string;
  user_id: string;
  tool_id?: string;
  metadata?: string;
  has_custom_title: boolean;
  created_at: string;
  updated_at: string;
} 