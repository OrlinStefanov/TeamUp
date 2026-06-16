using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Extensions;
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

				var resolvedUsers = new List<ApplicationUser>();

				foreach (var identifier in dto.Identifiers)
				{
					var resolved = await UserResolver.ResolveAsync(identifier, userManager);

					if (resolved is null)
						return Results.BadRequest($"User '{identifier}' not found");

					if (resolved.Id == currentUserId)
						return Results.BadRequest("You cannot start a conversation with yourself");

					if (resolvedUsers.Any(u => u.Id == resolved.Id))
						continue;

					resolvedUsers.Add(resolved);
				}

				if (resolvedUsers.Count == 0)
					return Results.BadRequest("No valid recipients found");

				var isGroup = dto.IsGroup == true || resolvedUsers.Count > 1;

				if (!isGroup)
				{
					var targetId = resolvedUsers[0].Id;

					var existing = await db.Conversations
						.Include(c => c.Members!)
							.ThenInclude(m => m.User)
						.Where(c =>
							c.IsGroup != true &&
							c.Members!.Any(m => m.UserId == currentUserId) &&
							c.Members!.Any(m => m.UserId == targetId) &&
							c.Members!.Count() == 2)
						.FirstOrDefaultAsync();

					if (existing is not null)
						return Results.Ok(MapConversation(existing, currentUserId));
				}

				var now = DateTime.UtcNow;
				var conversation = new Conversation
				{
					PublicId = Guid.NewGuid(),
					IsGroup = isGroup,
					Title = isGroup ? dto.Title : null,
					CreatedByUserId = isGroup ? currentUserId : null,
					Members = new List<ConversationMember>()
				};

				conversation.Members.Add(new ConversationMember
				{
					UserId = currentUserId,
					LastSeen = now,
					JoinedAt = now,
					Role = isGroup ? ConversationMemberRole.Owner : ConversationMemberRole.Member
				});

				foreach (var u in resolvedUsers)
				{
					conversation.Members.Add(new ConversationMember
					{
						UserId = u.Id,
						LastSeen = now,
						JoinedAt = now,
						Role = ConversationMemberRole.Member
					});
				}

				db.Conversations.Add(conversation);
				await db.SaveChangesAsync();

				await db.Entry(conversation)
					.Collection(c => c.Members!)
					.Query()
					.Include(m => m.User)
					.LoadAsync();

				return Results.Ok(MapConversation(conversation, currentUserId));
			})
			.WithSummary("Start or retrieve a DM conversation.");

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
					.ToListAsync();

				var result = new List<object>();

				foreach (var c in conversations)
				{
					var actor = c.Members!.FirstOrDefault(m => m.UserId == userId);
					var lastSeen = actor?.LastSeen ?? DateTime.MinValue;

					var lastMessage = await db.Messages
						.Where(msg => msg.ConversationId == c.Id)
						.OrderByDescending(msg => msg.SentAt)
						.Include(msg => msg.Sender)
						.FirstOrDefaultAsync();

					string? senderName = null;
					if (lastMessage?.Sender is not null)
					{
						if (c.IsGroup == true && lastMessage.SenderId is not null)
						{
							var senderMember = c.Members!
								.FirstOrDefault(m => m.UserId == lastMessage.SenderId);
							senderName = senderMember is not null
								? ConversationMemberHelper.GetDisplayName(senderMember)
								: lastMessage.Sender.UserName;
						}
						else
						{
							senderName = lastMessage.Sender.UserName;
						}
					}

					var unreadCount = await db.Messages
						.CountAsync(msg =>
							msg.ConversationId == c.Id &&
							msg.SenderId != userId &&
							msg.SentAt > lastSeen);

					result.Add(new
					{
						c.PublicId,
						c.Title,
						c.IsGroup,
						c.LastMessageAt,
						Members = c.Members!.Select(m => MapMember(m)),
						UnreadCount = unreadCount,
						CurrentUserRole = actor is null ? null : ConversationMemberHelper.RoleToString(actor.Role),
						CanManage = actor is not null && ConversationMemberHelper.CanRename(actor),
						CanChangeRoles = actor is not null && ConversationMemberHelper.CanChangeRole(actor),
						LastMessage = lastMessage is null ? null : new
						{
							lastMessage.Content,
							lastMessage.SentAt,
							SenderName = senderName
						}
					});
				}

				return Results.Ok(result);
			})
			.WithSummary("Returns all DM conversations for the current user.");

			dm.MapGet("/{conversationPublicId}", async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				string conversationPublicId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User not found");

				var conversation = await LoadConversation(db, conversationPublicId);
				if (conversation is null)
					return Results.NotFound("Conversation not found");

				var actor = conversation.Members!.FirstOrDefault(m => m.UserId == userId);
				if (actor is null)
					return Results.Forbid();

				return Results.Ok(MapConversationDetail(conversation, actor));
			})
			.WithSummary("Returns full conversation details including member roles and nicknames.");

			dm.MapPatch("/{conversationPublicId}", async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				IHubContext<DmHub> hub,
				string conversationPublicId,
				UpdateConversationDto dto) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User not found");

				if (string.IsNullOrWhiteSpace(dto.Title))
					return Results.BadRequest("Title is required");

				var conversation = await LoadConversation(db, conversationPublicId);
				if (conversation is null)
					return Results.NotFound("Conversation not found");

				if (conversation.IsGroup != true)
					return Results.BadRequest("Only group conversations can be renamed");

				var actor = conversation.Members!.FirstOrDefault(m => m.UserId == userId);
				if (actor is null)
					return Results.Forbid();

				if (!ConversationMemberHelper.CanRename(actor))
					return Results.Forbid();

				conversation.Title = dto.Title.Trim();
				await db.SaveChangesAsync();

				await DmHubNotifier.NotifyConversationUpdated(hub, conversationPublicId, conversation.Title);

				return Results.Ok(new { conversation.PublicId, conversation.Title });
			})
			.WithSummary("Rename a group conversation (Owner/Admin only).");

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
					.Include(c => c.Members!)
						.ThenInclude(m => m.User)
					.FirstOrDefaultAsync(c => c.PublicId.ToString() == conversationPublicId);

				if (conversation is null)
					return Results.NotFound("Conversation not found");

				if (!conversation.Members!.Any(m => m.UserId == userId))
					return Results.Forbid();

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
					.ToListAsync();

				var memberMap = conversation.Members!
					.ToDictionary(m => m.UserId!, m => m);

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
					messages = messages
						.OrderBy(m => m.SentAt)
						.Select(m => MapMessage(m, conversation.IsGroup == true, memberMap)),
					hasMore = messages.Count == pageSize
				});
			})
			.WithSummary("Returns paginated message history for a conversation.");

			dm.MapPost("/{conversationPublicId}/add-member", async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				UserManager<ApplicationUser> userManager,
				IHubContext<DmHub> hub,
				string conversationPublicId,
				AddConversationMemberDto dto) =>
			{
				var currentUserId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (currentUserId is null)
					return Results.BadRequest("User not found");

				if (string.IsNullOrWhiteSpace(dto.UserId))
					return Results.BadRequest("UserId is required");

				var conversation = await LoadConversation(db, conversationPublicId);
				if (conversation is null)
					return Results.NotFound("Conversation not found");

				if (!conversation.Members!.Any(m => m.UserId == currentUserId))
					return Results.Forbid();

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

				var now = DateTime.UtcNow;
				var member = new ConversationMember
				{
					UserId = targetUser.Id,
					ConversationId = conversation.Id,
					LastSeen = now,
					JoinedAt = now,
					Role = ConversationMemberRole.Member
				};

				conversation.Members!.Add(member);
				await db.SaveChangesAsync();

				member.User = targetUser;

				await DmHubNotifier.NotifyMemberAdded(hub, conversationPublicId, member);

				return Results.Ok(new
				{
					message = $"{targetUser.UserName} added to the conversation",
					addedUser = MapMember(member)
				});
			}).WithSummary("Adds a selected user to an existing group DM.");

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
			.WithSummary("Search users for adding to a group conversation.");

			dm.MapPatch("/{conversationPublicId}/members/me", async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				IHubContext<DmHub> hub,
				string conversationPublicId,
				UpdateNicknameDto dto) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User not found");

				var conversation = await LoadConversation(db, conversationPublicId);
				if (conversation is null)
					return Results.NotFound("Conversation not found");

				if (conversation.IsGroup != true)
					return Results.BadRequest("Nicknames are only available in group conversations");

				var member = conversation.Members!.FirstOrDefault(m => m.UserId == userId);
				if (member is null)
					return Results.Forbid();

				member.Nickname = string.IsNullOrWhiteSpace(dto.Nickname)
					? null
					: dto.Nickname.Trim();

				await db.SaveChangesAsync();
				await DmHubNotifier.NotifyMemberUpdated(hub, conversationPublicId, member);

				return Results.Ok(MapMember(member));
			})
			.WithSummary("Update your nickname in a group conversation.");

			dm.MapPatch("/{conversationPublicId}/members/{targetUserId}/nickname", async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				IHubContext<DmHub> hub,
				string conversationPublicId,
				string targetUserId,
				UpdateNicknameDto dto) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User not found");

				var conversation = await LoadConversation(db, conversationPublicId);
				if (conversation is null)
					return Results.NotFound("Conversation not found");

				if (conversation.IsGroup != true)
					return Results.BadRequest("Nicknames are only available in group conversations");

				var actor = conversation.Members!.FirstOrDefault(m => m.UserId == userId);
				if (actor is null)
					return Results.Forbid();

				var target = conversation.Members!.FirstOrDefault(m => m.UserId == targetUserId);
				if (target is null)
					return Results.NotFound("Member not found");

				if (userId != targetUserId && !ConversationMemberHelper.CanSetNicknameForOther(actor))
					return Results.Forbid();

				target.Nickname = string.IsNullOrWhiteSpace(dto.Nickname)
					? null
					: dto.Nickname.Trim();

				await db.SaveChangesAsync();
				await DmHubNotifier.NotifyMemberUpdated(hub, conversationPublicId, target);

				return Results.Ok(MapMember(target));
			})
			.WithSummary("Set a member's nickname (self or Owner/Admin for others).");

			dm.MapPatch("/{conversationPublicId}/members/{targetUserId}/role", async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				IHubContext<DmHub> hub,
				string conversationPublicId,
				string targetUserId,
				UpdateMemberRoleDto dto) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User not found");

				if (!ConversationMemberHelper.TryParseRole(dto.Role, out var newRole))
					return Results.BadRequest("Invalid role. Use Member, Admin, or Owner.");

				var conversation = await LoadConversation(db, conversationPublicId);
				if (conversation is null)
					return Results.NotFound("Conversation not found");

				if (conversation.IsGroup != true)
					return Results.BadRequest("Roles are only available in group conversations");

				var actor = conversation.Members!.FirstOrDefault(m => m.UserId == userId);
				if (actor is null)
					return Results.Forbid();

				var target = conversation.Members!.FirstOrDefault(m => m.UserId == targetUserId);
				if (target is null)
					return Results.NotFound("Member not found");

				if (!ConversationMemberHelper.CanChangeRole(actor))
					return Results.Forbid();

				if (newRole == ConversationMemberRole.Owner)
				{
					if (targetUserId == userId)
						return Results.BadRequest("You are already the owner");

					actor.Role = ConversationMemberRole.Admin;
					target.Role = ConversationMemberRole.Owner;
					conversation.CreatedByUserId = targetUserId;
				}
				else if (target.Role == ConversationMemberRole.Owner)
				{
					return Results.BadRequest("Transfer ownership by assigning Owner role to another member");
				}
				else
				{
					target.Role = newRole;
				}

				await db.SaveChangesAsync();

				await DmHubNotifier.NotifyMemberUpdated(hub, conversationPublicId, target);
				if (newRole == ConversationMemberRole.Owner)
					await DmHubNotifier.NotifyMemberUpdated(hub, conversationPublicId, actor);

				return Results.Ok(MapMember(target));
			})
			.WithSummary("Change a member's role (Owner only). Assign Owner to transfer ownership.");

			dm.MapDelete("/{conversationPublicId}/members/{targetUserId}", async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				IHubContext<DmHub> hub,
				string conversationPublicId,
				string targetUserId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User not found");

				var conversation = await LoadConversation(db, conversationPublicId);
				if (conversation is null)
					return Results.NotFound("Conversation not found");

				var actor = conversation.Members!.FirstOrDefault(m => m.UserId == userId);
				if (actor is null)
					return Results.Forbid();

				var target = conversation.Members!.FirstOrDefault(m => m.UserId == targetUserId);
				if (target is null)
					return Results.NotFound("Member not found");

				if (userId == targetUserId)
					return await RemoveMemberAsync(db, hub, conversation, target, userId, null);

				if (!ConversationMemberHelper.CanKick(actor, target))
					return Results.Forbid();

				return await RemoveMemberAsync(db, hub, conversation, target, targetUserId, userId);
			})
			.WithSummary("Remove a member from a group (Owner/Admin) or yourself.");

			dm.MapDelete("/{conversationPublicId}/leave", async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				IHubContext<DmHub> hub,
				string conversationPublicId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User not found");

				var conversation = await LoadConversation(db, conversationPublicId);
				if (conversation is null)
					return Results.NotFound("Conversation not found");

				var member = conversation.Members!
					.FirstOrDefault(m => m.UserId == userId);

				if (member is null)
					return Results.BadRequest("You are not a member of this conversation");

				if (conversation.IsGroup == true && member.Role == ConversationMemberRole.Owner)
				{
					ConversationMemberHelper.PromoteNewOwner(conversation.Members!, userId);
					if (conversation.CreatedByUserId == userId)
					{
						var newOwner = conversation.Members!
							.FirstOrDefault(m => m.Role == ConversationMemberRole.Owner);
						conversation.CreatedByUserId = newOwner?.UserId;
					}
				}

				return await RemoveMemberAsync(db, hub, conversation, member, userId, null);
			})
			.WithSummary("Leave a conversation.");
		}

		private static async Task<Conversation?> LoadConversation(AppDbContext db, string conversationPublicId) =>
			await db.Conversations
				.Include(c => c.Members!)
					.ThenInclude(m => m.User)
				.FirstOrDefaultAsync(c => c.PublicId.ToString() == conversationPublicId);

		private static async Task<IResult> RemoveMemberAsync(
			AppDbContext db,
			IHubContext<DmHub> hub,
			Conversation conversation,
			ConversationMember target,
			string removedUserId,
			string? removedByUserId)
		{
			conversation.Members!.Remove(target);
			await db.SaveChangesAsync();

			await DmHubNotifier.NotifyMemberRemoved(
				hub,
				conversation.PublicId.ToString(),
				removedUserId,
				removedByUserId);

			return Results.Ok("Left the conversation");
		}

		private static object MapMember(ConversationMember m) => new
		{
			m.UserId,
			m.User?.UserName,
			m.Nickname,
			Role = ConversationMemberHelper.RoleToString(m.Role),
			DisplayName = ConversationMemberHelper.GetDisplayName(m),
			m.User?.ProfilePictureUrl,
			IsOnline = DmHub.IsUserOnline(m.UserId),
			m.JoinedAt
		};

		private static object MapMessage(
			Message m,
			bool isGroup,
			Dictionary<string, ConversationMember> memberMap)
		{
			var displayName = m.Sender?.UserName;
			if (isGroup && m.SenderId is not null && memberMap.TryGetValue(m.SenderId, out var senderMember))
				displayName = ConversationMemberHelper.GetDisplayName(senderMember);

			return new
			{
				m.PublicId,
				m.Content,
				m.SentAt,
				SenderId = m.SenderId,
				Sender = new
				{
					m.Sender?.UserName,
					DisplayName = displayName,
					m.Sender?.ProfilePictureUrl,
					IsOnline = DmHub.IsUserOnline(m.SenderId)
				}
			};
		}

		private static object MapConversation(Conversation c, string currentUserId)
		{
			var actor = c.Members!.FirstOrDefault(m => m.UserId == currentUserId);
			return new
			{
				c.PublicId,
				c.Title,
				c.IsGroup,
				c.LastMessageAt,
				Members = c.Members!.Select(m => MapMember(m)),
				CurrentUserRole = actor is null ? null : ConversationMemberHelper.RoleToString(actor.Role),
				CanManage = actor is not null && ConversationMemberHelper.CanRename(actor)
			};
		}

		private static object MapConversationDetail(Conversation c, ConversationMember actor) => new
		{
			c.PublicId,
			c.Title,
			c.IsGroup,
			c.LastMessageAt,
			c.CreatedByUserId,
			Members = c.Members!
				.OrderByDescending(m => m.Role)
				.ThenBy(m => m.JoinedAt)
				.Select(m => MapMember(m)),
			CurrentUserRole = ConversationMemberHelper.RoleToString(actor.Role),
			CanManage = ConversationMemberHelper.CanRename(actor),
			CanChangeRoles = ConversationMemberHelper.CanChangeRole(actor)
		};
	}

	public record AddConversationMemberDto()
	{
		public string? UserId { get; set; }
	}
}
