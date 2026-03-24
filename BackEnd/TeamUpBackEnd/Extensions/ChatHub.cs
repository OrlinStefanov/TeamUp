using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
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
			var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

			if (string.IsNullOrEmpty(userId))
			{
				return;
			}

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

			var sender = await _db.Users
				.Where(u => u.Id == userId)
				.Select(u => new
				{
					u.UserName,
					u.ProfilePictureUrl
				})
				.FirstOrDefaultAsync();

			await Clients.Group(channelPublicId)
				.SendAsync("ReceiveMessage", new
				{
					publicId = message.PublicId,
					content = message.Content,
					sentAt = message.SentAt,
					sender = new
					{
						userName = sender!.UserName,
						profilePictureUrl = sender.ProfilePictureUrl
					}
				});
		}
	}
}
