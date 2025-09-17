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
}
