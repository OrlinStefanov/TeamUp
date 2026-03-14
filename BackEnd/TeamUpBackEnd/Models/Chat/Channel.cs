using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.Models.Chat
{
	public class Channel
	{
		public int Id { get; set; }

		public Guid PublicId { get; set; } = Guid.NewGuid();

		public string? Name { get; set; }

		public string? Description { get; set; }

		public bool IsPrivate { get; set; }

		public int WorkspaceId { get; set; }
		public WorkSpace? Workspace { get; set; }

		public ICollection<Message>? Messages { get; set; }

		public ICollection<ChannelMember>? Members { get; set; }
	}
}
