export enum InboxMessageType {
  TaskCreated = 'TaskCreated',
  TaskUpdated = 'TaskUpdated',
  TaskDeleted = 'TaskDeleted',
  TaskStatusChanged = 'TaskStatusChanged',
  TaskAssigned = 'TaskAssigned',
  TaskUnassigned = 'TaskUnassigned',
  ChannelActivity = 'ChannelActivity',
  MemberAdded = 'MemberAdded',
  MemberRemoved = 'MemberRemoved',
}

export interface InboxMessage {
  publicId: string;
  title: string;
  body: string;
  type: InboxMessageType;
  channelPublicId: string | null;
  createdAt: string; // ISO date string
  isRead: boolean;
}

export interface InboxResponse {
  page: number;
  pageSize: number;
  unreadCount: number;
  taskUnreadCount: number;
  memberUnreadCount: number;
  messages: InboxMessage[];
}

export interface InboxState {
  messages: InboxMessage[];
  unreadCount: number;
  taskUnreadCount: number;
  memberUnreadCount: number;
  currentPage: number;
  isLoading: boolean;
  error: string | null;
  hasMorePages: boolean;
}

export const getMessageTypeIcon = (type: InboxMessageType): string => {
  const iconMap: Record<InboxMessageType, string> = {
    [InboxMessageType.TaskCreated]: 'plus-circle',
    [InboxMessageType.TaskUpdated]: 'pencil-square',
    [InboxMessageType.TaskDeleted]: 'trash',
    [InboxMessageType.TaskStatusChanged]: 'check-circle',
    [InboxMessageType.TaskAssigned]: 'person-check',
    [InboxMessageType.TaskUnassigned]: 'person-x',
    [InboxMessageType.ChannelActivity]: 'chat-dots',
    [InboxMessageType.MemberAdded]: 'person-plus',
    [InboxMessageType.MemberRemoved]: 'person-dash',
  };
  return iconMap[type] || 'bell';
};

export const TASK_INBOX_TYPES: InboxMessageType[] = [
  InboxMessageType.TaskCreated,
  InboxMessageType.TaskUpdated,
  InboxMessageType.TaskDeleted,
  InboxMessageType.TaskStatusChanged,
  InboxMessageType.TaskAssigned,
  InboxMessageType.TaskUnassigned,
];

export const MEMBER_INBOX_TYPES: InboxMessageType[] = [
  InboxMessageType.MemberAdded,
  InboxMessageType.MemberRemoved,
];

export function countUnreadByTypes(
  messages: InboxMessage[],
  types: InboxMessageType[]
): number {
  return messages.filter((m) => !m.isRead && types.includes(m.type)).length;
}

export const getMessageTypeColor = (type: InboxMessageType): string => {
  const colorMap: Record<InboxMessageType, string> = {
    [InboxMessageType.TaskCreated]: 'primary',
    [InboxMessageType.TaskUpdated]: 'info',
    [InboxMessageType.TaskDeleted]: 'danger',
    [InboxMessageType.TaskStatusChanged]: 'success',
    [InboxMessageType.TaskAssigned]: 'success',
    [InboxMessageType.TaskUnassigned]: 'warning',
    [InboxMessageType.ChannelActivity]: 'secondary',
    [InboxMessageType.MemberAdded]: 'success',
    [InboxMessageType.MemberRemoved]: 'danger',
  };
  return colorMap[type] || 'secondary';
};
