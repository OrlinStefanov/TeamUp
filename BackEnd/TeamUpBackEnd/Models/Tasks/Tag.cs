namespace TeamUpBackEnd.Models.Tasks
{
	public class Tag
	{
		public int Id { get; set; }
		public string Name { get; set; } = string.Empty;
		public int WorkSpaceId { get; set; }
		
		public ICollection<TaskItemTag> TaskItemTags { get; set; } = new List<TaskItemTag>();
	}
}
