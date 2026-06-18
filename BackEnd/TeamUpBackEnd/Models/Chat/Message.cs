namespace TeamUpBackEnd.Models.Chat
{
	public class Message
	{
		public int Id { get; set; }
		public Guid PublicId { get; set;}

		public string? Content { get; set; }

		public DateTime SentAt { get; set; } = DateTime.UtcNow;

		public int? ConversationId { get; set; }
		public Conversation? Conversation { get; set; }

		public string? SenderId { get; set; }
		public ApplicationUser? Sender { get; set; }

		public int? ChannelId { get; set; }
		public Channel? Channel { get; set; }

		public ICollection<MessageLike> Likes { get; set; } = new List<MessageLike>();
	}
}
