namespace TeamUpBackEnd.Models.Chat
{
	public class ChannelMember
	{
		public int ChannelId { get; set; }
		public Channel? Channel { get; set; }

		public string? UserId { get; set; }
		public ApplicationUser? User { get; set; }
	}
}
