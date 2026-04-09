namespace TeamUpBackEnd.DTO
{
	public class UserDataDTO
	{
		public record RegisterUser
		{
			public string UserName { get; set; } = string.Empty;
			public string FirstName { get; init; } = string.Empty;
			public string LastName { get; init; } = string.Empty;
			public string Email { get; init; } = string.Empty;
			public string Password { get; init; } = string.Empty;
			public DateOnly? BirthDate { get; init; }
			public string PhoneNumber { get; init; } = string.Empty;
		}

		public record UpdateUser
		{
			public string? UserName { get; init; }
			public string? FirstName { get; init; }
			public string? LastName { get; init; }
			public string? Email { get; init; }
			public DateOnly? BirthDate { get; init; }
			public string? PhoneNumber { get; init; }
		}

		public record LoginUser
		{
			public string EmailOrUsername { get; init; } = string.Empty;
			public string Password { get; init; } = string.Empty;
		}

		public record ForgotPasswordDTO(string EmailOrUsername);

		public record ResetPasswordDTO(string EmailOrUsername, string Token, string NewPassword);
	}
}
