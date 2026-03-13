using TeamUpBackEnd.Models.Tasks;
using TeamUpBackEnd.Models.Chat;

namespace TeamUpBackEnd.Models.WorkspaceRelated
{
	public class WorkSpace
	{
		public int Id { get; set; }
		public Guid PublicId { get; set; } = Guid.NewGuid();
		public string? Title { get; set; }
		public string? Description { get; set; }
		public string? OwnerId { get; set; }
		public ApplicationUser? Owner { get; set; }

		public DateTime? CreatedAt { get; set; }
		public ICollection<Channel> Channels { get; set; } = new List<Channel>();
		public ICollection<WorkSpaceMember> Members { get; set; } = new List<WorkSpaceMember>();
		public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
	}
}
