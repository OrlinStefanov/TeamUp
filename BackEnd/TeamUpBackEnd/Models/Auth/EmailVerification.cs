namespace TeamUpBackEnd.Models.Auth
{
	public class EmailVerification
	{
		public int Id { get; set; }

		public string Email { get; set; } = string.Empty;

		public string CodeHash { get; set; } = string.Empty;

		public DateTime ExpiresAt { get; set; }

		public bool IsVerified { get; set; }

		public int Attempts { get; set; }

		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
	}
}
