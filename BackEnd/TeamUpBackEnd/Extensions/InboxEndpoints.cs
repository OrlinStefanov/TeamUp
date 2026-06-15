using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Extensions;
using TeamUpBackEnd.Helpers;
using TeamUpBackEnd.Models.Inbox;
using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.Extensions
{
	public static class InboxEndpoints
	{
		public static void MapInboxEndpoints(WebApplication app)
		{
			var inbox = app.MapGroup("/api/workspace")
				.RequireAuthorization()
				.WithTags("Inbox");

			inbox.MapGet("/{publicId}/inbox", [Authorize] async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				string publicId,
				HttpContext httpContext) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User not found");

				var workspace = await db.Workspaces
					.Include(w => w.Members)
					.FirstOrDefaultAsync(w => w.PublicId.ToString() == publicId && !w.IsDeleted);

				if (workspace is null)
					return Results.NotFound("Workspace not found");

				if (!workspace.Members.Any(m => m.UserId == userId))
					return Results.Forbid();

				var pageParam = httpContext.Request.Query["page"].ToString();
				var page = int.TryParse(pageParam, out var p) && p > 0 ? p : 1;
				var pageSize = 20;

				var now = DateTime.UtcNow;

				var lastSeenRow = await db.WorkspaceInboxLastSeen
					.FirstOrDefaultAsync(ls => ls.WorkspaceId == workspace.Id && ls.UserId == userId);

				var lastSeen = lastSeenRow?.LastSeen ?? DateTime.MinValue;
				var taskLastSeen = lastSeenRow?.TaskLastSeen ?? DateTime.MinValue;
				var memberLastSeen = lastSeenRow?.MemberLastSeen ?? DateTime.MinValue;

				var visibleMessages = db.WorkspaceInboxMessages
					.Where(m => m.WorkspaceId == workspace.Id && m.ExpiresAt > now)
					.ExcludeDismissed(db, workspace.Id, userId);

				var unreadCount = await visibleMessages
					.Where(m => m.CreatedAt > lastSeen)
					.CountAsync();

				var taskUnreadCount = await visibleMessages
					.Where(m =>
						InboxReadHelper.TaskTypes.Contains(m.Type) &&
						m.CreatedAt > taskLastSeen)
					.CountAsync();

				var memberUnreadCount = await visibleMessages
					.Where(m =>
						InboxReadHelper.MemberTypes.Contains(m.Type) &&
						m.CreatedAt > memberLastSeen)
					.CountAsync();

				var messages = await visibleMessages
					.OrderByDescending(m => m.CreatedAt)
					.Skip((page - 1) * pageSize)
					.Take(pageSize)
					.Select(m => new
					{
						m.PublicId,
						m.Title,
						m.Body,
						Type = m.Type.ToString(),
						m.ChannelPublicId,
						m.CreatedAt,
						IsRead = m.CreatedAt <= lastSeen,
						WorkspacePublicId = workspace.PublicId
					})
					.ToListAsync();

				return Results.Ok(new
				{
					page,
					pageSize,
					unreadCount,
					taskUnreadCount,
					memberUnreadCount,
					messages
				});
			})
			.WithSummary("Returns paginated inbox messages for a workspace with unread count");

			inbox.MapPost("/{publicId}/inbox/mark-read", [Authorize] async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				string publicId) =>
			{
				var workspaceResult = await ResolveWorkspaceAsync(db, userClaims, publicId);
				if (workspaceResult.Error is not null)
					return workspaceResult.Error;

				var resolved = workspaceResult.Value!.Value;
				await UpsertInboxLastSeenAsync(db, resolved.Workspace.Id, resolved.UserId, row =>
				{
					row.LastSeen = DateTime.UtcNow;
				});

				return Results.Ok("Marked as read");
			})
			.WithSummary("Marks all inbox messages as read for the calling user");

			inbox.MapPost("/{publicId}/inbox/mark-tasks-read", [Authorize] async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				string publicId) =>
			{
				var workspaceResult = await ResolveWorkspaceAsync(db, userClaims, publicId);
				if (workspaceResult.Error is not null)
					return workspaceResult.Error;

				var resolved = workspaceResult.Value!.Value;
				await UpsertInboxLastSeenAsync(db, resolved.Workspace.Id, resolved.UserId, row =>
				{
					row.TaskLastSeen = DateTime.UtcNow;
				});

				return Results.Ok("Task inbox marked as read");
			})
			.WithSummary("Marks task-related inbox activity as read for the calling user");

			inbox.MapPost("/{publicId}/inbox/mark-members-read", [Authorize] async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				string publicId) =>
			{
				var workspaceResult = await ResolveWorkspaceAsync(db, userClaims, publicId);
				if (workspaceResult.Error is not null)
					return workspaceResult.Error;

				var resolved = workspaceResult.Value!.Value;
				await UpsertInboxLastSeenAsync(db, resolved.Workspace.Id, resolved.UserId, row =>
				{
					row.MemberLastSeen = DateTime.UtcNow;
				});

				return Results.Ok("Member inbox marked as read");
			})
			.WithSummary("Marks member-related inbox activity as read for the calling user");

			inbox.MapPost("/{publicId}/inbox/discard/{messagePublicId}", [Authorize] async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				string publicId,
				string messagePublicId) =>
			{
				var workspaceResult = await ResolveWorkspaceAsync(db, userClaims, publicId);
				if (workspaceResult.Error is not null)
					return workspaceResult.Error;

				var resolved = workspaceResult.Value!.Value;
				var now = DateTime.UtcNow;

				if (!Guid.TryParse(messagePublicId, out var messageGuid))
					return Results.BadRequest("Invalid message id");

				var message = await db.WorkspaceInboxMessages
					.FirstOrDefaultAsync(m =>
						m.PublicId == messageGuid &&
						m.WorkspaceId == resolved.Workspace.Id &&
						m.ExpiresAt > now);

				if (message is null)
					return Results.NotFound("Message not found");

				var alreadyDismissed = await db.WorkspaceInboxDismissed
					.AnyAsync(d =>
						d.WorkspaceId == resolved.Workspace.Id &&
						d.UserId == resolved.UserId &&
						d.MessageId == message.Id);

				if (!alreadyDismissed)
				{
					db.WorkspaceInboxDismissed.Add(new WorkspaceInboxDismissed
					{
						WorkspaceId = resolved.Workspace.Id,
						UserId = resolved.UserId,
						MessageId = message.Id,
						DismissedAt = now
					});
					await db.SaveChangesAsync();
				}

				return Results.NoContent();
			})
			.WithSummary("Dismiss a single inbox message for the calling user");

			inbox.MapPost("/{publicId}/inbox/discard-all", [Authorize] async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				string publicId) =>
			{
				var workspaceResult = await ResolveWorkspaceAsync(db, userClaims, publicId);
				if (workspaceResult.Error is not null)
					return workspaceResult.Error;

				var resolved = workspaceResult.Value!.Value;
				var now = DateTime.UtcNow;

				var visibleMessageIds = await db.WorkspaceInboxMessages
					.Where(m => m.WorkspaceId == resolved.Workspace.Id && m.ExpiresAt > now)
					.ExcludeDismissed(db, resolved.Workspace.Id, resolved.UserId)
					.Select(m => m.Id)
					.ToListAsync();

				if (visibleMessageIds.Count == 0)
					return Results.Ok(new { dismissedCount = 0 });

				var alreadyDismissedIds = await db.WorkspaceInboxDismissed
					.Where(d =>
						d.WorkspaceId == resolved.Workspace.Id &&
						d.UserId == resolved.UserId &&
						visibleMessageIds.Contains(d.MessageId))
					.Select(d => d.MessageId)
					.ToListAsync();

				var toDismiss = visibleMessageIds.Except(alreadyDismissedIds).ToList();

				foreach (var messageId in toDismiss)
				{
					db.WorkspaceInboxDismissed.Add(new WorkspaceInboxDismissed
					{
						WorkspaceId = resolved.Workspace.Id,
						UserId = resolved.UserId,
						MessageId = messageId,
						DismissedAt = now
					});
				}

				if (toDismiss.Count > 0)
					await db.SaveChangesAsync();

				return Results.Ok(new { dismissedCount = toDismiss.Count });
			})
			.WithSummary("Dismiss all visible inbox messages for the calling user");
		}

		private static async Task<(IResult? Error, (WorkSpace Workspace, string UserId)? Value)> ResolveWorkspaceAsync(
			AppDbContext db,
			ClaimsPrincipal userClaims,
			string publicId)
		{
			var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
			if (userId is null)
				return (Results.BadRequest("User not found"), null);

			var workspace = await db.Workspaces
				.Include(w => w.Members)
				.FirstOrDefaultAsync(w => w.PublicId.ToString() == publicId && !w.IsDeleted);

			if (workspace is null)
				return (Results.NotFound("Workspace not found"), null);

			if (!workspace.Members.Any(m => m.UserId == userId))
				return (Results.Forbid(), null);

			return (null, (workspace, userId));
		}

		private static async Task UpsertInboxLastSeenAsync(
			AppDbContext db,
			int workspaceId,
			string userId,
			Action<WorkspaceInboxLastSeen> update)
		{
			var lastSeen = await db.WorkspaceInboxLastSeen
				.FirstOrDefaultAsync(ls =>
					ls.WorkspaceId == workspaceId &&
					ls.UserId == userId);

			if (lastSeen is null)
			{
				lastSeen = new WorkspaceInboxLastSeen
				{
					WorkspaceId = workspaceId,
					UserId = userId,
				};
				db.WorkspaceInboxLastSeen.Add(lastSeen);
			}

			update(lastSeen);
			await db.SaveChangesAsync();
		}
	}
}
