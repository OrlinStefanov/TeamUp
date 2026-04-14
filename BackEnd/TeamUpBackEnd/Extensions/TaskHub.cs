using Microsoft.AspNetCore.SignalR;

namespace TeamUpBackEnd.Extensions
{
	public class TaskHub : Hub
	{
		public async Task JoinWorkspace(string workspaceId)
		{
			await Groups.AddToGroupAsync(Context.ConnectionId, workspaceId);
		}

		public async Task LeaveWorkspace(string workspaceId)
		{
			await Groups.RemoveFromGroupAsync(Context.ConnectionId, workspaceId);
		}
	}
}
