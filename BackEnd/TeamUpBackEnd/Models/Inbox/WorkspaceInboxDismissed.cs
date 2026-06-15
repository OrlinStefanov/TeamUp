using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.Models.Inbox
{
	public class WorkspaceInboxDismissed
	{
		public int WorkspaceId { get; set; }
		public WorkSpace? WorkSpace { get; set; }

		public string UserId { get; set; } = string.Empty;
		public ApplicationUser? User { get; set; }

		public int MessageId { get; set; }
		public WorkspaceInboxMessage? Message { get; set; }

		public DateTime DismissedAt { get; set; } = DateTime.UtcNow;
	}
}
