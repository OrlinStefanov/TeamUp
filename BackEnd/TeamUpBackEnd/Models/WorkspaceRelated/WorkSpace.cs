using TeamUpBackEnd.Models.Tasks;

namespace TeamUpBackEnd.Models.WorkspaceRelated
{
	public class WorkSpace
	{
		public int Id { get; set; }
		public Guid PublicId { get; set; } = Guid.NewGuid();
		public string? Title { get; set; }
		public string? Description { get; set; }
		public string? OwnerId { get; set; }
		public ApplicationUser? owner { get; set; }

		public DateTime? CreatedAt { get; set; }

		public ICollection<WorkSpaceMember>? Members { get; set; }
		public ICollection<TaskItem>? Tasks { get; set; }
	}
}
