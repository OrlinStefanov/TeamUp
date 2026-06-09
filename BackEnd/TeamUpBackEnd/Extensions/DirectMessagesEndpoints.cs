using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Helpers;
using TeamUpBackEnd.Models;
using TeamUpBackEnd.Models.Chat;
using static TeamUpBackEnd.DTO.DmDTo;

namespace TeamUpBackEnd.Extensions
{
	public static class DirectMessagesEndpoints
	{
		public static void MapDirectMessages(WebApplication app)
		{
			MapDirectMessagesEndpoints(app);
		}

		public static void MapDirectMessagesEndpoints(WebApplication app)
		{
			var dm = app.MapGroup("/api/direct-messages")
				.RequireAuthorization()
				.WithTags("Direct Messages");

			// ── START / FIND CONVERSATION ─────────────────────────────────────────
			// Idempotent — if a 1:1 conversation between the two users already
			// exists it is returned, otherwise a new one is created.
			// For group DMs pass IsGroup: true and multiple identifiers.

			dm.MapPost("/start", async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				UserManager<ApplicationUser> userManager,
				StartDmDTO dto) =>
			{
				var currentUserId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (currentUserId is null)
					return Results.BadRequest("User not found");

				if (dto.Identifiers is null || dto.Identifiers.Count == 0)
					return Results.BadRequest("At least one identifier is required");

				// resolve every identifier to a real user
				var resolvedUsers = new List<ApplicationUser>();

				foreach (var identifier in dto.Identifiers)
				{
					var resolved = await UserResolver.ResolveAsync(identifier, userManager);

					if (resolved is null)
						return Results.BadRequest($"User '{identifier}' not found");

					if (resolved.Id == currentUserId)
						return Results.BadRequest("You cannot start a conversation with yourself");

					if (resolvedUsers.Any(u => u.Id == resolved.Id))
						continue; // silently skip duplicates

					resolvedUsers.Add(resolved);
				}

				if (resolvedUsers.Count == 0)
					return Results.BadRequest("No valid recipients found");

				var isGroup = dto.IsGroup == true || resolvedUsers.Count > 1;

				// ── for 1:1 DMs check if a conversation already exists ────────────
				if (!isGroup)
				{
					var targetId = resolvedUsers[0].Id;

					var existing = await db.Conversations
						.Include(c => c.Members)
						.Where(c =>
							c.IsGroup != true &&
							c.Members!.Any(m => m.UserId == currentUserId) &&
							c.Members!.Any(m => m.UserId == targetId) &&
							c.Members!.Count() == 2)
						.FirstOrDefaultAsync();

					if (existing is not null)
					{
						return Results.Ok(new
						{
							existing.PublicId,
							existing.Title,
							existing.IsGroup,
							existing.LastMessageAt,
							Members = existing.Members!.Select(m => new
							{
								m.UserId,
								m.User?.UserName,
								m.User?.ProfilePictureUrl
							})
						});
					}
				}

				// ── create new conversation ───────────────────────────────────────
				var conversation = new Conversation
				{
					PublicId = Guid.NewGuid(),
					IsGroup = isGroup,
					Title = isGroup ? dto.Title : null,
					Members = new List<ConversationMember>()
				};

				// add the initiator
				conversation.Members.Add(new ConversationMember
				{
					UserId = currentUserId,
					LastSeen = DateTime.UtcNow
				});

				// add all resolved recipients
				foreach (var u in resolvedUsers)
				{
					conversation.Members.Add(new ConversationMember
					{
						UserId = u.Id,
						LastSeen = DateTime.UtcNow
					});
				}

				db.Conversations.Add(conversation);
				await db.SaveChangesAsync();

				return Results.Ok(new
				{
					conversation.PublicId,
					conversation.Title,
					conversation.IsGroup,
					conversation.LastMessageAt,
					Members = conversation.Members.Select(m => new
					{
						m.UserId,
						m.User?.UserName,
						m.User?.ProfilePictureUrl
					})
				});
			})
			.WithSummary("Start or retrieve a DM conversation. Idempotent for 1:1 — returns existing conversation if one already exists between the two users. Pass IsGroup: true and multiple identifiers for a group DM.");

			// ── LIST CONVERSATIONS ────────────────────────────────────────────────
			// Returns all conversations for the current user sorted by most recent
			// activity, with unread count calculated from LastSeen on the member row.

