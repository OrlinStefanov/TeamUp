using TeamUpBackEnd.Models.Tasks;

namespace TeamUpBackEnd.DTO
{
	public class TaskItemsDTO
	{
		public record TaskItemDTO
		{
			public Guid PublicId { get; init; }
			public string? Title { get; init; }
			public string? Description { get; init; }
			public DateTime? DueDate { get; init; }
			public DateTime? StartDate { get; init; }
			public TasksStatus Status { get; init; }
			public List<string>? AssignedUsers { get; init; }
		}

		public record CreateTaskItemDTO
		{
			public string? Title { get; init; }
			public string? Description { get; init; }
			public DateTime? DueDate { get; init; }
			public DateTime? StartDate { get; init; }
			public TasksStatus Status { get; init; }
			public List<string>? AssignedUserIds { get; init; }
			public int WorkspaceId { get; init; }
		}
	}
}
