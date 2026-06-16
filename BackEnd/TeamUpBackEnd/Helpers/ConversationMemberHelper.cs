using TeamUpBackEnd.Models.Chat;

namespace TeamUpBackEnd.Helpers
{
	public static class ConversationMemberHelper
	{
		public static string GetDisplayName(ConversationMember member) =>
			!string.IsNullOrWhiteSpace(member.Nickname)
				? member.Nickname!
				: member.User?.UserName ?? "Unknown";

		public static string RoleToString(ConversationMemberRole role) => role switch
		{
			ConversationMemberRole.Owner => "Owner",
			ConversationMemberRole.Admin => "Admin",
			_ => "Member"
		};

		public static bool TryParseRole(string? role, out ConversationMemberRole parsed)
		{
			parsed = ConversationMemberRole.Member;
			if (string.IsNullOrWhiteSpace(role))
				return false;

			switch (role.Trim().ToLowerInvariant())
			{
				case "owner":
					parsed = ConversationMemberRole.Owner;
					return true;
				case "admin":
					parsed = ConversationMemberRole.Admin;
					return true;
				case "member":
					parsed = ConversationMemberRole.Member;
					return true;
				default:
					return false;
			}
		}

		public static bool CanRename(ConversationMember? actor) =>
			actor?.Role is ConversationMemberRole.Owner or ConversationMemberRole.Admin;

		public static bool CanSetNicknameForOther(ConversationMember? actor) =>
			actor?.Role is ConversationMemberRole.Owner or ConversationMemberRole.Admin;

		public static bool CanChangeRole(ConversationMember? actor) =>
			actor?.Role == ConversationMemberRole.Owner;

		public static bool CanKick(ConversationMember? actor, ConversationMember target)
		{
			if (actor is null || actor.UserId == target.UserId)
				return false;

			if (target.Role == ConversationMemberRole.Owner)
				return false;

			return actor.Role switch
			{
				ConversationMemberRole.Owner => true,
				ConversationMemberRole.Admin => target.Role == ConversationMemberRole.Member,
				_ => false
			};
		}

		/// <summary>
		/// When the owner leaves, promote the longest-tenured admin, else longest-tenured member.
		/// Returns the new owner member, or null if none remain to promote.
		/// </summary>
		public static ConversationMember? PromoteNewOwner(ICollection<ConversationMember> members, string leavingOwnerId)
		{
			var candidates = members
				.Where(m => m.UserId != leavingOwnerId)
				.ToList();

			if (candidates.Count == 0)
				return null;

			var nextOwner = candidates
				.Where(m => m.Role == ConversationMemberRole.Admin)
				.OrderBy(m => m.JoinedAt)
				.FirstOrDefault()
				?? candidates.OrderBy(m => m.JoinedAt).First();

			nextOwner.Role = ConversationMemberRole.Owner;
			return nextOwner;
		}
	}
}