			dm.MapGet("/conversations", async (
				AppDbContext db,
				ClaimsPrincipal userClaims) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User not found");

				var conversations = await db.Conversations
					.Where(c => c.Members!.Any(m => m.UserId == userId))
					.Include(c => c.Members!)
						.ThenInclude(m => m.User)
					.OrderByDescending(c => c.LastMessageAt)
					.Select(c => new
					{
						c.PublicId,
						c.Title,
						c.IsGroup,
						c.LastMessageAt,

						Members = c.Members!.Select(m => new
						{
							m.UserId,
							m.User!.UserName,
							m.User.ProfilePictureUrl
						}),

						// messages sent after the current user last read this conversation
						UnreadCount = db.Messages
							.Count(msg =>
								msg.ConversationId == c.Id &&
								msg.SenderId != userId &&
								msg.SentAt > c.Members!
									.Where(m => m.UserId == userId)
									.Select(m => m.LastSeen)
									.FirstOrDefault()),

						LastMessage = db.Messages
							.Where(msg => msg.ConversationId == c.Id)
							.OrderByDescending(msg => msg.SentAt)
							.Select(msg => new
							{
								msg.Content,
								msg.SentAt,
								SenderName = msg.Sender!.UserName
							})
							.FirstOrDefault()
					})
					.ToListAsync();

				return Results.Ok(conversations);
			})
			.WithSummary("Returns all DM conversations for the current user, ordered by most recent message. Each entry includes member list, unread count, and a last message preview.");

			// ── MESSAGE HISTORY ───────────────────────────────────────────────────
			// Returns paginated messages for a conversation.
			// Uses cursor-based pagination — pass ?before=<publicId> to page back.
			// Automatically marks the conversation as read for the calling user.

			dm.MapGet("/{conversationPublicId}/messages", async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				string conversationPublicId,
				HttpContext httpContext) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User not found");

				var conversation = await db.Conversations
					.Include(c => c.Members)
					.FirstOrDefaultAsync(c => c.PublicId.ToString() == conversationPublicId);

				if (conversation is null)
					return Results.NotFound("Conversation not found");

				if (!conversation.Members!.Any(m => m.UserId == userId))
					return Results.Forbid();

				// optional cursor — the publicId of the oldest message the client has
				var beforeParam = httpContext.Request.Query["before"].ToString();
				var pageSize = 30;

				IQueryable<Message> query = db.Messages
					.Where(m => m.ConversationId == conversation.Id)
					.Include(m => m.Sender);

				if (!string.IsNullOrEmpty(beforeParam) &&
					Guid.TryParse(beforeParam, out var beforeId))
				{
					var pivot = await db.Messages
						.FirstOrDefaultAsync(m => m.PublicId == beforeId);

					if (pivot is not null)
						query = query.Where(m => m.SentAt < pivot.SentAt);
				}

				var messages = await query
					.OrderByDescending(m => m.SentAt)
					.Take(pageSize)
					.Select(m => new
					{
						m.PublicId,
						m.Content,
						m.SentAt,
						SenderId = m.SenderId,
						Sender = new
						{
							m.Sender!.UserName,
							m.Sender.ProfilePictureUrl
						}
					})
					.ToListAsync();

				// mark as read — update LastSeen for the calling user
				var member = conversation.Members!
					.FirstOrDefault(m => m.UserId == userId);

				if (member is not null)
				{
					member.LastSeen = DateTime.UtcNow;
					await db.SaveChangesAsync();
				}

