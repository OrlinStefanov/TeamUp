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
			public string ProfilePictureUrl { get; init; } = string.Empty;
		}

		public record LoginUser
		{
			public string EmailOrUsername { get; init; } = string.Empty;
			public string Password { get; init; } = string.Empty;
		}

		public record ForgotPasswordDTO(string Email);

		public record ResetPasswordDTO(string Email, string Token, string NewPassword);
	}
}
