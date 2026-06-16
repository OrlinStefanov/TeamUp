namespace TeamUpBackEnd.Models.Chat
{
	public class ConversationMember
	{
		public int ConversationId { get; set; }
		public Conversation? Conversation { get; set; }

		public string? UserId { get; set; }
		public ApplicationUser? User { get; set; }

		public string? Nickname { get; set; }
		public ConversationMemberRole Role { get; set; } = ConversationMemberRole.Member;
		public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
		public DateTime LastSeen { get; set; } = DateTime.UtcNow;
	}
}
