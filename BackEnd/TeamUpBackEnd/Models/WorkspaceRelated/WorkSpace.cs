using TeamUpBackEnd.Models.Tasks;
using TeamUpBackEnd.Models.Chat;

using Helper = TeamUpBackEnd.Helpers.WorkspaceAuthorization;

namespace TeamUpBackEnd.Models.WorkspaceRelated
{
	public class WorkSpace
	{
		public int Id { get; set; }
		public Guid PublicId { get; set; } = Guid.NewGuid();
		public string? Title { get; set; }
		public string? Description { get; set; }
		public string? OwnerId { get; set; }
		public string? JoinCode { get; set; } = Helper.GenerateJoinCode();
		public ApplicationUser? Owner { get; set; }
		public bool IsDeleted { get; set; }

		public DateOnly? CreatedAt { get; set; }
		public DateOnly? UpdatedAt { get; set; }
		public ICollection<Channel> Channels { get; set; } = new List<Channel>();
		public ICollection<WorkSpaceMember> Members { get; set; } = new List<WorkSpaceMember>();
		public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
		public ICollection<WorkspaceInvitation> Invitations { get; set; } = new List<WorkspaceInvitation>();
		public ICollection<Conversation> Conversations { get; set; } = new List<Conversation>();
	}
}