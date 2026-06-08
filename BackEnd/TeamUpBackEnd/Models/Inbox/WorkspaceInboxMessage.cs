using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.Models.Inbox
{
	public class WorkspaceInboxMessage
	{
		public int Id { get; set; }
		public Guid PublicId { get; set; } = Guid.NewGuid();

		public int WorkspaceId { get; set; }
		public WorkSpace? WorkSpace { get; set; }

		public InboxMessageType Type { get; set; }
		public string Title { get; set; } = string.Empty;
		public string Body { get; set; } = string.Empty;

		public string? ChannelPublicId { get; set; } // only for ChannelActivity

		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
		public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(30);
	}

	public enum InboxMessageType
	{
		TaskCreated,
		TaskUpdated,
		TaskDeleted,
		TaskStatusChanged,
		TaskAssigned,
		TaskUnassigned,
		ChannelActivity,
		MemberAdded,
		MemberRemoved
	}
}
