using TeamUpBackEnd.Models.Tasks;

namespace TeamUpBackEnd.DTO
{
	public class TaskItemsDTO
	{	
		public record CreateTaskItemDTO
		{
			public string? Title { get; init; }
			public string? Description { get; init; }
			public DateTime? DueDate { get; init; }
			public DateTime? StartDate { get; init; }
			public TasksStatus Status { get; init; }
			public TaskDifficulty Difficulty { get; init; }
			public int Points { get; init; }
			public List<string>? AssignedUserIds { get; init; }
			public int WorkspaceId { get; init; }
		}

		public record EditTaskDTO 
		{
			public string? Title { get; init; }
			public string? Description { get; init; }
			public DateTime StartDate { get; init; }
			public DateTime DueDate { get; init; }
			public TasksStatus? Status { get; init; }
			public TaskDifficulty? Difficulty { get; init; }
			public int Points { get; init; }
			public List<string>? AssignedUsers { get; init; } = new List<string>();
		}
	}
}