				return Results.Ok(new
				{
					conversationId = conversationPublicId,
					// return in chronological order for the client
					messages = messages.OrderBy(m => m.SentAt),
					hasMore = messages.Count == pageSize
				});
			})
			.WithSummary("Returns paginated message history for a conversation (30 per page). Pass ?before=<messagePublicId> to load older messages. Automatically marks the conversation as read for the calling user.");

			// ── ADD MEMBER ────────────────────────────────────────────────────────
			// Adds a new participant to an existing conversation by email,
			// username, or phone number. Any existing member can add someone —
			// restrict to group conversations only to avoid turning 1:1 DMs
			// into groups silently.

			dm.MapPost("/{conversationPublicId}/add-member", async (
			AppDbContext db,
			ClaimsPrincipal userClaims,
			UserManager<ApplicationUser> userManager,
			string conversationPublicId,
			AddConversationMemberDto dto) =>
			{
				var currentUserId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (currentUserId is null)
					return Results.BadRequest("User not found");

				if (string.IsNullOrWhiteSpace(dto.UserId))
					return Results.BadRequest("UserId is required");

				var conversation = await db.Conversations
					.Include(c => c.Members)
					.FirstOrDefaultAsync(c => c.PublicId.ToString() == conversationPublicId);

				if (conversation is null)
					return Results.NotFound("Conversation not found");

				// Only existing members can add new members
				if (!conversation.Members!.Any(m => m.UserId == currentUserId))
					return Results.Forbid();

				// Prevent converting a 1:1 DM into a group
				if (conversation.IsGroup != true)
					return Results.BadRequest(
						"Cannot add members to a 1:1 conversation. Start a new group DM instead.");

				var targetUser = await userManager.FindByIdAsync(dto.UserId);

				if (targetUser is null)
					return Results.BadRequest("User not found");

				if (targetUser.Id == currentUserId)
					return Results.BadRequest("You are already in the conversation");

				if (conversation.Members!.Any(m => m.UserId == targetUser.Id))
					return Results.BadRequest("User is already a member of this conversation");

				var member = new ConversationMember
				{
					UserId = targetUser.Id,
					ConversationId = conversation.Id,
					LastSeen = DateTime.UtcNow
				};

				conversation.Members!.Add(member);

				await db.SaveChangesAsync();

				return Results.Ok(new
				{
					message = $"{targetUser.UserName} added to the conversation",
					addedUser = new
					{
						targetUser.Id,
						targetUser.UserName,
						targetUser.Email,
						targetUser.ProfilePictureUrl
					}
				});
			}).WithSummary("Adds a selected user to an existing group DM.");

			//search for users to add to a conversation — excludes existing members
			dm.MapGet("/{conversationPublicId}/search-users", async (
			AppDbContext db,
			ClaimsPrincipal userClaims,
			string conversationPublicId,
			string q) =>
			{
				var currentUserId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (currentUserId is null)
					return Results.BadRequest("User not found");

				if (string.IsNullOrWhiteSpace(q) || q.Length < 3)
					return Results.Ok(Array.Empty<object>());

				var conversation = await db.Conversations
					.Include(c => c.Members)
					.FirstOrDefaultAsync(c => c.PublicId.ToString() == conversationPublicId);

				if (conversation is null)
					return Results.NotFound("Conversation not found");

				// Only members can search for people to add
				if (!conversation.Members!.Any(m => m.UserId == currentUserId))
					return Results.Forbid();

				var existingMemberIds = conversation.Members!
					.Select(m => m.UserId)
					.ToList();

				q = q.Trim().ToLower();

				var users = await db.Users
					.Where(u =>
						!existingMemberIds.Contains(u.Id) &&
						(
							(u.UserName != null && u.UserName.ToLower().Contains(q)) ||
							(u.Email != null && u.Email.ToLower().Contains(q)) ||
							(u.PhoneNumber != null && u.PhoneNumber.Contains(q))
						))
					.OrderBy(u => u.UserName)
					.Take(20)
					.Select(u => new
					{
						u.Id,
						u.UserName,
						u.Email,
						u.PhoneNumber,
						u.ProfilePictureUrl
					})
					.ToListAsync();

				return Results.Ok(users);
			})
			.WithSummary("Search users by username, email, or phone number for adding to a group conversation.");

			// ── LEAVE CONVERSATION ────────────────────────────────────────────────
			// Removes the calling user from a group DM.
			// 1:1 conversations are not deleted — they stay in history.

			dm.MapDelete("/{conversationPublicId}/leave", async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				string conversationPublicId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User not found");

				var conversation = await db.Conversations
					.Include(c => c.Members)
					.FirstOrDefaultAsync(c => c.PublicId.ToString() == conversationPublicId);

				if (conversation is null)
					return Results.NotFound("Conversation not found");

				var member = conversation.Members!
					.FirstOrDefault(m => m.UserId == userId);

				if (member is null)
					return Results.BadRequest("You are not a member of this conversation");

				conversation.Members!.Remove(member);
				await db.SaveChangesAsync();

				return Results.Ok("Left the conversation");
			})
			.WithSummary("Removes the calling user from a conversation. Works on both 1:1 and group DMs — the conversation and its history are preserved for the other participants.");
		}
	}

	public record AddConversationMemberDto()
	{
		public string? UserId { get; set; }
	}
}