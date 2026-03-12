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

		public record WorkspaceMemberDTO
		{
			public string? EmailOrUsername { get; set; }
			public WorkSpaceRole Role { get; set; }
		}
	}
}
