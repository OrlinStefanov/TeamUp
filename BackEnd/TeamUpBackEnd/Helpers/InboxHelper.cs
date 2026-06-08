using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Extensions;
using TeamUpBackEnd.Models.Inbox;
using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.Helpers
{
	public static class InboxHelper
	{
		// ── CREATE AND BROADCAST ──────────────────────────────────────────────────
		// Creates a new inbox message, saves it, and broadcasts via TaskHub.
		// For ChannelActivity it upserts instead of inserting to avoid spam.

		public static async Task SendInboxMessageAsync(
			AppDbContext db,
			IHubContext<TaskHub> hub,
			int workspaceId,
			string workspacePublicId,
			InboxMessageType type,
			string title,
			string body,
			string? channelPublicId = null)
		{
			var now = DateTime.UtcNow;

			WorkspaceInboxMessage message;

			if (type == InboxMessageType.ChannelActivity && channelPublicId is not null)
			{
				// upsert — find existing non-expired ChannelActivity for this channel
				var existing = await db.WorkspaceInboxMessages
					.FirstOrDefaultAsync(m =>
						m.WorkspaceId == workspaceId &&
						m.Type == InboxMessageType.ChannelActivity &&
						m.ChannelPublicId == channelPublicId &&
						m.ExpiresAt > now);

				if (existing is not null)
				{
					// update the existing entry so it bubbles to the top
					existing.CreatedAt = now;
					existing.ExpiresAt = now.AddDays(30);
					existing.Body = body;
					message = existing;
				}
				else
				{
					message = new WorkspaceInboxMessage
					{
						WorkspaceId = workspaceId,
						Type = type,
						Title = title,
						Body = body,
						ChannelPublicId = channelPublicId,
						CreatedAt = now,
						ExpiresAt = now.AddDays(30)
					};
					db.WorkspaceInboxMessages.Add(message);
				}
			}
			else
			{
				message = new WorkspaceInboxMessage
				{
					WorkspaceId = workspaceId,
					Type = type,
					Title = title,
					Body = body,
					ChannelPublicId = channelPublicId,
					CreatedAt = now,
					ExpiresAt = now.AddDays(30)
				};
				db.WorkspaceInboxMessages.Add(message);
			}

			await db.SaveChangesAsync();

			// broadcast to all members currently connected to this workspace group
			await hub.Clients
				.Group(workspacePublicId)
				.SendAsync("NewInboxMessage", new
				{
					publicId = message.PublicId,
					title = message.Title,
					body = message.Body,
					type = message.Type.ToString(),
					channelPublicId = message.ChannelPublicId,
					createdAt = message.CreatedAt
				});
		}
	}
}