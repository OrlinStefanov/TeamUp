using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Helpers;
using TeamUpBackEnd.Models.Chat;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;

namespace TeamUpBackEnd.Extensions
{
	public class DmHub : Hub
	{
		private readonly AppDbContext _db;
		private static readonly ConcurrentDictionary<string, int> OnlineUsers = new();

		public DmHub(AppDbContext db)
		{
			_db = db;
		}

		public static bool IsUserOnline(string? userId) =>
			!string.IsNullOrWhiteSpace(userId) && OnlineUsers.ContainsKey(userId);

		public override async Task OnConnectedAsync()
		{
			var userId = GetUserId();
			if (userId is not null)
			{
				OnlineUsers.AddOrUpdate(userId, 1, (_, count) => count + 1);
				await Clients.All.SendAsync("DmPresenceChanged", new { userId, isOnline = true });
			}

			await base.OnConnectedAsync();
		}

		public override async Task OnDisconnectedAsync(Exception? exception)
		{
			var userId = GetUserId();
			if (userId is not null && OnlineUsers.AddOrUpdate(userId, 0, (_, count) => Math.Max(0, count - 1)) == 0)
			{
				OnlineUsers.TryRemove(userId, out _);
				await Clients.All.SendAsync("DmPresenceChanged", new { userId, isOnline = false });
			}

			await base.OnDisconnectedAsync(exception);
		}

		public Task<string[]> GetOnlineUserIds() =>
			Task.FromResult(OnlineUsers.Keys.ToArray());

		// ── JOIN ──────────────────────────────────────────────────────────────
		// Client calls this when they open a conversation window.
		// We verify membership before admitting them to the SignalR group.

		public async Task JoinConversation(string conversationPublicId)
		{
			var userId = GetUserId();
			if (userId == null) return;

			var conversation = await _db.Conversations
				.Include(c => c.Members)
				.FirstOrDefaultAsync(c => c.PublicId.ToString() == conversationPublicId);

			if (conversation == null) return;

			var isMember = conversation.Members!
				.Any(m => m.UserId == userId);

			if (!isMember) return;

			await Groups.AddToGroupAsync(Context.ConnectionId, conversationPublicId);
		}

		// ── LEAVE ─────────────────────────────────────────────────────────────

		public async Task LeaveConversation(string conversationPublicId)
		{
			await Groups.RemoveFromGroupAsync(Context.ConnectionId, conversationPublicId);
		}

		// ── SEND MESSAGE ──────────────────────────────────────────────────────
		// Saves the message, updates LastMessageAt on the conversation,
		// broadcasts to all members in the group, and nudges unread counters
		// for everyone else in the conversation.

		public async Task SendDm(string conversationPublicId, string content)
		{
			var userId = GetUserId();
			if (userId == null) return;

			if (string.IsNullOrWhiteSpace(content)) return;

			var conversation = await _db.Conversations
				.Include(c => c.Members)
				.FirstOrDefaultAsync(c => c.PublicId.ToString() == conversationPublicId);

			if (conversation == null) return;

			var isMember = conversation.Members!.Any(m => m.UserId == userId);
			if (!isMember) return;

			var message = new Message
			{
				PublicId = Guid.NewGuid(),
				Content = content,
				ConversationId = conversation.Id,
				SenderId = userId,
				SentAt = DateTime.UtcNow
			};

			_db.Messages.Add(message);

			// keep the inbox sorted by latest activity
			conversation.LastMessageAt = message.SentAt;

			await _db.SaveChangesAsync();

			var sender = await _db.Users
				.Where(u => u.Id == userId)
				.Select(u => new { u.UserName, u.ProfilePictureUrl })
				.FirstOrDefaultAsync();

			string? displayName = sender?.UserName;
			if (conversation.IsGroup == true)
			{
				var senderMember = conversation.Members!
					.FirstOrDefault(m => m.UserId == userId);
				if (senderMember is not null)
					displayName = ConversationMemberHelper.GetDisplayName(senderMember);
			}

			await Clients.Group(conversationPublicId)
				.SendAsync("ReceiveDm", new
				{
					publicId = message.PublicId,
					content = message.Content,
					sentAt = message.SentAt,
					conversationId = conversationPublicId,
					senderId = userId,
					sender = new
					{
						userName = sender!.UserName,
						displayName,
						profilePictureUrl = sender.ProfilePictureUrl
					}
				});

			// tell everyone else to bump their unread counter for this conversation
			await Clients.OthersInGroup(conversationPublicId)
				.SendAsync("IncrementDmUnread", new
				{
					conversationId = conversationPublicId
				});
		}

		// ── TYPING INDICATORS ─────────────────────────────────────────────────

		public async Task Typing(string conversationPublicId)
		{
			var userId = GetUserId();
			if (userId == null) return;

			var conversation = await _db.Conversations
				.Include(c => c.Members!)
					.ThenInclude(m => m.User)
				.FirstOrDefaultAsync(c => c.PublicId.ToString() == conversationPublicId);

			if (conversation is null) return;

			var member = conversation.Members!.FirstOrDefault(m => m.UserId == userId);
			if (member is null) return;

			var displayName = conversation.IsGroup == true
				? ConversationMemberHelper.GetDisplayName(member)
				: Context.User?.Identity?.Name;

			await Clients.OthersInGroup(conversationPublicId)
				.SendAsync("DmUserTyping", new
				{
					conversationId = conversationPublicId,
					userId,
					userName = Context.User?.Identity?.Name,
					displayName
				});
		}

		public async Task StopTyping(string conversationPublicId)
		{
			var userId = GetUserId();
			if (userId == null) return;

			await Clients.OthersInGroup(conversationPublicId)
				.SendAsync("DmUserStopTyping", new
				{
					conversationId = conversationPublicId,
					userId
				});
		}

		// ── MARK AS READ ──────────────────────────────────────────────────────
		// Updates LastSeen on the member row so the unread count
		// can be calculated as: messages sent after LastSeen.

		public async Task MarkAsRead(string conversationPublicId)
		{
			var userId = GetUserId();
			if (userId == null) return;

			var conversation = await _db.Conversations
				.FirstOrDefaultAsync(c => c.PublicId.ToString() == conversationPublicId);

			if (conversation == null) return;

			var member = await _db.ConversationMembers
				.FirstOrDefaultAsync(m =>
					m.ConversationId == conversation.Id &&
					m.UserId == userId);

			if (member != null)
			{
				member.LastSeen = DateTime.UtcNow;
				await _db.SaveChangesAsync();
			}
		}

		// ── HELPER ────────────────────────────────────────────────────────────

		private string? GetUserId() =>
			Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
	}
}
