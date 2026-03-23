using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Models.Chat;

namespace TeamUpBackEnd.Extensions
{
	public class ChatHub : Hub
	{
		private readonly AppDbContext _db;

		public ChatHub(AppDbContext db)
		{
			_db = db;
		}

		//joins channel
		public async Task JoinChannel(string channelId)
		{
			var userId = Context.UserIdentifier;

			var channel = await _db.Channels
				   .Include(c => c.Members)
				   .FirstOrDefaultAsync(c => c.PublicId.ToString() == channelId);

			if (channel == null) return;

			if (!channel.IsPrivate)
			{
				await Groups.AddToGroupAsync(Context.ConnectionId, channelId);
				return;
			}

			var isMember = channel.Members!.Any(m => m.UserId == userId);

			if (!isMember) return;

			await Groups.AddToGroupAsync(Context.ConnectionId, channelId);
		}

		//leaves the channel
		public async Task LeaveChannel(string channelId)
		{
			await Groups.RemoveFromGroupAsync(Context.ConnectionId, channelId);
		}

		public async Task SendMessage(string channelPublicId, string content)
		{
			var userId = Context.UserIdentifier;

			var channel = await _db.Channels
				.FirstOrDefaultAsync(c => c.PublicId.ToString() == channelPublicId);

			if (channel is null) return;

			var message = new Message
			{
				PublicId = Guid.NewGuid(),
				Content = content,
				ChannelId = channel.Id,
				SenderId = userId,
				SentAt = DateTime.UtcNow
			};

			await _db.Messages.AddAsync(message);
			await _db.SaveChangesAsync();

			await Clients.Group(channelPublicId)
				.SendAsync("ReceiveMessage", new
				{
					id = message.PublicId,
					content = message.Content,
					senderId = userId,
					sentAt = message.SentAt
				});
		}
	}
}
