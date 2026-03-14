namespace TeamUpBackEnd.Models.Chat
{
	public class ConversationMember
	{
		public int ConversationId { get; set; }
		public Conversation? Conversation { get; set; }

		public string? UserId { get; set; }
		public ApplicationUser? User { get; set; }
	}
}
