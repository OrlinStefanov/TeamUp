using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using TeamUpBackEnd.Models;
using TeamUpBackEnd.Services;
using user_data = TeamUpBackEnd.DTO.UserDataDTO;

namespace TeamUpBackEnd.Extensions
{
	public class EndpointsGenerator
	{
		public static void MapEndpoints(WebApplication app)
		{
			UserEndpoints(app);	
		}

		public static void UserEndpoints(WebApplication app)
		{
			//registers new user and returns a token with user info, if the registration is successful. If not, it returns the error(s) that occurred during registration.
			app.MapPost("/register", async (user_data.RegisterUser input_user, UserManager<ApplicationUser> userManager, IConfiguration config) =>
			{
				if (input_user == null)
				{
					return Results.BadRequest("No input");
				}

				if (string.IsNullOrEmpty(input_user.Email) || string.IsNullOrEmpty(input_user.Password) || string.IsNullOrEmpty(input_user.FirstName) || string.IsNullOrEmpty(input_user.LastName))
				{
					return Results.BadRequest("Email and password are required");
				}

				var user = new ApplicationUser
				{
					UserName = input_user.UserName,
					Email = input_user.Email,
					FirstName = input_user.FirstName,
					LastName = input_user.LastName
				};

				var result = await userManager.CreateAsync(user, input_user.Password);
				
				if (!result.Succeeded)
				{
					var errors = string.Join(", ", result.Errors.Select(e => e.Description));
					return Results.BadRequest(errors);
				}

				var token = TokenService.GenerateToken(user, config);

				return Results.Ok(token);

			})
				.WithSummary("Register a new user").WithTags("User Management");

			//logins user and returns a token with user info, if the login is successful. If not, it returns an unauthorized status.
			app.MapPost("/login", async (user_data.LoginUser input_user, UserManager<ApplicationUser> userManager, IConfiguration config) =>
			{
				if (input_user == null)
				{
					return Results.BadRequest("No input");
				}

				if (input_user.EmailOrUsername == null || input_user.Password == null)
				{
					return Results.BadRequest("Email/Username and password are required");
				}

				var user = await userManager.FindByEmailAsync(input_user.EmailOrUsername) ?? await userManager.FindByNameAsync(input_user.EmailOrUsername);

				if (user == null)
				{
					return Results.Unauthorized();
				}

				var passwordValid = await userManager.CheckPasswordAsync(user, input_user.Password);

				if (!passwordValid)
				{
					return Results.Unauthorized();
				}

				var token = TokenService.GenerateToken(user, config);

				//add refresh token to the response header

				return Results.Ok(token);
			})
				.WithSummary("Logs user as the token returns user id, name, email and security stamp").WithTags("User Management");

			//refreshes the token and returns a new token with user info, if the refresh is successful. If not, it returns an unauthorized status.
			app.MapPost("/refresh-token", async (ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, IConfiguration config) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId == null)
				{
					return Results.Unauthorized();
				}

				var user = await userManager.FindByIdAsync(userId);

				if (user == null)
				{
					return Results.Unauthorized();
				}

				var token = TokenService.GenerateToken(user, config);
				
				return Results.Ok(token);
			})
				.WithSummary("Refreshes the token and returns a new token with user info").WithTags("User Management");

			//logs out user by invalidating the token. This is done by changing the security stamp of the user, which will invalidate all tokens that were issued before the change.
			app.MapPost("/logout", async (ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId == null)
				{
					return Results.Unauthorized();
				}

				var user = await userManager.FindByIdAsync(userId);
				
				if (user == null)
				{
					return Results.Unauthorized();
				}

				await userManager.UpdateSecurityStampAsync(user);
				
				return Results.Ok("Logged out successfully");
			})
				.WithSummary("Logs out user by invalidating the token").WithTags("User Management");
		
			//returns the current user's info
			app.MapGet("/me", async (ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId == null)
					return Results.Unauthorized();

				var user = await userManager.FindByIdAsync(userId);

				if (user == null)
					return Results.Unauthorized();

				return Results.Ok(new
				{
					user.Id,
					user.UserName,
					user.Email,
					user.FirstName,
					user.LastName
				});
			})
				.WithSummary("Returns the current user's info").WithTags("User Management");
		}
	}
}