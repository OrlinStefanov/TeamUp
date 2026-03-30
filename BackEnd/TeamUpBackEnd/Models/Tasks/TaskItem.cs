using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.Models.Tasks
{
	public class TaskItem
	{
		public int Id { get; set; }
		public Guid PublicId { get; set; } = Guid.NewGuid();
		public string? Title { get; set; }
		public string? Description { get; set; }
		public DateTime? DueDate { get; set; }
		public DateTime? StartDate { get; set; }	
		public DateTime? UpadeAt { get; set; }
		public TasksStatus Status { get; set; } = TasksStatus.ToDo;
		public TaskDifficulty Difficulty { get; set; }
		public int Points { get; set; }
		public bool IsDeleted { get; set; }

		public int WorkSpaceId { get; set; }
		public WorkSpace? WorkSpace { get; set; }

		public ICollection<TaskAssignment>? Assignments { get; set; }
	}

	public enum TasksStatus
	{
		ToDo,
		InProgress,
		Done,
		Overdue
	}

	public enum TaskDifficulty
	{ 
		Easy,
		Medium,
		Hard,
		VeryHard
	}
}
