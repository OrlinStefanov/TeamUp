using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Models;
using TeamUpBackEnd.Models.WorkspaceRelated;
using TeamUpBackEnd.Helpers;
using TeamUpBackEnd.Services;

using user_data = TeamUpBackEnd.DTO.UserDataDTO;
using workspaceDto = TeamUpBackEnd.DTO.WorkspaceDTO;

namespace TeamUpBackEnd.Extensions
{
	public class EndpointsGenerator
	{
		public static void MapEndpoints(WebApplication app)
		{
			UserEndpoints(app);
			WorkspaceEndpoints(app);
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

				if (string.IsNullOrWhiteSpace(input_user.UserName)) return Results.BadRequest("Username is required");
				if (string.IsNullOrWhiteSpace(input_user.Email)) return Results.BadRequest("Email is required");
				if (string.IsNullOrWhiteSpace(input_user.Password)) return Results.BadRequest("Password is required");
				if (string.IsNullOrWhiteSpace(input_user.FirstName)) return Results.BadRequest("First name is required");
				if (string.IsNullOrWhiteSpace(input_user.LastName)) return Results.BadRequest("Last name is required");
				if (string.IsNullOrWhiteSpace(input_user.PhoneNumber)) return Results.BadRequest("Phone number is required");
				if (string.IsNullOrWhiteSpace(input_user.BirthDate.ToString())) return Results.BadRequest("BirthDate is required");

				if (!DateOnly.TryParse(input_user.BirthDate.ToString(), out var birthDate))
				{
					return Results.BadRequest("Invalid birth date format");
				}

				var user = new ApplicationUser
				{
					UserName = input_user.UserName,
					Email = input_user.Email,
					FirstName = input_user.FirstName,
					LastName = input_user.LastName,
					BirthDate = input_user.BirthDate,
					PhoneNumber = input_user.PhoneNumber,
				};

				if (userManager.Users.Any(u => u.UserName == user.UserName))
				{
					return Results.BadRequest("Username already exists");
				}

				if (userManager.Users.Any(u => u.Email == user.Email))
				{
					return Results.BadRequest("Email already exists");
				}

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
			app.MapPost("/login", async (user_data.LoginUser input_user, UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> SignInManager, IConfiguration config) =>
			{
				if (input_user == null)
					return Results.BadRequest("No input");

				if (string.IsNullOrWhiteSpace(input_user.EmailOrUsername)) return Results.BadRequest("Email or username is required");
				if (string.IsNullOrWhiteSpace(input_user.Password)) return Results.BadRequest("Password is required");

				var user = await userManager.FindByEmailAsync(input_user.EmailOrUsername) ?? await userManager.FindByNameAsync(input_user.EmailOrUsername);

				if (user == null)
					return Results.Unauthorized();

				var passwordValid = await userManager.CheckPasswordAsync(user, input_user.Password);

				if (!passwordValid)
					return Results.Unauthorized();

				var token = TokenService.GenerateToken(user, config);

				return Results.Ok(new
				{
					token,
					user.Id,
					user.UserName,
					user.Email,
					user.ProfilePictureUrl
				});
			})
				.WithSummary("Logs user as the token returns user id, name, email and security stamp").WithTags("User Management");

			//refreshes the token and returns a new token with user info, if the refresh is successful. If not, it returns an unauthorized status.
			app.MapPost("/refresh-token", async (ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, IConfiguration config) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId == null)
				{
					return Results.BadRequest("Id not found");
				}

				var user = await userManager.FindByIdAsync(userId);

				if (user == null)
				{
					return Results.BadRequest("User not found");
				}

				var token = TokenService.GenerateToken(user, config);

				return Results.Ok(token);
			}).RequireAuthorization()
				.WithSummary("Refreshes the token and returns a new token with user info").WithTags("User Management");

