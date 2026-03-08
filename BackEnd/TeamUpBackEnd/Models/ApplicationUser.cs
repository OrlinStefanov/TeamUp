using Microsoft.AspNetCore.Identity;

namespace TeamUpBackEnd.Models
{
	public class ApplicationUser : IdentityUser
	{
		public string? FirstName { get; set; }
		public string? LastName { get; set; }
		public string? ProfilePictureUrl { get; set; }
	}
}
