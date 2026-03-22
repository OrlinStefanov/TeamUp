namespace TeamUpBackEnd.DTO
{
	public class ChatsDTO
	{
		public record CreateChatDTO
		{
			public string? Name { get; set; }
			public string? Description { get; set; }
			public bool IsPrivate { get; set; }
		}
	}
}
