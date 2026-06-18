namespace TeamUpBackEnd.Models.Chat
{
	public class MessageLike
	{
		public int Id { get; set; }
		public int MessageId { get; set; }
		public Message? Message { get; set; }
		public string? UserId { get; set; }
		public ApplicationUser? User { get; set; }
		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
	}
}
