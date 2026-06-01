using Microsoft.AspNetCore.Identity;
using TeamUpBackEnd.Models;

namespace TeamUpBackEnd.Helpers
{
	public static class UserResolver
	{
		/// <summary>
		/// Resolves a single string (email, username, or phone number)
		/// to an ApplicationUser. Returns null if no match is found.
		/// </summary>
		public static async Task<ApplicationUser?> ResolveAsync(
			string identifier,
			UserManager<ApplicationUser> userManager)
		{
			if (string.IsNullOrWhiteSpace(identifier))
				return null;

			// try email first (most common)
			var user = await userManager.FindByEmailAsync(identifier);
			if (user != null) return user;

			// then username
			user = await userManager.FindByNameAsync(identifier);
			if (user != null) return user;

			// finally phone number — Identity doesn't have a built-in
			// FindByPhoneAsync so we query the store directly
			user = userManager.Users
				.FirstOrDefault(u => u.PhoneNumber == identifier);

			return user;
		}
	}
}
