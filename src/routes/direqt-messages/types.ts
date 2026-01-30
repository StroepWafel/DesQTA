export interface MessageFile {
  filename: string;
  size: string;
  context_uuid?: string;
  mimetype: string;
  id: number;
  created_date?: string;
  uuid: string;
  created_by?: string;
}

export interface Message {
  id: number;
  folder: string;
  sender: string;
  senderPhoto: string;
  to: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  unread: boolean;
  starred?: boolean;
  files?: MessageFile[];
  attachments?: boolean;
}
