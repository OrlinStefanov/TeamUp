namespace TeamUpBackEnd.Models.WorkspaceRelated
{
	public class WorkspaceInvitation
	{
		public int Id { get; set; }

		public int WorkspaceId { get; set; }
		public WorkSpace? WorkSpace { get; set; }

		public string UserId { get; set; } = string.Empty;
		public ApplicationUser? User { get; set; }

		public DateOnly? CreatedAt { get; set; }

		public bool? isAccepted { get; set; }
	}
}
