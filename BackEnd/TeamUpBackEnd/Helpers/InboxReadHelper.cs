using TeamUpBackEnd.Models.Inbox;

namespace TeamUpBackEnd.Helpers
{
	public static class InboxReadHelper
	{
		public static readonly InboxMessageType[] TaskTypes =
		{
			InboxMessageType.TaskCreated,
			InboxMessageType.TaskUpdated,
			InboxMessageType.TaskDeleted,
			InboxMessageType.TaskStatusChanged,
			InboxMessageType.TaskAssigned,
			InboxMessageType.TaskUnassigned,
		};

		public static readonly InboxMessageType[] MemberTypes =
		{
			InboxMessageType.MemberAdded,
			InboxMessageType.MemberRemoved,
		};

		public static bool IsTaskType(InboxMessageType type) => TaskTypes.Contains(type);

		public static bool IsMemberType(InboxMessageType type) => MemberTypes.Contains(type);
	}
}
