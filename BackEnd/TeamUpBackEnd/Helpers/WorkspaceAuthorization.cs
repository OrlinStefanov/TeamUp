using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.Helpers
{
	public class WorkspaceAuthorization
	{
		public static async Task<WorkSpaceRole?> GetUserRole(AppDbContext db, int workspaceId, string userId)
		{
			var member = await db.WorkspaceMembers
				.FirstOrDefaultAsync(m => m.WorkSpaceId == workspaceId && m.UserId == userId);

			return member?.Role;
		}
	}
}
