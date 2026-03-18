using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.DTO
{
	public class WorkspaceDTO
	{
		public record CreateWorkspace
		{
			public string? Title { get; set;  }
			public string? Description { get; set; }
			public string? OwnerId { get; set; }

			public List<WorkspaceMemberDTO>? Members { get; set; }
		}

		public record EditWorkspace
		{
			public string? PublicId { get; set; }
			public string? Title { get; set; }
			public string? Description { get; set; }
			public string? OwnerId { get; set; }

			public List<WorkspaceMemberDTO> Members { get; set; } = new List<WorkspaceMemberDTO>();
		}

		public record WorkspaceMemberDTO
		{
			public string? EmailOrUsername { get; set; }
			public WorkSpaceRole Role { get; set; }
		}

		public record FullWorkspace
		{
			public int Id { get; set; }
			public string PublicId { get; set; } = string.Empty;

			public string? Title { get; set; }
			public string? Description { get; set; }
			public DateOnly CreatedAt { get; set; }
			public DateOnly UpdatedAt { get; set; }

			public FullWorkspaceMember? Owner { get; set; }
			public List<FullWorkspaceMember> Members { get; set; } = new List<FullWorkspaceMember>();
		}

		public record FullWorkspaceMember
		{
			public string Id { get; set; } = string.Empty;
			public string UserName { get; set; } = string.Empty;
			public string? Email { get; set; }
			public WorkSpaceRole Role { get; set; }
			public string ProfilePictureUrl { get; set; } = string.Empty;
		}
	}
}
