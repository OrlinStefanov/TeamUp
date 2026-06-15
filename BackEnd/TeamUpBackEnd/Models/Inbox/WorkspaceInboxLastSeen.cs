using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.Models.Inbox
{
	public class WorkspaceInboxLastSeen
	{
		public int WorkspaceId { get; set; }
		public WorkSpace? WorkSpace { get; set; }

		public string UserId { get; set; } = string.Empty;
		public ApplicationUser? User { get; set; }

		public DateTime LastSeen { get; set; } = DateTime.UtcNow;

		public DateTime TaskLastSeen { get; set; } = DateTime.MinValue;

		public DateTime MemberLastSeen { get; set; } = DateTime.MinValue;
	}
}