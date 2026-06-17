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

export const getMessageTypeSvgPath = (type: InboxMessageType): string => {
  const pathMap: Record<InboxMessageType, string> = {
    [InboxMessageType.TaskCreated]:
      'M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z',
    [InboxMessageType.TaskUpdated]:
      'M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814zM1 13.5V7h1.5a.5.5 0 0 0 0-1H1v-.5A1.5 1.5 0 0 1 2.5 5H9a.5.5 0 0 0 0-1H2.5A2.5 2.5 0 0 0 0 5.5v8A2.5 2.5 0 0 0 2.5 16h11a2.5 2.5 0 0 0 2.5-2.5V9a.5.5 0 0 0-1 0v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5z',
    [InboxMessageType.TaskDeleted]:
      'M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0',
    [InboxMessageType.TaskStatusChanged]:
      'M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41m-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5 5 0 0 0 8 3M3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z',
    [InboxMessageType.TaskAssigned]:
      'M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6.854 3.646a.5.5 0 1 0-.708.708L8.293 6.5l-1.147 1.146a.5.5 0 0 0 .708.708L9 7.207l1.146 1.147a.5.5 0 0 0 .708-.708L9.707 6.5l1.147-1.146a.5.5 0 0 0-.708-.708L9 5.793z',
    [InboxMessageType.TaskUnassigned]:
      'M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm2.5 2a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1h3z',
    [InboxMessageType.ChannelActivity]:
      'M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.921-.731 1 1 0 0 1-.595-1.314 9 9 0 0 1-.08-.396.5.5 0 0 1 .82-.312c.33.22.745.533 1.286.901-.418.135-.843.293-1.273.48z',
    [InboxMessageType.MemberAdded]:
      'M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 3a.5.5 0 0 1 .5.5V6h2.5a.5.5 0 0 1 0 1H9v2.5a.5.5 0 0 1-1 0V7H5.5a.5.5 0 0 1 0-1H7V3.5A.5.5 0 0 1 8 3z',
    [InboxMessageType.MemberRemoved]:
      'M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM10 3a.5.5 0 0 1 .5.5H13v2.5a.5.5 0 0 1-1 0V3.5a.5.5 0 0 1 .5-.5z',
  };
  return pathMap[type] ?? 'M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6';
};

export const getMessageTypeIcon = (type: InboxMessageType): string => {
  const iconMap: Record<InboxMessageType, string> = {
    [InboxMessageType.TaskCreated]: 'plus-circle',
    [InboxMessageType.TaskUpdated]: 'pencil-square',
    [InboxMessageType.TaskDeleted]: 'trash',
    [InboxMessageType.TaskStatusChanged]: 'arrow-repeat',
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
