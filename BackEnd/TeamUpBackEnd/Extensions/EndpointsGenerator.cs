using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Json;
using System.Reflection.Metadata.Ecma335;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Helpers;
using TeamUpBackEnd.Interfaces;
using TeamUpBackEnd.Models;
using TeamUpBackEnd.Models.Auth;
using TeamUpBackEnd.Models.Chat;
using TeamUpBackEnd.Models.Tasks;
using TeamUpBackEnd.Models.WorkspaceRelated;
using TeamUpBackEnd.Services;

using static TeamUpBackEnd.DTO.TaskItemsDTO;

using chatDto = TeamUpBackEnd.DTO.ChatsDTO;
using taskDTO = TeamUpBackEnd.DTO.TaskItemsDTO;
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
			TaskEndpoints(app);
			ChatEndpoints(app);
			LeaderBoard(app);

			AuthenticaionEndpoints(app);
		}

		public static void AuthenticaionEndpoints(WebApplication app)
		{
			var authGroup = app.MapGroup("/auth");

			authGroup.MapPost("/register", async (RequestEmailCodeDto request, UserManager<ApplicationUser> userManager,	AppDbContext db, IEmailService emailService) =>
				{
					if (string.IsNullOrWhiteSpace(request.Email))
					{
						return Results.BadRequest("Email is required");
					}

					var existingUser = await userManager.FindByEmailAsync(request.Email);

					if (existingUser != null)
					{
						return Results.BadRequest("Email already exists");
					}

					var recentRequest = await db.EmailVerifications
						.Where(x => x.Email == request.Email)
						.OrderByDescending(x => x.CreatedAt)
						.FirstOrDefaultAsync();

					if (recentRequest != null &&
						recentRequest.CreatedAt > DateTime.UtcNow.AddSeconds(-60))
					{
						return Results.BadRequest("Please wait before requesting another code");
					}

					var code = RandomNumberGenerator
						.GetInt32(100000, 999999)
						.ToString();

					var verification = new EmailVerification
					{
						Email = request.Email,
						CodeHash = BCrypt.Net.BCrypt.HashPassword(code),
						ExpiresAt = DateTime.UtcNow.AddMinutes(10),
						Attempts = 0,
						IsVerified = false
					};

					db.EmailVerifications.Add(verification);

					await db.SaveChangesAsync();

					await emailService.SendEmailAsync(
						request.Email,
						"TeamUp Verification Code",
						$"""
						<h2>Email Verification</h2>
						<p>Your verification code is:</p>
						<h1>{code}</h1>
						<p>This code expires in 10 minutes.</p>
						""");

					return Results.Ok("Verification code sent");
				})
				.WithTags("Authentication").RequireRateLimiting("auth");

			authGroup.MapPost("/verify-email", async (VerifyEmailCodeDto request, AppDbContext db) =>
			{
				var verification = await db.EmailVerifications
					.Where(x =>
						x.Email == request.Email &&
						!x.IsVerified)
					.OrderByDescending(x => x.CreatedAt)
					.FirstOrDefaultAsync();

				if (verification == null)
				{
					return Results.BadRequest("No verification request found");
				}

				if (verification.ExpiresAt < DateTime.UtcNow)
				{
					return Results.BadRequest("Verification code expired");
				}

				if (verification.Attempts >= 5)
				{
					return Results.BadRequest("Too many attempts");
				}

				verification.Attempts++;

				var valid = BCrypt.Net.BCrypt.Verify(
					request.Code,
					verification.CodeHash);

				if (!valid)
				{
					await db.SaveChangesAsync();
					return Results.BadRequest("Invalid code");
				}

				verification.IsVerified = true;

				await db.SaveChangesAsync();

				return Results.Ok("Email verified successfully");
			}).WithTags("Authentication").RequireRateLimiting("auth");
		}

		public static void UserEndpoints(WebApplication app)
		{
			//registers new user and returns a token with user info, if the registration is successful. If not, it returns the error(s) that occurred during registration.
			app.MapPost("/register", async (user_data.RegisterUser input_user, UserManager<ApplicationUser> userManager, IConfiguration config, AppDbContext db) =>
			{
				if (input_user == null)
				{
					return Results.BadRequest("No input");
				}

				var verification = await db.EmailVerifications
					.Where(x =>
						x.Email == input_user.Email &&
						x.IsVerified)
					.OrderByDescending(x => x.CreatedAt)
					.FirstOrDefaultAsync();

				if (verification == null)
				{
					return Results.BadRequest("Email not verified");
				}

				if (string.IsNullOrWhiteSpace(input_user.UserName))
					return Results.BadRequest("Username is required");

				if (string.IsNullOrWhiteSpace(input_user.Email))
					return Results.BadRequest("Email is required");

				if (string.IsNullOrWhiteSpace(input_user.Password))
					return Results.BadRequest("Password is required");

				if (string.IsNullOrWhiteSpace(input_user.FirstName))
					return Results.BadRequest("First name is required");

				if (string.IsNullOrWhiteSpace(input_user.LastName))
					return Results.BadRequest("Last name is required");

				if (string.IsNullOrWhiteSpace(input_user.PhoneNumber))
					return Results.BadRequest("Phone number is required");

				if (input_user.BirthDate == null)
					return Results.BadRequest("BirthDate is required");

				var existingUsername = await userManager
					.FindByNameAsync(input_user.UserName);

				if (existingUsername != null)
				{
					return Results.BadRequest("Username already exists");
				}

				var existingEmail = await userManager
					.FindByEmailAsync(input_user.Email);

				if (existingEmail != null)
				{
					return Results.BadRequest("Email already exists");
				}

				var user = new ApplicationUser
				{
					UserName = input_user.UserName,
					Email = input_user.Email,
					FirstName = input_user.FirstName,
					LastName = input_user.LastName,
					BirthDate = input_user.BirthDate,
					PhoneNumber = input_user.PhoneNumber,
					EmailConfirmed = true
				};

				var result = await userManager.CreateAsync(
					user,
					input_user.Password);

				if (!result.Succeeded)
				{
					var errors = string.Join(
						", ",
						result.Errors.Select(e => e.Description));

					return Results.BadRequest(errors);
				}

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
				.WithSummary("Register a new user").WithTags("User Management");

			//logins user and returns a token with user info, if the login is successful. If not, it returns an unauthorized status.
			app.MapPost("/login", async (user_data.LoginUser input_user, UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> SignInManager, IConfiguration config) =>
			{
				if (input_user == null)
					return Results.BadRequest("No input");

				if (string.IsNullOrWhiteSpace(input_user.EmailOrUsername))
					return Results.BadRequest("Email or username is required");

				if (string.IsNullOrWhiteSpace(input_user.Password))
					return Results.BadRequest("Password is required");

				var user = await userManager.FindByEmailAsync(
						input_user.EmailOrUsername)
					?? await userManager.FindByNameAsync(
						input_user.EmailOrUsername);

				if (user == null)
					return Results.Unauthorized();

				if (!user.EmailConfirmed)
					return Results.BadRequest("Email not verified");

				var passwordValid = await userManager.CheckPasswordAsync(
					user,
					input_user.Password);

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
			app.MapPost("/forgot-password", async (user_data.ForgotPasswordDTO dto, UserManager<ApplicationUser> userManager, IEmailService emailService) =>
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
			}).RequireAuthorization().WithSummary("Resets the old password and via email sends link in the frontend for a new one")
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

			//change user info 
			app.MapPost("/profile/update", [Authorize] async (
				ClaimsPrincipal userClaims,
				AppDbContext db,
				UserManager<ApplicationUser> userManager,
				user_data.UpdateUser model) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null)
					return Results.BadRequest("User id not found");

				var user = await userManager.FindByIdAsync(userId);

				if (user is null)
					return Results.BadRequest("User not found");

				if (!string.IsNullOrWhiteSpace(model.UserName) && model.UserName != user.UserName)
				{
					var usernameResult = await userManager.SetUserNameAsync(user, model.UserName);
					if (!usernameResult.Succeeded)
						return Results.BadRequest(usernameResult.Errors);
				}

				if (!string.IsNullOrWhiteSpace(model.Email) && model.Email != user.Email)
				{
					var emailResult = await userManager.SetEmailAsync(user, model.Email);
					if (!emailResult.Succeeded)
						return Results.BadRequest(emailResult.Errors);
				}

				if (!string.IsNullOrWhiteSpace(model.PhoneNumber))
					user.PhoneNumber = model.PhoneNumber;

				if (!string.IsNullOrWhiteSpace(model.FirstName))
					user.FirstName = model.FirstName;

				if (!string.IsNullOrWhiteSpace(model.LastName))
					user.LastName = model.LastName;

				if (model.BirthDate.HasValue)
					user.BirthDate = model.BirthDate;

				var result = await userManager.UpdateAsync(user);

				if (!result.Succeeded)
					return Results.BadRequest(result.Errors);

				return Results.Ok(new
				{
					user.Id,
					user.UserName,
					user.Email,
					user.FirstName,
					user.LastName,
					user.PhoneNumber,
					user.BirthDate,
					user.ProfilePictureUrl
				});

			})
			.RequireAuthorization()
			.WithSummary("Updates user's personal info")
			.WithTags("User Management");

            app.MapPost("/change-password", [Authorize] async (ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, user_data.ChangePasswordDTO dto) =>
            {
                var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

                if (userId is null)
                    return Results.BadRequest("User not found");

                var user = await userManager.FindByIdAsync(userId);

                if (user is null)
                    return Results.BadRequest("User not found");

                if (string.IsNullOrWhiteSpace(dto.CurrentPassword))
                    return Results.BadRequest("Current password is required");

                if (string.IsNullOrWhiteSpace(dto.NewPassword))
                    return Results.BadRequest("New password is required");

                var result = await userManager.ChangePasswordAsync(
                    user,
                    dto.CurrentPassword,
                    dto.NewPassword
                );

                if (!result.Succeeded)
                {
                    var errors = result.Errors.Select(e => e.Description);
                    return Results.BadRequest(errors);
                }

                // invalidate old tokens (important)
                await userManager.UpdateSecurityStampAsync(user);

                return Results.Ok("Password changed successfully");
            }).RequireAuthorization()
			.WithSummary("Change password for authenticated user")
			.WithTags("User Management");
        }

		public static void WorkspaceEndpoints(WebApplication app)
		{
			//creates a new workspace and adds the owner as a member with the owner role. If there are additional members provided in the request, it adds them as members with the member role.
			app.MapPost("/create/workspace", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, workspaceDto.CreateWorkspace data) =>
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
					CreatedAt = DateOnly.FromDateTime(DateTime.UtcNow)
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
							Role = memberData.Role switch
							{
								0 => WorkSpaceRole.Member,
								1 => WorkSpaceRole.Admin,
								_ => WorkSpaceRole.Member
							}
						});
					}
				}

				await db.Workspaces.AddAsync(workspace);

				var generalChannel = new Channel
				{
					Name = "general",
					Description = "General workspace discussion",
					IsPrivate = false,
					WorkspaceId = workspace.Id,  // EF will resolve this after insert
					Members = new List<ChannelMember>()
				};

				workspace.Channels.Add(generalChannel);

				await db.SaveChangesAsync();

				return Results.Ok(new
				{
					workspace.Id,
					workspace.Title,
					workspace.Description,
					workspace.OwnerId,
					workspace.JoinCode,
					MembersCount = workspace.Members.Count
				});
			}).RequireAuthorization()
				.WithSummary("Creates a new workspace").WithTags("Workspace Management");

			//edits the workspace
			app.MapPut("/edit/workspace", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, workspaceDto.EditWorkspace data) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null) return Results.BadRequest("User id not found");

				if (string.IsNullOrEmpty(data.PublicId)) return Results.BadRequest("Workspace id is required");

				var workspace = await db.Workspaces
					.Include(w => w.Members)
					.FirstOrDefaultAsync(w => w.PublicId.ToString() == data.PublicId && w.IsDeleted == false);

				if (workspace is null) return Results.NotFound("Workspace not found");

				if (workspace.OwnerId != userId) return Results.Forbid();

				if (!string.IsNullOrWhiteSpace(data.Title))
					workspace.Title = data.Title;

				if (!string.IsNullOrWhiteSpace(data.Description))
					workspace.Description = data.Description;

				if (data.Members != null && data.Members.Count > 0)
				{
					var identifiers = data.Members
						.Where(m => !string.IsNullOrEmpty(m.EmailOrUsername))
						.Select(m => m.EmailOrUsername!)
						.ToList();

					var users = await userManager.Users
						.Where(u => identifiers.Contains(u.Email!) || identifiers.Contains(u.UserName!))
						.ToListAsync();

					foreach (var memberDto in data.Members)
					{
						if (memberDto.EmailOrUsername == null)
							return Results.BadRequest("Email or username is required");

						var user = users.FirstOrDefault(u =>
							u.Email == memberDto.EmailOrUsername ||
							u.UserName == memberDto.EmailOrUsername);

						if (user == null)
							return Results.BadRequest($"User '{memberDto.EmailOrUsername}' not found");

						if (user.Id == workspace.OwnerId)
							continue;

						var existingMember = workspace.Members
							.FirstOrDefault(m => m.UserId == user.Id);

						if (existingMember == null)
						{
							workspace.Members.Add(new WorkSpaceMember
							{
								UserId = user.Id,
								Role = memberDto.Role switch
								{
									0 => WorkSpaceRole.Member,
									1 => WorkSpaceRole.Admin,
									_ => WorkSpaceRole.Member
								}
							});
						}
						else
						{
							existingMember.Role = memberDto.Role switch
							{
								0 => WorkSpaceRole.Member,
								1 => WorkSpaceRole.Admin,
								_ => WorkSpaceRole.Member
							};
						}
					}

					var incomingUserIds = users.Select(u => u.Id).ToHashSet();

					var membersToRemove = workspace.Members
						.Where(m => m.UserId != workspace.OwnerId && !incomingUserIds.Contains(m.UserId!))
						.ToList();

					foreach (var member in membersToRemove)
					{
						workspace.Members.Remove(member);
					}
				}

				workspace.UpdatedAt = DateOnly.FromDateTime(DateTime.Now);

				await db.SaveChangesAsync();

				return Results.Ok(new
				{
					workspace.PublicId,
					workspace.Title,
					workspace.Description,
					workspace.OwnerId,
					workspace.CreatedAt,
					workspace.UpdatedAt,
					MembersCount = workspace.Members.Count
				});

			}).WithSummary("Edits a workspace").WithTags("Workspace Management");

			//returns a list of workspaces the user is a member of, including the workspace id, title, description, owner id and members count. If the user is not a member of any workspace, it returns an empty list.
			app.MapGet("/workspaces/short", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null)
				{
					return Results.BadRequest("Id not found");
				}

				var workspaces = await db.Workspaces
					.Where(w => w.Members.Any(m => m.UserId == userId) && w.IsDeleted == false)
					.Select(w => new
					{
						w.Id,
						w.PublicId,
						w.Title,
						w.Description,
						w.CreatedAt,
						w.UpdatedAt,
						w.OwnerId,
						w.JoinCode,
						MembersCount = w.Members.Count,
						Members = w.Members.Select(m => new
						{
							m.UserId,
							m.User!.UserName,
							m.User.ProfilePictureUrl,
							Role = (m.Role == WorkSpaceRole.Member) ? "Member" : (m.Role == WorkSpaceRole.Admin) ? "Admin" : "Owner"
						})
					})
					.ToListAsync();

				return Results.Ok(workspaces);
			}).RequireAuthorization()
				.WithSummary("Returns a list of workspaces the user is a member of").WithTags("Workspace Management");

			//returns the details of a workpsace using publicId
			app.MapGet("/workspace/info/{publicId}", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, string publicId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null)
				{
					return Results.BadRequest("Id not found");
				}

				var user = await db.Users.FindAsync(userId);

				if (user == null)
				{
					return Results.BadRequest("User not found");
				}

				var workspace = await db.Workspaces
					.Include(w => w.Members)
						.ThenInclude(m => m.User)
					.Include(w => w.Invitations)
						.ThenInclude(i => i.User)
					.FirstOrDefaultAsync(w => w.PublicId.ToString() == publicId && w.IsDeleted == false);

				if (workspace == null)
				{
					return Results.NotFound("Workspace not found");
				}

				if (!workspace.Members.Any(m => m.UserId == userId))
				{
					return Results.BadRequest("You are not a member of this workspace");
				}

				var owner = workspace.Members.FirstOrDefault(m => m.Role == WorkSpaceRole.Owner);

				if (owner is null)
				{
					return Results.BadRequest("Owner not found");
				}

				var membersWithoutOwner = workspace.Members
					.Where(m => m.UserId != owner.UserId)
					.ToList();

				var invitations = workspace.Invitations.Where(m => m.isAccepted == false).ToList();

				if (owner.UserId == userId)
				{
					var full_workpace = new workspaceDto.FullWorkspace
					{
						Id = workspace.Id,
						PublicId = workspace.PublicId.ToString(),
						Title = workspace.Title,
						Description = workspace.Description,
						CreatedAt = (DateOnly)workspace.CreatedAt!,
						JoinCode = workspace.JoinCode,
						Owner = new workspaceDto.FullWorkspaceMember
						{
							Id = owner.UserId!,
							UserName = owner.User!.UserName!,
							Email = owner.User!.Email,
							Role = WorkSpaceRole.Owner,
							ProfilePictureUrl = owner.User!.ProfilePictureUrl!
						},
						Members = membersWithoutOwner.Select(m => new workspaceDto.FullWorkspaceMember
						{
							Id = m.UserId!,
							UserName = m.User!.UserName!,
							Email = m.User.Email,
							Role = m.Role,
							ProfilePictureUrl = m.User!.ProfilePictureUrl!
						}).ToList(),
						Invitations = invitations.Select(m => new workspaceDto.FullWorkspaceInvitations
						{
							Id = m.Id,
							UserName = m.User?.UserName!,
							Emial = m.User?.Email,
							Role = WorkSpaceRole.Member,
							ProfilePictureUrl = m.User?.ProfilePictureUrl,
							CreatedAt = m.CreatedAt,
							isAccepted = m.isAccepted
						}).ToList()
					};

					return Results.Ok(full_workpace);
				}
				else
				{
					var full_workpace = new workspaceDto.FullWorkspace
					{
						Id = workspace.Id,
						PublicId = workspace.PublicId.ToString(),
						Title = workspace.Title,
						Description = workspace.Description,
						CreatedAt = (DateOnly)workspace.CreatedAt!,
						JoinCode = workspace.JoinCode,
						Owner = new workspaceDto.FullWorkspaceMember
						{
							Id = owner.UserId!,
							UserName = owner.User!.UserName!,
							Email = owner.User!.Email,
							Role = WorkSpaceRole.Owner,
							ProfilePictureUrl = owner.User!.ProfilePictureUrl!
						},
						Members = membersWithoutOwner.Select(m => new workspaceDto.FullWorkspaceMember
						{
							Id = m.UserId!,
							UserName = m.User!.UserName!,
							Email = m.User.Email,
							Role = m.Role,
							ProfilePictureUrl = m.User!.ProfilePictureUrl!
						}).ToList()
					};

					return Results.Ok(full_workpace);
				}


			}).RequireAuthorization().WithSummary("Returns full info on workspace based on publicId").WithTags("Workspace Management");

			//returns the list of possible users user might be searching
			app.MapGet("/search/members", [Authorize] async (ClaimsPrincipal userClaims, HttpContext httpContext, UserManager<ApplicationUser> userManager) =>
			{
				var query = httpContext.Request.Query["query"].ToString();

				if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
				{
					return Results.Ok(new List<object>());
				}

				var currentUserId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				var possibleUsers = await userManager.Users
					.Where(u =>
						(EF.Functions.Like(u.Email!, $"%{query}%") || EF.Functions.Like(u.UserName!, $"%{query}%"))
						&& u.Id != currentUserId
					)
					.Select(u => new
					{
						u.UserName,
						u.Email,
						u.ProfilePictureUrl
					})
					.Take(10)
					.ToListAsync();

				return Results.Ok(possibleUsers);
			})
			.RequireAuthorization()
			.WithSummary("Returns a list of possible users you might be searching for")
			.WithTags("Workspace Management");

			//remove the whole workspace
			app.MapDelete("/delete/workspace/{publicId}", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, string publicId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null) return Results.BadRequest("User id not found");

				var workspace = await db.Workspaces
					.Include(w => w.Members)
						.ThenInclude(w => w.User)
						.FirstOrDefaultAsync(w => w.PublicId.ToString() == publicId);

				if (workspace is null) return Results.BadRequest("Workspace not found");

				if (workspace.OwnerId != userId) return Results.Forbid();

				if (workspace.IsDeleted) return Results.BadRequest("Already deleted");

				workspace.IsDeleted = true;

				await db.SaveChangesAsync();

				return Results.Ok("Ok");

			}).RequireAuthorization().WithSummary("Soft delete on the workspace").WithTags("Workspace Management");

			//remove member from the workspace
			app.MapDelete("/workspace/{publicId}/members/{userId}", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, string publicId, string userId) =>
			{
				var currentUserId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (currentUserId is null) return Results.BadRequest("User id not found");

				var workspace = await db.Workspaces
					.Include(w => w.Members)
					.Include(w => w.Channels)
						.ThenInclude(w => w.Members)
					.Include(w => w.Conversations)
					.FirstOrDefaultAsync(w => w.PublicId.ToString() == publicId);

				if (workspace is null) return Results.BadRequest("Workspace is not found");

				if (workspace.OwnerId != currentUserId) return Results.Forbid();

				if (workspace.OwnerId == userId) return Results.BadRequest("Can't remove owner");

				var member = workspace.Members.FirstOrDefault(m => m.UserId == userId);

				if (member is null) return Results.BadRequest("User not in the workspace");

				workspace.Members.Remove(member);

				foreach (var channel in workspace.Channels)
				{
					var channelMember = channel.Members!.FirstOrDefault(c => c.UserId == userId);
					if (channelMember != null)
					{
						channel.Members!.Remove(channelMember);
					}
				}

				foreach (var convo in workspace.Conversations)
				{
					var convoMember = convo.Members!.FirstOrDefault(m => m.UserId == userId);
					if (convoMember != null)
						convo.Members!.Remove(convoMember);
				}

				var invitations = db.WorkspaceInvitations.Where(i => i.UserId == userId && i.WorkspaceId == workspace.Id);

				db.WorkspaceInvitations.RemoveRange(invitations);

				await db.SaveChangesAsync();

				return Results.Ok("User removed from workspace");

			}).RequireAuthorization().WithSummary("Removes member from the workspace").WithTags("Workspace Management");

			//--------------------------------------------------JoinCode-----------------------------------------------------//
			//user joins into workspace using a special code
			app.MapPost("/join/workspace", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, JoinCodeDTO model) =>
			{
				if (string.IsNullOrEmpty(model.join_code))
				{
					return Results.BadRequest("Invalid code");
				}

				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null) return Results.BadRequest("User id not found");

				var user = await userManager.FindByIdAsync(userId);

				if (user is null) return Results.BadRequest("User not found");

				var workspace = await db.Workspaces
					.Include(w => w.Members)
					.FirstOrDefaultAsync(j => j.JoinCode == model.join_code && j.IsDeleted == false);

				if (workspace is null) return Results.BadRequest("Woorkspace with this code does not exist");

				var isMember = await db.WorkspaceMembers
					   .AnyAsync(m => m.UserId == userId && m.WorkspaceId == workspace.Id);

				if (isMember)
					return Results.BadRequest("Already a member");


				var alreadyRequested = await db.WorkspaceInvitations
					.AnyAsync(i => i.UserId == userId && i.WorkspaceId == workspace.Id);

				if (alreadyRequested)
					return Results.BadRequest("Already requested");

				var invitation = new WorkspaceInvitation
				{
					UserId = userId,
					WorkspaceId = workspace.Id,
					CreatedAt = DateOnly.FromDateTime(DateTime.UtcNow),
					isAccepted = false
				};

				await db.AddAsync(invitation);
				await db.SaveChangesAsync();

				return Results.Ok("Request sent. Waiting for approval.");

			}).RequireAuthorization().WithSummary("User asks to join the workspace by enterning a code").WithTags("Workspace Management");

			//when joining with link it sends invitation
			app.MapPost("/workspace/join/link/{publicId}", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, string publicId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null)
					return Results.BadRequest("User not found");

				var user = await db.Users.FindAsync(userId);
				if (user is null)
					return Results.BadRequest("User not found");

				var workspace = await db.Workspaces
					.Include(w => w.Members)
					.FirstOrDefaultAsync(w => w.PublicId.ToString() == publicId);

				if (workspace is null)
					return Results.NotFound("Workspace not found");

				var isMember = workspace.Members.Any(m => m.UserId == userId);
				if (isMember)
					return Results.BadRequest("Already a member");

				var alreadyRequested = await db.WorkspaceInvitations
					.AnyAsync(i => i.UserId == userId && i.WorkspaceId == workspace.Id);

				if (alreadyRequested)
					return Results.BadRequest("Already requested");

				var invitation = new WorkspaceInvitation
				{
					UserId = userId,
					WorkspaceId = workspace.Id,
					isAccepted = false,
					CreatedAt = DateOnly.FromDateTime(DateTime.UtcNow)
				};

				await db.WorkspaceInvitations.AddAsync(invitation);
				await db.SaveChangesAsync();

				return Results.Ok(new
				{
					message = "Join request sent",
					workspace = workspace.Title
				});

			}).RequireAuthorization()
			.WithSummary("Join workspace via invite link")
			.WithTags("Workspace Management");

			//regenerating the workspace join code
			app.MapPost("/regenerating/join_code", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, string publicId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null) return Results.BadRequest("User id not found");

				var user = await userManager.FindByIdAsync(userId);

				if (user is null) return Results.BadRequest("User not found");

				var workspace = await db.Workspaces
					.Include(w => w.Members)
					.FirstOrDefaultAsync(w => w.PublicId.ToString() == publicId);

				if (workspace is null) return Results.BadRequest("Workspace not found");

				if (workspace.OwnerId != userId) return Results.Forbid();

				workspace.JoinCode = WorkspaceAuthorization.GenerateJoinCode();

				await db.SaveChangesAsync();

				return Results.Ok("JoinCode changed to " + workspace.JoinCode);

			}).RequireAuthorization().WithSummary("Regenerates the join code in the workspace").WithTags("Workspace Management");

			//-----------------------------------------------Invitations--------------------------------------------------//
			//returns the invitations in a workspace based on the publicid
			app.MapGet("/workspaces/{publicId}/invitations", [Authorize] async (AppDbContext db, string publicId, ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null) return Results.BadRequest("User id not found");

				var user = await userManager.FindByIdAsync(userId);
				if (user is null) return Results.BadRequest("User not found");

				var workspace = await db.Workspaces
					.Include(w => w.Invitations)
						.ThenInclude(i => i.User)
					.FirstOrDefaultAsync(w => w.PublicId.ToString() == publicId);

				if (workspace is null) return Results.BadRequest("Workspace not found");

				if (workspace.OwnerId != userId) return Results.Forbid();

				var invitations = workspace.Invitations
					.Where(i => i.isAccepted == false)
					.Select(i => new
					{
						i.UserId,
						UserName = i.User?.UserName,
						Email = i.User?.Email,
						ProfilePicturtUrl = i.User?.ProfilePictureUrl,
						i.isAccepted
					})
					.ToList();

				return Results.Ok(invitations);

			}).RequireAuthorization().WithSummary("Returns all pending invitations for the owner").WithTags("Workspace Management");

			//accepts or rejects the invitation to the workspace based on the action provided in the request body. If the action is accept, it adds the user to the workspace members and removes the invitation. If the action is reject, it just removes the invitation. Only the owner of the workspace can accept or reject invitations.
			app.MapPost("/workspace/invitations/{invitationId}", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, int invitationId, InvitationActionDto model) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null)
					return Results.BadRequest("User id not found");

				var invitation = await db.WorkspaceInvitations
					.Include(i => i.WorkSpace)
					.FirstOrDefaultAsync(i => i.Id == invitationId);

				if (invitation is null)
					return Results.NotFound("Invitation not found");

				if (invitation.WorkSpace?.OwnerId != userId)
					return Results.Forbid();

				var action = model.Action?.ToLower();

				if (action == "accept")
				{
					var isMember = await db.WorkspaceMembers
						.AnyAsync(m => m.UserId == invitation.UserId && m.WorkspaceId == invitation.WorkspaceId);

					if (!isMember)
					{
						await db.WorkspaceMembers.AddAsync(new WorkSpaceMember
						{
							UserId = invitation.UserId,
							WorkspaceId = invitation.WorkspaceId,
							Role = WorkSpaceRole.Member
						});
					}

					db.WorkspaceInvitations.Remove(invitation);

					await db.SaveChangesAsync();

					return Results.Ok("Invitation accepted");
				}
				else if (action == "reject")
				{
					db.WorkspaceInvitations.Remove(invitation);

					await db.SaveChangesAsync();

					return Results.Ok("Invitation rejected");
				}

				return Results.BadRequest("Invalid action. Use 'accept' or 'reject'");

			}).RequireAuthorization()
			.WithSummary("Accepts or rejects a workspace invitation")
			.WithTags("Workspace Management");


			//----------------------------------------------Members management------------------------------------------------//
			//changing the role of a user in the workspace
			app.MapPost("/workspace/change-role", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, ChangeRoleDto model) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null) return Results.BadRequest("User id not found");

				var user = await userManager.FindByIdAsync(userId);

				if (user == null) return Results.BadRequest("User not found");

				var workspace = await db.Workspaces
					.Include(w => w.Members)
					.FirstOrDefaultAsync(w => w.PublicId.ToString() == model.PublicId);

				if (workspace == null) return Results.BadRequest("Workspace not found");

				if (workspace.OwnerId != userId) return Results.Forbid();

				var member = workspace.Members.FirstOrDefault(m => m.UserId == model.UserId);

				if (member == null) return Results.BadRequest("User is not a member of the workspace");

				if (member.UserId == workspace.OwnerId) return Results.BadRequest("Can't change role of the owner");

				member.Role = model.Role switch
				{
					0 => WorkSpaceRole.Member,
					1 => WorkSpaceRole.Admin,
					_ => WorkSpaceRole.Member
				};

				await db.SaveChangesAsync();

				return Results.Ok("User role updated");
			}).RequireAuthorization().WithSummary("Changes the role of a user in the workspace").WithTags("Workspace Management");

			//add new member to the workspace by the owner
			app.MapPost("/workspace/add-member", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, AddMemberDto model) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null) return Results.BadRequest("User id not found");

				var user = await userManager.FindByIdAsync(userId);

				if (user == null) return Results.BadRequest("User not found");

				var workspace = await db.Workspaces
					.Include(w => w.Members)
					.FirstOrDefaultAsync(w => w.PublicId.ToString() == model.PublicId);

				if (workspace == null) return Results.BadRequest("Workspace not found");

				if (workspace.OwnerId != userId) return Results.Forbid();

				var memberUser = await userManager.FindByEmailAsync(model.EmailOrUsername)
								?? await userManager.FindByNameAsync(model.EmailOrUsername);

				if (memberUser == null) return Results.BadRequest("User not found");

				if (memberUser.Id == userId) return Results.BadRequest("Can't add yourself");

				var isMember = workspace.Members.Any(m => m.UserId == memberUser.Id);

				if (isMember) return Results.BadRequest("User is already a member");

				workspace.Members.Add(new WorkSpaceMember
				{
					UserId = memberUser.Id,
					Role = model.Role switch
					{
						0 => WorkSpaceRole.Member,
						1 => WorkSpaceRole.Admin,
						_ => WorkSpaceRole.Member
					}
				});

				await db.SaveChangesAsync();

				return Results.Ok("User added to workspace");

			}).RequireAuthorization().WithSummary("Adds a new member to the workspace by the owner").WithTags("Workspace Management");
		}

		public static void TaskEndpoints(WebApplication app)
		{
			//creates a new task 
			app.MapPost("/create/tasks", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, taskDTO.CreateTaskItemDTO data, IHubContext<TaskHub> hb, IHttpClientFactory httpClientFactory, IConfiguration config) =>
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

				var workspace = await db.Workspaces
					.Include(w => w.Members)
					.FirstOrDefaultAsync(w => w.Id == data.WorkspaceId);

				if (workspace == null)
				{
					return Results.BadRequest("Workspace not found");
				}

				if (!workspace.Members.Any(m => m.UserId == userId))
				{
					return Results.BadRequest("You are not a member of this workspace");
				}

				var automationTagNames = await GetAutomationTagNamesAsync(db, data);
				var selectedTagIds = data.TagIds ?? new List<int>();
				var newTagNames = data.NewTags ?? new List<string>();
				var isDifficultyMissing = !data.Difficulty.HasValue;
				var areTagsMissing = selectedTagIds.Count == 0 && newTagNames.Count == 0;
				var arePointsMissing = !data.Points.HasValue || data.Points <= 0;
				TaskAutomationResult? automationResult = null;

				if (isDifficultyMissing || areTagsMissing || arePointsMissing)
				{
					Console.WriteLine("Calling task automation because task metadata was not fully provided.");
					automationResult = await GetTaskAutomationAsync(httpClientFactory, config, data, automationTagNames);
				}

				var taskDifficulty = data.Difficulty
					?? automationResult?.Difficulty
					?? TaskDifficulty.Easy;

				var taskPoints = data.Points ?? 0;

				if (arePointsMissing && automationResult?.Points is > 0)
				{
					taskPoints = automationResult.Points.Value;
				}

				if (areTagsMissing && automationResult?.Tags?.Count > 0)
				{
					newTagNames = automationResult.Tags;
				}

				var task = new TaskItem
				{
					Title = data.Title,
					Description = data.Description,
					DueDate = data.DueDate,
					StartDate = data.StartDate,
					Status = data.Status,
					Difficulty = taskDifficulty,
					Points = taskPoints,
					WorkSpaceId = data.WorkspaceId
				};

				if (task.Points == 0)
				{
					Console.WriteLine("Task automation did not return usable points. Falling back to default difficulty points.");
					task.Points = GetDefaultPoints(task.Difficulty);
				}

				db.Tasks.Add(task);
				await db.SaveChangesAsync();

				if (data.AssignedUserIds != null && data.AssignedUserIds.Count > 0)
				{
					foreach (var assignedUserId in data.AssignedUserIds)
					{
						var assignedUser = await userManager.FindByIdAsync(assignedUserId);
						if (assignedUser != null && workspace.Members.Any(m => m.UserId == assignedUserId))
						{
							db.TaskAssignments.Add(new TaskAssignment
							{
								TaskItemId = task.Id,
								UserId = assignedUserId
							});
						}
					}

					await db.SaveChangesAsync();
				}

				//tags logic
				var taskTags = new List<TaskItemTag>();

				if (selectedTagIds.Count > 0)
				{
					foreach (var tagId in selectedTagIds)
					{
						var tagExists = await db.Tags
							.AnyAsync(t => t.Id == tagId && t.WorkSpaceId == data.WorkspaceId);

						if (tagExists)
						{
							taskTags.Add(new TaskItemTag
							{
								TaskItemId = task.Id,
								TagId = tagId
							});
						}
					}
				}

				if (newTagNames.Count > 0)
				{
					foreach (var tagName in newTagNames
						.Where(tag => !string.IsNullOrWhiteSpace(tag))
						.Select(tag => tag.Trim())
						.Distinct(StringComparer.OrdinalIgnoreCase))
					{
						var existingTag = await db.Tags
							.FirstOrDefaultAsync(t =>
								t.Name == tagName &&
								t.WorkSpaceId == data.WorkspaceId);

						if (existingTag == null)
						{
							existingTag = new Tag
							{
								Name = tagName,
								WorkSpaceId = data.WorkspaceId
							};

							db.Tags.Add(existingTag);
							await db.SaveChangesAsync();
						}

						taskTags.Add(new TaskItemTag
						{
							TaskItemId = task.Id,
							TagId = existingTag.Id
						});
					}
				}

				if (taskTags.Count > 0)
				{
					await db.TaskItemTags.AddRangeAsync(taskTags);
					await db.SaveChangesAsync();
				}

				var tags = await db.TaskItemTags
					.Where(tt => tt.TaskItemId == task.Id)
					.Include(tt => tt.Tag)
					.Select(tt => new
					{
						tt.Tag!.Id,
						tt.Tag.Name
					})
					.ToListAsync();

				Console.WriteLine("🔥 Sending taskCreated event");

				await hb.Clients
					.Group(task.WorkSpace!.PublicId.ToString())
					.SendAsync("taskCreated", new
					{
						task.PublicId,
						task.Title,
						task.Description,
						task.DueDate,
						task.StartDate,
						task.Points,
						Status = task.Status.ToString(),
						Difficulty = task.Difficulty,
						Tags = tags
					});

				return Results.Ok(new
				{
					task.PublicId,
					task.Title,
					task.Description,
					task.DueDate,
					task.StartDate,
					task.Points,
					Status = task.Status.ToString(),
					Difficulty = task.Difficulty,
					Tags = tags
				});
			}).RequireAuthorization()
				.WithSummary("Creates a new task").WithTags("Task Management");

			//get all tasks in workspace
			app.MapGet("/tasks/{workspaceId}", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, string workspaceId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null)
					return Results.BadRequest("Id not found");

				var workspace = await db.Workspaces
					.Where(w => w.PublicId.ToString() == workspaceId)
					.Select(w => new
					{
						w.Id,
						IsMember = w.Members.Any(m => m.UserId == userId)
					})
					.FirstOrDefaultAsync();

				if (workspace == null)
					return Results.BadRequest("Workspace not found");

				if (!workspace.IsMember)
					return Results.BadRequest("You are not a member of this workspace");

				var tasks = await db.Tasks
					.Where(t => t.WorkSpaceId == workspace.Id && t.IsDeleted == false)
					.Include(t => t.Assignments!)
						.ThenInclude(a => a.User)
					.Include(t => t.TaskItemTags!)
						.ThenInclude(tt => tt.Tag)
					.OrderByDescending(t => t.StartDate)
					.Select(t => new
					{
						t.PublicId,
						t.Title,
						t.Description,
						t.DueDate,
						t.StartDate,
						t.UpadeAt,
						t.Points,

						Status = t.DueDate < DateTime.UtcNow && t.Status != TasksStatus.Done
							? "Overdue"
							: t.Status.ToString(),

						Difficulty = t.Difficulty,

						AssignedUsers = t.Assignments!.Select(a => new
						{
							a.User!.UserName,
							a.User.Email,
							a.User.ProfilePictureUrl
						}).ToList(),

						Tags = t.TaskItemTags!.Select(tt => new
						{
							tt.Tag!.Id,
							tt.Tag.Name
						}).ToList()
					})
					.ToListAsync();

				return Results.Ok(tasks);
			}).RequireAuthorization()
				.WithSummary("Get all tasks in workspace").WithTags("Task Management");

			//edit tasks
			app.MapPut("/edit/tasks/{taskid}", [Authorize] async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				UserManager<ApplicationUser> userManager,
				string taskid,
				EditTaskDTO dto,
				IHubContext<TaskHub> hub) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId == null)
					return Results.BadRequest("User Id not found");

				var task = await db.Tasks
					.Include(t => t.WorkSpace)
						.ThenInclude(w => w!.Members)
					.Include(t => t.Assignments!)
						.ThenInclude(a => a.User)
					.FirstOrDefaultAsync(t => t.PublicId.ToString() == taskid);

				if (task == null)
					return Results.BadRequest("Task not found");

				var member = task.WorkSpace!.Members.FirstOrDefault(m => m.UserId == userId);
				if (member == null)
					return Results.BadRequest("You are not part of this workspace");

				if (member.Role != WorkSpaceRole.Owner && member.Role != WorkSpaceRole.Admin)
					return Results.BadRequest("You don't have permission to edit this task");

				if (!string.IsNullOrWhiteSpace(dto.Title))
					task.Title = dto.Title;

				if (dto.Description != null)
					task.Description = dto.Description;

				task.StartDate = dto.StartDate;
				task.Points = dto.Points;

				if (task.Points == 0)
				{
					if (task.Difficulty == TaskDifficulty.Easy) task.Points = 50;
					if (task.Difficulty == TaskDifficulty.Medium) task.Points = 75;
					if (task.Difficulty == TaskDifficulty.Hard) task.Points = 100;
					if (task.Difficulty == TaskDifficulty.VeryHard) task.Points = 150;
				}

				task.Status = (TasksStatus)dto.Status!;

				if (dto.Difficulty.HasValue)
					task.Difficulty = dto.Difficulty.Value;

				if (dto.AssignedUsers != null)
				{
					db.TaskAssignments.RemoveRange(task.Assignments!);

					var workspaceUserIds = task.WorkSpace.Members
						.Select(m => m.UserId)
						.ToList();

					var users = await userManager.Users
						.Where(u =>
							(dto.AssignedUsers.Contains(u.Email!) ||
							 dto.AssignedUsers.Contains(u.UserName!)) &&
							workspaceUserIds.Contains(u.Id))
						.ToListAsync();

					var newAssignments = users.Select(u => new TaskAssignment
					{
						UserId = u.Id,
						TaskItemId = task.Id
					}).ToList();

					await db.TaskAssignments.AddRangeAsync(newAssignments);
				}

				task.UpadeAt = DateTime.UtcNow;

				await db.SaveChangesAsync();

				await hub.Clients
					.Group(task.WorkSpace.PublicId.ToString())
					.SendAsync("taskUpdated", new
					{
						task.PublicId,
						task.Title,
						Status = task.Status.ToString(),
						task.Points
					});

				return Results.Ok(new
				{
					message = "Task updated successfully",
					task.PublicId,
					task.Title,
					task.Status
				});
			}).RequireAuthorization()
				.WithSummary("Edit task by public Id").WithTags("Task Management");

			//delete task
			app.MapDelete("/delete/task/{taskId}", async (AppDbContext db, ClaimsPrincipal userClaims, string taskId, IHubContext<TaskHub> hub) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null) return Results.BadRequest("User id not found");

				var task = await db.Tasks
					.Include(t => t.Assignments!)
						.ThenInclude(t => t.User)
					.Include(w => w.WorkSpace)
					.FirstOrDefaultAsync(t => t.PublicId.ToString() == taskId);

				if (task is null) return Results.BadRequest("Task not found");

				if (task.WorkSpace!.OwnerId != userId) return Results.Forbid();

				if (task.IsDeleted)
				{
					return Results.Ok();
				}

				task.IsDeleted = true;

				foreach (var item in task.Assignments!)
				{
					item.IsDeleted = true;
				}

				await db.SaveChangesAsync();

				await hub.Clients
					.Group(task.WorkSpace.PublicId.ToString())
					.SendAsync("taskDeleted", new
					{
						task.PublicId
					});

				return Results.Ok();
			}).RequireAuthorization().WithSummary("Soft delete a task by it's id").WithTags("Task Management");

			//change task status
			app.MapPut("/task/status/{taskId}", async (AppDbContext db, ClaimsPrincipal userClaims, string taskId, TaskStatusChangeAction data, IHubContext<TaskHub> hub) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null) return Results.BadRequest("User id not found");

				var task = await db.Tasks
					.Include(t => t.Assignments!)
						.ThenInclude(t => t.User)
					.Include(t => t.WorkSpace)
						.FirstOrDefaultAsync(t => t.PublicId.ToString() == taskId && t.IsDeleted == false);

				if (task is null) return Results.BadRequest("Task not found");

				if (task.WorkSpace!.OwnerId == userId || task.Assignments!.Any(t => t.UserId == userId))
				{
					task.Status = (TasksStatus)data.status;

					await db.SaveChangesAsync();

					await hub.Clients
						.Group(task.WorkSpace.PublicId.ToString())
						.SendAsync("taskStatusChanged", new
						{
							task.PublicId,
							Status = task.Status.ToString()
						});

					return Results.Ok("Successfully changed " + task.Status);
				}
				else
				{
					return Results.Forbid();
				}

			}).RequireAuthorization().WithSummary("Change task status").WithTags("Task Management");
		}

		private const string DefaultPointsWebhookUrl = "http://localhost:5678/webhook/e5d4d98f-879e-474d-9a7b-0d4ccf91d728";

		private static async Task<List<string>> GetAutomationTagNamesAsync(AppDbContext db, taskDTO.CreateTaskItemDTO data)
		{
			var tagNames = new List<string>();

			if (data.TagIds?.Count > 0)
			{
				var existingTagNames = await db.Tags
					.Where(t => data.TagIds.Contains(t.Id) && t.WorkSpaceId == data.WorkspaceId)
					.Select(t => t.Name)
					.ToListAsync();

				tagNames.AddRange(existingTagNames);
			}

			if (data.NewTags?.Count > 0)
			{
				tagNames.AddRange(data.NewTags);
			}

			return tagNames
				.Where(tag => !string.IsNullOrWhiteSpace(tag))
				.Select(tag => tag.Trim())
				.Distinct(StringComparer.OrdinalIgnoreCase)
				.ToList();
		}

		#region AIAutomatization
		private static async Task<TaskAutomationResult?> GetTaskAutomationAsync( IHttpClientFactory httpClientFactory,
			IConfiguration config,
			taskDTO.CreateTaskItemDTO data,
			List<string> tagNames)
		{
			var webhookUrl = config["Automations:PointsWebhookUrl"] ?? DefaultPointsWebhookUrl;

			if (string.IsNullOrWhiteSpace(webhookUrl))
			{
				return null;
			}

			var payload = new
			{
				title = data.Title,
				description = data.Description,
				tags = tagNames,
				difficulty = ToAutomationDifficulty(data.Difficulty),
				numberOfDevs = data.AssignedUserIds?.Distinct().Count() ?? 0
			};

			try
			{
				var client = httpClientFactory.CreateClient();
				client.Timeout = TimeSpan.FromSeconds(10);

				Console.WriteLine($"Sending points automation webhook to {webhookUrl}");
				using var response = await client.PostAsJsonAsync(webhookUrl, payload);
				var content = await response.Content.ReadAsStringAsync();

				Console.WriteLine($"Points automation response: {(int)response.StatusCode} {response.ReasonPhrase}. Body: {content}");

				if (!response.IsSuccessStatusCode)
				{
					return null;
				}

				return TryReadAutomationResult(content);
			}
			catch (HttpRequestException ex)
			{
				Console.WriteLine($"Points automation request failed: {ex.Message}");
				return null;
			}
			catch (TaskCanceledException ex)
			{
				Console.WriteLine($"Points automation request timed out: {ex.Message}");
				return null;
			}
			catch (JsonException ex)
			{
				Console.WriteLine($"Points automation returned an unsupported response body: {ex.Message}");
				return null;
			}
		}

		private static string? ToAutomationDifficulty(TaskDifficulty? difficulty)
		{
			return difficulty switch
			{
				TaskDifficulty.Easy => "easy",
				TaskDifficulty.Medium => "medium",
				TaskDifficulty.Hard => "high",
				TaskDifficulty.VeryHard => "very high",
				_ => null
			};
		}

		private static int GetDefaultPoints(TaskDifficulty difficulty)
		{
			return difficulty switch
			{
				TaskDifficulty.Easy => 50,
				TaskDifficulty.Medium => 75,
				TaskDifficulty.Hard => 100,
				TaskDifficulty.VeryHard => 150,
				_ => 50
			};
		}

		private static TaskAutomationResult? TryReadAutomationResult(string content)
		{
			if (int.TryParse(content, out var rawPoints))
			{
				return new TaskAutomationResult { Points = rawPoints };
			}

			using var document = JsonDocument.Parse(content);
			return TryReadAutomationResult(document.RootElement);
		}

		private static TaskAutomationResult? TryReadAutomationResult(JsonElement element)
		{
			if (element.ValueKind == JsonValueKind.Array)
			{
				foreach (var item in element.EnumerateArray())
				{
					var itemResult = TryReadAutomationResult(item);
					if (itemResult is not null)
					{
						return itemResult;
					}
				}

				return null;
			}

			if (element.ValueKind != JsonValueKind.Object)
			{
				var points = TryReadPoints(element);
				return points > 0 ? new TaskAutomationResult { Points = points } : null;
			}

			var result = new TaskAutomationResult
			{
				Points = TryReadPoints(element),
				Difficulty = TryReadDifficulty(element),
				Tags = TryReadTags(element)
			};

			return result.Points.HasValue || result.Difficulty.HasValue || result.Tags.Count > 0
				? result
				: null;
		}

		private static int TryReadPoints(JsonElement element)
		{
			if (element.ValueKind == JsonValueKind.Number && element.TryGetInt32(out var numberPoints))
			{
				return numberPoints;
			}

			if (element.ValueKind == JsonValueKind.String && int.TryParse(element.GetString(), out var stringPoints))
			{
				return stringPoints;
			}

			if (element.ValueKind == JsonValueKind.Array)
			{
				foreach (var item in element.EnumerateArray())
				{
					var itemPoints = TryReadPoints(item);
					if (itemPoints > 0)
					{
						return itemPoints;
					}
				}
			}

			if (element.ValueKind == JsonValueKind.Object)
			{
				foreach (var propertyName in new[] { "points", "Points", "score", "Score", "output", "Output" })
				{
					if (!element.TryGetProperty(propertyName, out var property))
					{
						continue;
					}

					var propertyPoints = TryReadPoints(property);
					if (propertyPoints > 0)
					{
						return propertyPoints;
					}
				}
			}

			return 0;
		}

		private static TaskDifficulty? TryReadDifficulty(JsonElement element)
		{
			foreach (var propertyName in new[] { "difficulty", "Difficulty" })
			{
				if (!element.TryGetProperty(propertyName, out var property))
				{
					continue;
				}

				if (property.ValueKind == JsonValueKind.String)
				{
					return ParseAutomationDifficulty(property.GetString());
				}
			}

			foreach (var propertyName in new[] { "output", "Output" })
			{
				if (!element.TryGetProperty(propertyName, out var property))
				{
					continue;
				}

				var nestedDifficulty = TryReadDifficultyFromNestedValue(property);
				if (nestedDifficulty.HasValue)
				{
					return nestedDifficulty;
				}
			}

			return null;
		}

		private static TaskDifficulty? TryReadDifficultyFromNestedValue(JsonElement element)
		{
			if (element.ValueKind == JsonValueKind.String)
			{
				var rawValue = element.GetString();
				if (string.IsNullOrWhiteSpace(rawValue))
				{
					return null;
				}

				var parsedDifficulty = ParseAutomationDifficulty(rawValue);
				if (parsedDifficulty.HasValue)
				{
					return parsedDifficulty;
				}

				try
				{
					using var nestedDocument = JsonDocument.Parse(rawValue);
					return TryReadDifficulty(nestedDocument.RootElement);
				}
				catch (JsonException)
				{
					return null;
				}
			}

			if (element.ValueKind == JsonValueKind.Object)
			{
				return TryReadDifficulty(element);
			}

			if (element.ValueKind == JsonValueKind.Array)
			{
				foreach (var item in element.EnumerateArray())
				{
					var nestedDifficulty = TryReadDifficultyFromNestedValue(item);
					if (nestedDifficulty.HasValue)
					{
						return nestedDifficulty;
					}
				}
			}

			return null;
		}

		private static TaskDifficulty? ParseAutomationDifficulty(string? value)
		{
			return value?.Trim().ToLowerInvariant() switch
			{
				"low" or "easy" => TaskDifficulty.Easy,
				"medium" or "med" => TaskDifficulty.Medium,
				"high" or "hard" => TaskDifficulty.Hard,
				"very high" or "veryhard" or "very hard" => TaskDifficulty.VeryHard,
				_ => null
			};
		}

		private static List<string> TryReadTags(JsonElement element)
		{
			foreach (var propertyName in new[] { "tags", "Tags" })
			{
				if (!element.TryGetProperty(propertyName, out var property))
				{
					continue;
				}

				if (property.ValueKind == JsonValueKind.Array)
				{
					return property
						.EnumerateArray()
						.Where(item => item.ValueKind == JsonValueKind.String)
						.Select(item => item.GetString()?.Trim())
						.Where(tag => !string.IsNullOrWhiteSpace(tag))
						.Cast<string>()
						.Distinct(StringComparer.OrdinalIgnoreCase)
						.ToList();
				}
			}

			foreach (var propertyName in new[] { "output", "Output" })
			{
				if (!element.TryGetProperty(propertyName, out var property))
				{
					continue;
				}

				var nestedTags = TryReadTagsFromNestedValue(property);
				if (nestedTags.Count > 0)
				{
					return nestedTags;
				}
			}

			return new List<string>();
		}

		private static List<string> TryReadTagsFromNestedValue(JsonElement element)
		{
			if (element.ValueKind == JsonValueKind.Object)
			{
				return TryReadTags(element);
			}

			if (element.ValueKind == JsonValueKind.Array)
			{
				var tags = new List<string>();

				foreach (var item in element.EnumerateArray())
				{
					if (item.ValueKind == JsonValueKind.String)
					{
						var tag = item.GetString()?.Trim();
						if (!string.IsNullOrWhiteSpace(tag))
						{
							tags.Add(tag);
						}

						continue;
					}

					tags.AddRange(TryReadTagsFromNestedValue(item));
				}

				return tags
					.Distinct(StringComparer.OrdinalIgnoreCase)
					.ToList();
			}

			if (element.ValueKind == JsonValueKind.String)
			{
				var rawValue = element.GetString();
				if (string.IsNullOrWhiteSpace(rawValue))
				{
					return new List<string>();
				}

				try
				{
					using var nestedDocument = JsonDocument.Parse(rawValue);
					return TryReadTags(nestedDocument.RootElement);
				}
				catch (JsonException)
				{
					return new List<string>();
				}
			}

			return new List<string>();
		}

		private sealed class TaskAutomationResult
		{
			public int? Points { get; init; }
			public TaskDifficulty? Difficulty { get; init; }
			public List<string> Tags { get; init; } = new();
		}

		#endregion

		public static void ChatEndpoints(WebApplication app)
		{
			//---------------Channels-----------------------//
			//create mew channel in the workspace
			app.MapPost("/workspace/{workspaceId}/create/channels", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, int workspaceId, chatDto.CreateChatDTO model) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null) return Results.BadRequest();

				var isMember = await db.WorkspaceMembers
					.AnyAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId);

				if (!isMember)
					return Results.Forbid();

				var channel = new Channel
				{
					Name = model.Name,
					Description = model.Description,
					IsPrivate = model.IsPrivate,
					WorkspaceId = workspaceId,
					Members = new List<ChannelMember>()
				};

				if (channel.IsPrivate)
				{
					channel.Members.Add(new ChannelMember
					{
						UserId = userId
					});
				}

				await db.Channels.AddAsync(channel);
				await db.SaveChangesAsync();

				return Results.Ok(channel);
			}).RequireAuthorization().WithSummary("Creates new channel in the workspace").WithTags("Chat Management");

			//returns channels for workspace
			app.MapGet("/workspace/{workspaceId}/get/channels", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, int workspaceId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (userId is null) return Results.BadRequest("User id not found");

				// verify the user is in the workspace at all
				var isMember = await db.WorkspaceMembers
					.AnyAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId);

				if (!isMember) return Results.Forbid();

				var channels = await db.Channels
					.Where(c =>
						c.WorkspaceId == workspaceId &&
						(!c.IsPrivate || c.Members!.Any(m => m.UserId == userId)))
					.Select(c => new
					{
						c.PublicId,
						c.Name,
						c.Description,
						c.IsPrivate,
						// unread count for this user on this channel
						UnreadCount = db.Messages
							.Count(msg =>
								msg.ChannelId == c.Id &&
								msg.SenderId != userId &&
								msg.SentAt > db.ChannelMembers
									.Where(cm => cm.ChannelId == c.Id && cm.UserId == userId)
									.Select(cm => cm.LastSeen)
									.FirstOrDefault())
					})
					.ToListAsync();

				return Results.Ok(channels);
			}).RequireAuthorization().WithSummary("Returns all channels in the workspace").WithTags("Chat Management");

			//add members to private channel
			app.MapPost("/workspace/{publicId}/add_members/channel", [Authorize] async (AppDbContext db, int publicId, chatDto.AddChatMemberDTO model) =>
			{
				var channel = await db.Channels
					.Include(c => c.Members)
					.FirstOrDefaultAsync(c => c.Id == publicId);

				if (channel is null) return Results.BadRequest("Channel id is not found");

				var exists = channel.Members!
					.Any(m => m.UserId == model.UserId);

				if (exists) return Results.BadRequest("Already exists");

				channel.Members!.Add(new ChannelMember
				{
					ChannelId = channel.Id,
					UserId = model.UserId
				});

				await db.SaveChangesAsync();

				return Results.Ok("Member was correctly added");
			}).RequireAuthorization().WithSummary("Adds new member to a private chat").WithTags("Chat Management");

			//remove member from the channel
			app.MapDelete("/channels/{channelPublicId}/members/{userId}", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, string channelPublicId, string userId) =>
			{
				var currentUserId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);
				if (currentUserId == null) return Results.BadRequest("User not found");

				var channel = await db.Channels
					.Include(c => c.Members!)
					.ThenInclude(m => m.User)
					.Include(c => c.Workspace)
					.ThenInclude(w => w!.Members)
					.FirstOrDefaultAsync(c => c.PublicId.ToString() == channelPublicId);

				if (channel == null)
					return Results.NotFound("Channel not found");

				var isOwner = channel.Workspace!.Members
					.Any(m => m.UserId == currentUserId && m.Role == WorkSpaceRole.Owner);

				if (!isOwner && currentUserId != userId)
					return Results.Forbid();

				var member = channel.Members!
					.FirstOrDefault(m => m.UserId == userId);

				if (member == null)
					return Results.NotFound("User not in channel");

				channel.Members!.Remove(member);

				await db.SaveChangesAsync();

				return Results.Ok("Removed from channel");
			}).RequireAuthorization().WithSummary("Removes member from channel").WithTags("Chat Management");

			//--------------------------Messages--------------------------------//
			//returns all old messages
			app.MapGet("/channels/{publicId}/messages", [Authorize] async (AppDbContext db, string publicId) =>
			{
				var channel = await db.Channels.FirstOrDefaultAsync(c => c.PublicId.ToString() == publicId);

				if (channel is null) return Results.BadRequest("Channel not found");

				var messages = await db.Messages
					.Where(m => m.ChannelId == channel.Id)
					.Include(m => m.Sender)
					.OrderBy(m => m.SentAt)
					.Select(m => new
					{
						m.PublicId,
						m.Content,
						m.SentAt,
						SenderId = m.SenderId,
						Sender = new
						{
							m.Sender!.UserName,
							m.Sender!.ProfilePictureUrl
						}
					}).ToListAsync();

				if (messages is null || messages.Count <= 0) return Results.BadRequest("No messages found");

				return Results.Ok(messages);

			}).RequireAuthorization().WithSummary("Returns all messages that are stored in the database").WithTags("Chat Management");
		}

		public static void LeaderBoard(WebApplication app)
		{
			app.MapGet("/leaderboard/{workspaceId}", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, string workspaceId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null) return Results.BadRequest("User id not found");

				var workspace = await db.Workspaces
					.Include(w => w.Members)
						.ThenInclude(m => m.User)
					.Include(w => w.Tasks)
						.ThenInclude(t => t.Assignments)
					.FirstOrDefaultAsync(w => w.PublicId.ToString() == workspaceId);

				if (workspace is null) return Results.BadRequest("Workspace not found");

				if (!workspace.Members.Any(m => m.UserId == userId))
					return Results.BadRequest("You are not a member of this workspace");

				var totalTasks = workspace.Tasks.Count;

				var totalPoints = workspace.Tasks
					.Where(t => t.Status == TasksStatus.Done)
					.Sum(t => t.Points);

				var completedTasks = workspace.Tasks.Count(t => t.Status == TasksStatus.Done);

				var leaderboard = workspace.Members
					.Select(m => new
					{
						UserName = m.User!.UserName,
						ProfilePictureUrl = m.User.ProfilePictureUrl,
						Points = m.User.Tasks!
							.Where(a => a.TaskItem!.WorkSpaceId == workspace.Id && a.TaskItem.Status == TasksStatus.Done)
							.Sum(a => a.TaskItem!.Points)
					})
					.OrderByDescending(m => m.Points)
					.ToList();

				return Results.Ok(new
				{
					totalTasks,
					totalPoints,
					completedTasks,
					leaderboard
				});

			}).RequireAuthorization().WithSummary("Returns the leaderboard for the workspace").WithTags("LeaderBoard");
		}
	}

	#region DTOs
	public class RequestEmailCodeDto
	{
		public string Email { get; set; } = string.Empty;
	}
	public class VerifyEmailCodeDto
	{
		public string Email { get; set; } = string.Empty;

		public string Code { get; set; } = string.Empty;
	}


	public record MemberSearch(string emailOrUsername);
	public record JoinCodeDTO(string join_code);
	public record InvitationActionDto
	{
		public string Action { get; set; } = ""; // "accept" or "reject"
	}

	public record TaskStatusChangeAction
	{
		public int status { get; set; } // 0 - To Do 1 - In Progress 2 - Done 
	}

	public record ChangeRoleDto
	{
		public string PublicId { get; set; } = "";
		public string UserId { get; set; } = "";
		public int Role { get; set; } // 0 - Member, 1 - Admin
	}

	public record AddMemberDto
	{
		public string PublicId { get; set; } = "";
		public string EmailOrUsername { get; set; } = "";
		public int Role { get; set; } // 0 - Member, 1 - Admin
	}

	#endregion
}
