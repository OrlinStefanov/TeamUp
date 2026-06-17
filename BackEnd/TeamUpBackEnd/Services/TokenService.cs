using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using TeamUpBackEnd.Models;

namespace TeamUpBackEnd.Services
{
	public class TokenService
	{
		public static string GenerateToken(ApplicationUser user, IConfiguration config)
		{
			if (user == null) throw new ArgumentNullException(nameof(user));

			if (string.IsNullOrEmpty(config["JWT_KEY"]))
				throw new InvalidOperationException("JWT key is not configured.");

			if (string.IsNullOrEmpty(user.Email))
				throw new InvalidOperationException("User email is required for token generation.");

			var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["JWT_KEY"]));
			var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

			var claims = new[]
			{
				new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
				new Claim(ClaimTypes.NameIdentifier, user.Id),
				new Claim(ClaimTypes.Name, user.UserName ?? ""),
				new Claim(ClaimTypes.Email, user.Email)
			};

			var token = new JwtSecurityToken(
				issuer: config["JWT_ISSUER"],
				audience: config["JWT_AUDIENCE"],
				claims: claims,
				expires: DateTime.UtcNow.AddDays(3),
				signingCredentials: creds
			);

			return new JwtSecurityTokenHandler().WriteToken(token);
		}
	}
}
