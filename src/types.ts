
export type MessageStatus = 'queued' | 'sending' | 'delivered' | 'read' | 'failed' | 'pending';
export type MessageChannel = 'sms' | 'whatsapp';

export interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  avatar?: string;
  tags?: string[];
}

export interface Message {
  id: string;
  contactId: string;
  contactName: string;
  phoneNumber: string;
  content: string;
  media?: string[];
  status: MessageStatus;
  channel: MessageChannel;
  timestamp: Date;
  intentUrl?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'completed' | 'paused';
  totalMessages: number;
  sent: number;
  delivered: number;
  failed: number;
  createdAt: Date;
}