			//logs out user by invalidating the token. This is done by changing the security stamp of the user, which will invalidate all tokens that were issued before the change.
			app.MapPost("/logout", async (ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId == null)
				{
					return Results.BadRequest("Id not found");
				}

				var user = await userManager.FindByIdAsync(userId);

				if (user == null)
				{
					return Results.BadRequest("User not found");
				}

				await userManager.UpdateSecurityStampAsync(user);

				return Results.Ok("Logged out successfully");
			}).RequireAuthorization()
				.WithSummary("Logs out user by invalidating the token").WithTags("User Management");

			//returns the current user's info
			app.MapGet("/me", [Authorize] async (ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId == null)
					return Results.BadRequest("Id not found");

				var user = await userManager.FindByIdAsync(userId);

				if (user == null)
					return Results.BadRequest("User not found");

				return Results.Ok(new
				{
					user.Id,
					user.UserName,
					user.Email,
					user.FirstName,
					user.LastName,
					user.BirthDate,
					user.PhoneNumber,
					user.ProfilePictureUrl
				});
			}).RequireAuthorization()
				.WithSummary("Returns the current user's info").WithTags("User Management");

			//forgets the old password and via email sends proposition for a new one. If the email is not found, it returns ok status without sending an email, to prevent email enumeration attacks.
			app.MapPost("/forgot-password", async (user_data.ForgotPasswordDTO dto, UserManager<ApplicationUser> userManager, EmailService emailService) =>
			{
				var user = await userManager.FindByEmailAsync(dto.EmailOrUsername) ?? await userManager.FindByNameAsync(dto.EmailOrUsername);

				if (user == null)
					return Results.BadRequest("User not found");

				var token = await userManager.GeneratePasswordResetTokenAsync(user);

				var encodedToken = Uri.EscapeDataString(token);

				var user_email = user.Email;

				if (user_email is null) return Results.BadRequest("User email not found");

				var link = $"https://localhost:4200/forgot-password?email={Uri.EscapeDataString(user_email)}&token={encodedToken}"; // in development
																																	//$"https://teamup.com/reset-password";

				await emailService.SendEmailAsync(
					user_email,
					"Reset Password",
					$"Click here to reset your password:<br><a href='{link}'>Reset</a>");

				return Results.Ok("Reset email sent");
			}).WithSummary("Resets the old password and via email sends link in the frontend for a new one")
				.WithTags("User Management");

			//resets the password using the token that was sent to the user's email. If the token is invalid, it returns a bad request status with the error(s) that occurred during password reset.
			app.MapPost("/reset-password", async (
				user_data.ResetPasswordDTO dto,
				UserManager<ApplicationUser> userManager) =>
			{
				var user = await userManager.FindByEmailAsync(dto.EmailOrUsername)
						   ?? await userManager.FindByNameAsync(dto.EmailOrUsername);

				if (user == null)
					return Results.BadRequest("Invalid request");

				// Decode token from URL
				var decodedToken = Uri.UnescapeDataString(dto.Token);

				var result = await userManager.ResetPasswordAsync(
					user,
					decodedToken,
					dto.NewPassword);

				if (!result.Succeeded)
					return Results.BadRequest(result.Errors);

				await userManager.UpdateSecurityStampAsync(user);

				return Results.Ok("Password reset successful");
			})
			.WithSummary("Resets the password using the token that was sent to the user's email")
			.WithTags("User Management");

			//uploading user profile picture 
			app.MapPost("/upload-profile-picture", [Authorize] async (IFormFile file, ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, CloudinaryService cloudinaryService) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null)
				{
					return Results.BadRequest("Id not found");
				}

				var user = await userManager.FindByIdAsync(userId);

				if (user is null)
				{
					return Results.BadRequest("User not found");
				}

				if (file is null || file.Length == 0)
				{
					return Results.BadRequest("No file uploaded");
				}

				if (!file.ContentType.StartsWith("image/"))
				{
					return Results.BadRequest("Invalid file type. Only images are allowed.");
				}

				if (file.Length > 5 * 1024 * 1024)
				{
					return Results.BadRequest("File size exceeds the limit of 5MB");
				}

				var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };

				var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

				if (!allowedExtensions.Contains(extension))
				{
					return Results.BadRequest("Invalid file extension.");
				}

				var imgUrl = await cloudinaryService.UploadProfileImage(file);

				user.ProfilePictureUrl = imgUrl;

				await userManager.UpdateAsync(user);

				return Results.Ok("Image uploaded " + imgUrl);

			}).RequireAuthorization().Accepts<IFormFile>("multipart/form-data").DisableAntiforgery()
				.WithSummary("Uploading user profile picture").WithTags("User Management");
		}

		public static void WorkspaceEndpoints(WebApplication app)
		{
			//creates a new workspace and adds the owner as a member with the owner role. If there are additional members provided in the request, it adds them as members with the member role.
			app.MapPost("/create/worspace" , [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, workspaceDto.CreateWorkspace data) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null)
				{
					return Results.BadRequest("Id not found");
				}

				var user = await userManager.FindByIdAsync(userId);

				if (user is null)
				{
					return Results.BadRequest("User not found");
				}

				//creating workspace entity
				var workspace = new WorkSpace
				{
					Title = data.Title,
					Description = data.Description,
					OwnerId = userId,
					Members = new List<WorkSpaceMember>(),
					CreatedAt = DateTime.UtcNow
				};

				//adding the owner
				workspace.Members.Add(new WorkSpaceMember
				{
					UserId = userId,
					Role = WorkSpaceRole.Owner
				});

				if (data.Members != null && data.Members.Count > 0)
				{
					var memberEmailsOrUsernames = data.Members
						.Where(m => !string.IsNullOrEmpty(m.EmailOrUsername))
						.Select(m => m.EmailOrUsername!)
						.ToList();

					var users = await userManager.Users
						.Where(u => memberEmailsOrUsernames.Contains(u.Email!)
								 || memberEmailsOrUsernames.Contains(u.UserName!))
						.ToListAsync();

					foreach (var memberData in data.Members)
					{
						if (memberData.EmailOrUsername == null)
							return Results.BadRequest("Email or username is required for all members");

						var memberUser = users.FirstOrDefault(u =>
							u.Email == memberData.EmailOrUsername || u.UserName == memberData.EmailOrUsername);

						if (memberUser == null)
							return Results.BadRequest($"Member '{memberData.EmailOrUsername}' not found");

						if (memberUser.Id == userId)
							continue; 

						workspace.Members.Add(new WorkSpaceMember
						{
							UserId = memberUser.Id,
							Role = WorkSpaceRole.Member 
						});
					}
				}

				await db.Workspaces.AddAsync(workspace);
				await db.SaveChangesAsync();

				return Results.Ok(new
				{
					workspace.Id,
					workspace.Title,
					workspace.Description,
					workspace.OwnerId,
					MembersCount = workspace.Members.Count
				});
			}).RequireAuthorization()
				.WithSummary("Creates a new workspace").WithTags("Workspace Management");

			//returns a list of workspaces the user is a member of, including the workspace id, title, description, owner id and members count. If the user is not a member of any workspace, it returns an empty list.
			app.MapGet("/workspaces", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null)
				{
					return Results.BadRequest("Id not found");
				}
				
				var workspaces = await db.Workspaces
					.Where(w => w.Members.Any(m => m.UserId == userId))
					.Select(w => new
					{
						w.Id,
						w.Title,
						w.Description,
						w.OwnerId,
						MembersCount = w.Members.Count,
						Members = w.Members.Select(m => new
						{
							m.UserId,
							m.Role
						})
					})
					.ToListAsync();

				return Results.Ok(workspaces);
			}).RequireAuthorization()
				.WithSummary("Returns a list of workspaces the user is a member of").WithTags("Workspace Management");
			
			//returns the list of possible users user might be searching
			app.MapPost("search/members/add", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, MemberSearch model, UserManager<ApplicationUser> userManager) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null) return Results.BadRequest("User id not found");

				var user = await userManager.FindByIdAsync(userId);

				if (user == null) return Results.BadRequest("User not found");

				if (model.emailOrUsername.Length < 3)
				{
					return Results.BadRequest("Not enough data");
				}

				var possible_users = await userManager.Users.Where(u => u.Email.Contains(model.emailOrUsername) || u.UserName.Contains(model.emailOrUsername)).ToListAsync();

				if (possible_users is null || possible_users.Count == 0)
				{
					return Results.BadRequest("No users found");
				}

				var transformed_users = possible_users.Select(u => new
				{
					u.UserName,
					u.Email,
					u.ProfilePictureUrl
				}).ToList();

				return Results.Ok(transformed_users);
			}).RequireAuthorization().WithSummary("Retruns list of possible users you might be searching for").WithTags("Workspace Management");
		}
	}

	public record MemberSearch(string emailOrUsername);
}