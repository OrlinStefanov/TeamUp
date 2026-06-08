using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Extensions;
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

			// ── GET INBOX ─────────────────────────────────────────────────────────
			// Returns paginated inbox messages for a workspace.
			// Also returns unreadCount based on the calling user's LastSeen.

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

				// parse page from query string, default 1
				var pageParam = httpContext.Request.Query["page"].ToString();
				var page = int.TryParse(pageParam, out var p) && p > 0 ? p : 1;
				var pageSize = 20;

				var now = DateTime.UtcNow;

				// get the calling user's LastSeen for this workspace
				var lastSeen = await db.WorkspaceInboxLastSeen
					.Where(ls => ls.WorkspaceId == workspace.Id && ls.UserId == userId)
					.Select(ls => ls.LastSeen)
					.FirstOrDefaultAsync();

				// total unread count — messages after LastSeen that haven't expired
				var unreadCount = await db.WorkspaceInboxMessages
					.Where(m =>
						m.WorkspaceId == workspace.Id &&
						m.ExpiresAt > now &&
						m.CreatedAt > lastSeen)
					.CountAsync();

				var messages = await db.WorkspaceInboxMessages
					.Where(m => m.WorkspaceId == workspace.Id && m.ExpiresAt > now)
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
					messages
				});
			})
			.WithSummary("Returns paginated inbox messages for a workspace with unread count");

			// ── MARK AS READ ──────────────────────────────────────────────────────
			// Upserts the LastSeen timestamp for the calling user in this workspace.

			inbox.MapPost("/{publicId}/inbox/mark-read", [Authorize] async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				string publicId) =>
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

				var lastSeen = await db.WorkspaceInboxLastSeen
					.FirstOrDefaultAsync(ls =>
						ls.WorkspaceId == workspace.Id &&
						ls.UserId == userId);

				if (lastSeen is null)
				{
					db.WorkspaceInboxLastSeen.Add(new WorkspaceInboxLastSeen
					{
						WorkspaceId = workspace.Id,
						UserId = userId,
						LastSeen = DateTime.UtcNow
					});
				}
				else
				{
					lastSeen.LastSeen = DateTime.UtcNow;
				}

				await db.SaveChangesAsync();

				return Results.Ok("Marked as read");
			})
			.WithSummary("Marks all inbox messages as read for the calling user");
		}
	}
}