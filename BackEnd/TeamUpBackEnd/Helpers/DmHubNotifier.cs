using Microsoft.AspNetCore.SignalR;
using TeamUpBackEnd.Extensions;
using TeamUpBackEnd.Helpers;
using TeamUpBackEnd.Models.Chat;

namespace TeamUpBackEnd.Helpers
{
	public static class DmHubNotifier
	{
		public static async Task NotifyMemberAdded(
			IHubContext<DmHub> hub,
			string conversationPublicId,
			ConversationMember member)
		{
			await hub.Clients.Group(conversationPublicId).SendAsync("DmMemberAdded", new
			{
				conversationId = conversationPublicId,
				member = MapMember(member)
			});
		}

		public static async Task NotifyMemberRemoved(
			IHubContext<DmHub> hub,
			string conversationPublicId,
			string removedUserId,
			string? removedByUserId = null)
		{
			await hub.Clients.Group(conversationPublicId).SendAsync("DmMemberRemoved", new
			{
				conversationId = conversationPublicId,
				userId = removedUserId,
				removedByUserId
			});

			await hub.Clients.User(removedUserId).SendAsync("DmMemberRemoved", new
			{
				conversationId = conversationPublicId,
				userId = removedUserId,
				removedByUserId
			});
		}

		public static async Task NotifyConversationUpdated(
			IHubContext<DmHub> hub,
			string conversationPublicId,
			string? title)
		{
			await hub.Clients.Group(conversationPublicId).SendAsync("DmConversationUpdated", new
			{
				conversationId = conversationPublicId,
				title
			});
		}

		public static async Task NotifyMemberUpdated(
			IHubContext<DmHub> hub,
			string conversationPublicId,
			ConversationMember member)
		{
			await hub.Clients.Group(conversationPublicId).SendAsync("DmMemberUpdated", new
			{
				conversationId = conversationPublicId,
				userId = member.UserId,
				nickname = member.Nickname,
				role = ConversationMemberHelper.RoleToString(member.Role),
				displayName = ConversationMemberHelper.GetDisplayName(member)
			});
		}

		public static object MapMember(ConversationMember m) => new
		{
			userId = m.UserId,
			userName = m.User?.UserName,
			nickname = m.Nickname,
			role = ConversationMemberHelper.RoleToString(m.Role),
			displayName = ConversationMemberHelper.GetDisplayName(m),
			profilePictureUrl = m.User?.ProfilePictureUrl,
			joinedAt = m.JoinedAt
		};
	}
}
