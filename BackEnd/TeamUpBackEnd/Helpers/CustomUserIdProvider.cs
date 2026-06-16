using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace TeamUpBackEnd.Helpers
{
	public class CustomUserIdProvider : IUserIdProvider
	{
		public string? GetUserId(HubConnectionContext connection) =>
			connection.User?.FindFirstValue(ClaimTypes.NameIdentifier);
	}
}
