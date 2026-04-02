using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Reflection.Metadata.Ecma335;
using System.Security.Claims;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Helpers;
using TeamUpBackEnd.Models;
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

				if (workspace is null)	return Results.NotFound("Workspace not found");

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
		}

		public static void TaskEndpoints(WebApplication app)
		{
			//creates a new task 
			app.MapPost("/create/tasks", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, UserManager<ApplicationUser> userManager, taskDTO.CreateTaskItemDTO data) =>
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

				var task = new TaskItem
				{
					Title = data.Title,
					Description = data.Description,
					DueDate = data.DueDate,
					StartDate = data.StartDate,
					Status = data.Status,
					Difficulty = data.Difficulty == default ? TaskDifficulty.Easy : data.Difficulty,
					Points = data.Points,
					WorkSpaceId = data.WorkspaceId
				};

				if (task.Points == 0)
				{
					if (task.Difficulty == TaskDifficulty.Easy) task.Points = 50;
					if (task.Difficulty == TaskDifficulty.Medium) task.Points = 75;
					if (task.Difficulty == TaskDifficulty.Hard) task.Points = 100;
					if (task.Difficulty == TaskDifficulty.VeryHard) task.Points = 150;
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

				return Results.Ok(new
				{
					task.PublicId,
					task.Title,
					task.Description,
					task.DueDate,
					task.StartDate,
					task.Points,
					Status = (data.Status == TasksStatus.ToDo) ? "ToDo" : (data.Status == TasksStatus.InProgress) ? "InProgress" : (data.Status == TasksStatus.Done) ? "Done" : "Overdue",
					Difficulty = task.Difficulty switch
					{
						TaskDifficulty.Easy => "Easy",
						TaskDifficulty.Medium => "Medium",
						TaskDifficulty.Hard => "Hard",
						_ => "Very Hard"
					}
				});
			}).RequireAuthorization()
				.WithSummary("Creates a new task").WithTags("Task Management");

			//get all tasks in workspace
			app.MapGet("/tasks/{workspaceId}", [Authorize] async (AppDbContext db, ClaimsPrincipal userClaims, string workspaceId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null)
				{
					return Results.BadRequest("Id not found");
				}

				var workspace = await db.Workspaces
					.Include(w => w.Members)
					.Include(w => w.Tasks)
					.ThenInclude(t => t.Assignments!)
					.ThenInclude(u => u.User)
					.FirstOrDefaultAsync(w => w.PublicId.ToString() == workspaceId);

				if (workspace == null)
				{
					return Results.BadRequest("Workspace not found");
				}

				if (!workspace.Members.Any(m => m.UserId == userId))
				{
					return Results.BadRequest("You are not a member of this workspace");
				}

				foreach (var t in workspace.Tasks)
				{
					if (t.DueDate < DateTime.UtcNow)
					{
						t.Status = TasksStatus.Overdue;
					}
				}

				var tasks = workspace.Tasks.Select(t => new
				{
					t.PublicId,
					t.Title,
					t.Description,
					t.DueDate,
					t.StartDate,
					t.UpadeAt,
					t.Points,
					Status = t.Status switch
					{
						TasksStatus.ToDo => "ToDo",
						TasksStatus.InProgress => "InProgress",
						TasksStatus.Done => "Done",
						_ => "Overdue"
					},
					Difficulty = t.Difficulty,
					AssignedUsers = t.Assignments!.Select(a => new
					{
						a.User!.UserName,
						a.User.Email,
						a.User.ProfilePictureUrl
					}).ToList()
				}).ToList();

				return Results.Ok(tasks);
			}).RequireAuthorization()
				.WithSummary("Get all tasks in workspace").WithTags("Task Management");

			//edit tasks
			app.MapPut("/edit/tasks/{taskid}", [Authorize] async (
				AppDbContext db,
				ClaimsPrincipal userClaims,
				UserManager<ApplicationUser> userManager,
				string taskid,
				EditTaskDTO dto) =>
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
			app.MapDelete("/delete/task/{taskId}", async (AppDbContext db, ClaimsPrincipal userClaims, string taskId) =>
			{
				var userId = userClaims.FindFirstValue(ClaimTypes.NameIdentifier);

				if (userId is null) return Results.BadRequest("User id not found");

				var task = await db.Tasks
					.Include(t => t.Assignments!)
						.ThenInclude(t => t.User)
					.Include(w => w.WorkSpace)
					.FirstOrDefaultAsync(t => t.PublicId.ToString() == taskId && t.IsDeleted == false);

				if (task is null) return Results.BadRequest("Task not found");

				if (task.WorkSpace!.OwnerId != userId) return Results.Forbid();

				task.IsDeleted = true;

				foreach (var item in task.Assignments!)
				{
					item.IsDeleted = true;
				}

				await db.SaveChangesAsync();

				return Results.Ok();
			}).RequireAuthorization().WithSummary("Soft delete a task by it's id").WithTags("Task Management");

			//change task status
			app.MapPut("/task/status/{taskId}", async (AppDbContext db, ClaimsPrincipal userClaims, string taskId, TaskStatusChangeAction data) =>
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
					task.Status = data.status switch
					{
						0 => TasksStatus.ToDo,
						1 => TasksStatus.InProgress,
						2 => TasksStatus.Done,
						_ => TasksStatus.ToDo
					};

					return Results.Ok("Successfully changed");
				} else
				{
					return Results.Forbid();
				}

			}).RequireAuthorization().WithSummary("Change task status").WithTags("Task Management");
		}
	
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

				var channels = await db.Channels
					.Where(c => c.WorkspaceId == workspaceId)
					.Select(c => new {
						c.PublicId,
						c.Name,
						c.Description,
						c.IsPrivate
					})
					.ToListAsync();

				if (channels is null || channels.Count < 0)
				{
					return Results.BadRequest("Channels is null");
				}

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
	}

	public record MemberSearch(string emailOrUsername);
	public record JoinCodeDTO(string join_code);
	public record InvitationActionDto
	{
		public string Action { get; set; } = ""; // "accept" or "reject"
	}

	public record TaskStatusChangeAction
	{
		public int status; // 0 - To Do 1 - In Progress 2 - Done 
	}
}