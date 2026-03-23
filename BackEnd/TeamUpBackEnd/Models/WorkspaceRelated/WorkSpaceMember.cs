namespace TeamUpBackEnd.Models.WorkspaceRelated
{
	public class WorkSpaceMember
	{
		public int WorkspaceId { get; set; }
		public WorkSpace? WorkSpace { get; set; }

		public string? UserId { get; set; }
		public ApplicationUser? User { get; set; }
		public WorkSpaceRole Role { get; set; }
	}

	public enum WorkSpaceRole
	{
		Member, //0
		Admin, //1
		Owner //2
	}
}