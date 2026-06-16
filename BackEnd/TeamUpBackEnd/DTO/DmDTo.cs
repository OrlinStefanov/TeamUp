namespace TeamUpBackEnd.DTO
{
	public class DmDTo
	{
		public record StartDmDTO
		{
			public List<string>? Identifiers { get; init; }

			// only used when IsGroup is true
			public string? Title { get; init; }

			public bool? IsGroup { get; init; }
		}

		public record AddDmMemberDTO
		{
			// single identifier — email, username, or phone
			public string? Identifier { get; init; }
		}

		public record UpdateConversationDto
		{
			public string? Title { get; init; }
		}

		public record UpdateNicknameDto
		{
			public string? Nickname { get; init; }
		}

		public record UpdateMemberRoleDto
		{
			public string? Role { get; init; }
		}

	}
}
