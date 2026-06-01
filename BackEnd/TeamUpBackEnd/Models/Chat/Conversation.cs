using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.Models.Chat
{
	public class Conversation
	{
		public int Id { get; set; }
		public Guid PublicId { get; set; } = Guid.NewGuid();
		public string? Title { get; set; }
		public bool? IsGroup { get; set; }

		public int? WorkSpaceId { get; set; }
		public WorkSpace? WorkSpace { get; set; }

		public DateTime? LastMessageAt { get; set; }

		public ICollection<Message>? Messages { get; set; }
		public ICollection<ConversationMember>? Members { get; set; }
	}
}
