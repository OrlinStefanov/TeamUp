using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Models.Inbox;

namespace TeamUpBackEnd.Helpers
{
	public static class InboxDismissHelper
	{
		public static IQueryable<WorkspaceInboxMessage> ExcludeDismissed(
			this IQueryable<WorkspaceInboxMessage> messages,
			AppDbContext db,
			int workspaceId,
			string userId)
		{
			return messages.Where(m =>
				!db.WorkspaceInboxDismissed.Any(d =>
					d.WorkspaceId == workspaceId &&
					d.UserId == userId &&
					d.MessageId == m.Id));
		}
	}
}
