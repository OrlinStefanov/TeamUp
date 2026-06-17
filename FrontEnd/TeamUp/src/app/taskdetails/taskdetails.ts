import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Auth } from '../services/auth/auth';
import { Taskhub } from '../services/taskhub';
import { ActivatedRoute, RouterLink } from "@angular/router";
import { FormsModule } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-taskdetails',
  imports: [DatePipe, RouterLink, CommonModule, FormsModule, DragDropModule],
  standalone: true,
  templateUrl: './taskdetails.html',
  styleUrl: './taskdetails.css',
})

export class Taskdetails implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('taskBoard') taskBoardRef?: ElementRef<HTMLDivElement>;

  selectedRole: string = 'all';
  roleMenuOpen: boolean = false;
  filtersOpen: boolean = false;

  boardSections = ['To Do', 'In Progress', 'Done', 'Overdue'];
  activeSectionIndex = 0;
  isMobileView = false;

  worksapce_info: any = null;
  tasks: any[] = [];
  user_data: any = null;
  isDarkMode$!: Observable<boolean>;
  activeMenuTaskId: string | null = null;
  extendingTaskId: string | null = null;
  isEditingTask = false;
  editingTaskPublicId: string | null = null;

  tasksToDo: any[] = [];
  tasksInProgress: any[] = [];
  tasksCompleted: any[] = [];
  tasksOverdue: any[] = [];

  selectedUsers: any[] = [];
  availableTags: any[] = [];
  newTag: string = '';

  statusMap: any = {
    0: 'ToDo',
    1: 'InProgress',
    2: 'Done',
    3: 'Overdue'
  };

  statusReverseMap: any = {
    ToDo: 0,
    InProgress: 1,
    Done: 2,
    Overdue: 3
  };

  newTask: any = {
    title: '',
    description: '',
    dueDate: '',
    startDate: '',
    status: 0,
    difficulty: null,
    points: null,
    assignedUserIds: [] as string[],
    tagIds: [] as number[],
    newTags: [] as string[],
    workspaceId: 0
  };

  filters = {
    user: localStorage.getItem('taskFilter_user') || 'all',
    search: '',
    tags: JSON.parse(localStorage.getItem('taskFilter_tags') || '[]') as string[],
    difficulty: localStorage.getItem('taskFilter_difficulty') || 'all',
    status: 'all'
  };

  tagMenuOpen: boolean = false;
  difficultyMenuOpen: boolean = false;

  private boundCloseDropdown!: (event: Event) => void;
  private boardScrollTimeout: any;
  private destroy$ = new Subject<void>();
  private tasksInitialized = false;
  private workspaceId: string | null = null;

  constructor(
    private auth: Auth,
    private taskhub: Taskhub,
    private route: ActivatedRoute,
    private breakpointObserver: BreakpointObserver
  ) {}

  ngOnInit() {
    this.taskhub.tasks$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        if (!this.tasksInitialized || this.extendingTaskId) return;

        this.tasks = tasks.map((task: any) => this.normalizeTask(task));
        this.refreshAvailableTags();
        this.filterTasksStatus();
      });

    this.route.parent?.paramMap.subscribe(params => {
      const workspaceId = params.get('id');
      if (!workspaceId) return;

      this.workspaceId = workspaceId;
      this.tasksInitialized = false;

      this.auth.getWorkspaceInfo(workspaceId).subscribe((res: any) => {
        this.worksapce_info = res;
      });

      this.auth.getWorkspaceTasks(workspaceId).subscribe((res: any) => {
        this.tasks = res.map((task: any) => this.normalizeTask(task));

        console.log('Fetched tasks:', this.tasks);

        this.taskhub.setInitialTasks(workspaceId, this.tasks);
        this.tasksInitialized = true;
        this.refreshAvailableTags();
        this.filterTasksStatus(true);
      });
    });

    this.isDarkMode$ = this.auth.darkMode$;
    this.user_data = this.auth.getCurrentUser();

    // Close dropdowns and menus when clicking outside
    this.boundCloseDropdown = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.task-menu') || target?.closest('.menu-trigger')) {
        return;
      }

      this.roleMenuOpen = false;
      this.tagMenuOpen = false;
      this.difficultyMenuOpen = false;
      this.activeMenuTaskId = null;
    };
    document.addEventListener('click', this.boundCloseDropdown);

    this.breakpointObserver.observe(['(max-width: 768px)']).subscribe(result => {
      this.isMobileView = result.matches;
      if (result.matches) {
        setTimeout(() => this.resetBoardScroll(), 0);
      }
    });
  }

  ngAfterViewInit() {
    this.resetBoardScroll();
  }

  onBoardScroll() {
    if (!this.isMobileView || !this.taskBoardRef?.nativeElement) return;

    clearTimeout(this.boardScrollTimeout);
    this.boardScrollTimeout = setTimeout(() => {
      const board = this.taskBoardRef!.nativeElement;
      const sectionWidth = board.clientWidth || 1;
      this.activeSectionIndex = Math.round(board.scrollLeft / sectionWidth);
    }, 80);
  }

  scrollToSection(index: number) {
    const board = this.taskBoardRef?.nativeElement;
    if (!board) return;

    const sectionWidth = board.clientWidth;
    board.scrollTo({
      left: sectionWidth * index,
      behavior: 'smooth'
    });
    this.activeSectionIndex = index;
  }

  private resetBoardScroll() {
    const board = this.taskBoardRef?.nativeElement;
    if (!board) return;

    board.scrollLeft = 0;
    this.activeSectionIndex = 0;
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.boundCloseDropdown);
    this.destroy$.next();
    this.destroy$.complete();
  }

  // FILTER TASKS
  filterTasksStatus(resetScroll = false) {
    this.tasksToDo = [];
    this.tasksInProgress = [];
    this.tasksCompleted = [];
    this.tasksOverdue = [];

    const filtered = this.applyFilters();

    filtered.forEach(task => {
      if (this.isOverdue(task)) {
        this.tasksOverdue.push(task);
        return;
      }

      const boardStatus = this.resolveBoardStatus(task);

      switch (boardStatus) {
        case 'ToDo':
          this.tasksToDo.push(task);
          break;
        case 'InProgress':
          this.tasksInProgress.push(task);
          break;
        case 'Done':
          this.tasksCompleted.push(task);
          break;
        default:
          this.tasksToDo.push(task);
          break;
      }
    });

    if (resetScroll) {
      this.resetBoardScroll();
    }
  }

  private resolveBoardStatus(task: any): string {
    const status = task.status ?? task.Status ?? 'ToDo';
    if (status === 'Overdue') {
      return 'ToDo';
    }
    return status;
  }

  // TAGS
  toggleTag(tag: any) {
    if (tag.id) {
      const exists = this.newTask.tagIds.includes(tag.id);
      if (exists) {
        this.newTask.tagIds = this.newTask.tagIds.filter((id: number) => id !== tag.id);
      } else {
        this.newTask.tagIds.push(tag.id);
      }
    } else {
      const exists = this.newTask.newTags.includes(tag.name);
      if (exists) {
        this.newTask.newTags = this.newTask.newTags.filter((t: string) => t !== tag.name);
      } else {
        this.newTask.newTags.push(tag.name);
      }
    }
  }

  getSelectedTags() {
    return this.availableTags.filter(tag =>
      (tag.id && this.newTask.tagIds.includes(tag.id)) ||
      (!tag.id && this.newTask.newTags.includes(tag.name))
    );
  }

  addTag() {
    if (this.newTag.trim() === '') return;

    const trimmed = this.newTag.trim();

    const existing = this.availableTags.find(
      t => t.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      this.toggleTag(existing);
    } else {
      this.newTask.newTags.push(trimmed);
      this.availableTags.push({ name: trimmed });
    }

    this.newTag = '';
  }

  removeTag(tag: any) {
    if (tag.id) {
      this.newTask.tagIds = this.newTask.tagIds.filter((id: number) => id !== tag.id);
    } else {
      this.newTask.newTags = this.newTask.newTags.filter((t: string) => t !== tag.name);
    }

    this.availableTags = this.availableTags.filter(t => t.name !== tag.name);
  }

  // DRAG & DROP
  drop(event: CdkDragDrop<any[]>, newStatusIndex: number) {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      return;
    }

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    const movedTask = event.container.data[event.currentIndex];
    const newStatus = this.statusMap[newStatusIndex];

    movedTask.status = newStatus;

    if (this.isOverdue(movedTask)) {
      movedTask.status = 'Overdue';
    }

    const index = this.findTaskIndex(movedTask);
    if (index !== -1) {
      this.tasks[index] = { ...this.tasks[index], status: movedTask.status };
    }

    console.log('Moved task to:', movedTask.status);

    this.auth.updateTaskStatus(movedTask.publicId, this.statusReverseMap[movedTask.status])
      .subscribe({
        next: () => {
          this.syncTasksToHub();
          console.log('Status updated');
        },
        error: (err) => {
          console.error('Update failed', err);
          this.filterTasksStatus();
        }
      });
  }

  // OVERDUE
  isOverdue(task: any): boolean {
    return new Date(task.dueDate) < new Date() && task.status !== 'Done';
  }

  canExtendOverdue(task: any): boolean {
    if (!this.isOverdue(task)) return false;

    const currentUserId = this.user_data?.id;
    if (!currentUserId || !this.worksapce_info) return false;

    if (this.worksapce_info.owner?.id === currentUserId) return true;

    const userEmail = this.user_data?.email?.toLowerCase();
    const userName = this.user_data?.userName?.toLowerCase();

    return (task.assignedUsers ?? []).some((u: any) => {
      const email = (u.email ?? u.Email ?? '').toLowerCase();
      const name = (u.userName ?? u.UserName ?? '').toLowerCase();
      return (userEmail && email === userEmail) || (userName && name === userName);
    });
  }

  extendOverdueTask(task: any, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();

    const publicId = String(task.publicId ?? task.PublicId ?? '');
    if (!publicId || this.extendingTaskId === publicId) return;

    const index = this.findTaskIndex(task);
    if (index === -1) return;

    const previousTask = { ...this.tasks[index] };
    const extendedDueDate = new Date(this.tasks[index].dueDate);
    extendedDueDate.setDate(extendedDueDate.getDate() + 3);

    this.extendingTaskId = publicId;
    this.activeMenuTaskId = null;

    this.applyTaskPatch(index, {
      dueDate: extendedDueDate.toISOString(),
      status: 'ToDo'
    });

    this.auth.extendOverdueTask(publicId).subscribe({
      next: (res: any) => {
        const serverDueDate = res?.dueDate ?? res?.DueDate;
        if (serverDueDate) {
          const idx = this.findTaskIndex({ publicId });
          if (idx !== -1) {
            this.applyTaskPatch(idx, {
              dueDate: serverDueDate,
              status: res?.status ?? res?.Status ?? 'ToDo'
            });
          }
        }
        this.extendingTaskId = null;
      },
      error: (err) => {
        console.error('Extend overdue task failed', err);
        const idx = this.findTaskIndex({ publicId });
        if (idx !== -1) {
          this.tasks[idx] = previousTask;
          this.tasks = [...this.tasks];
          this.filterTasksStatus();
          this.syncTasksToHub();
        }
        this.extendingTaskId = null;
      }
    });
  }

  private applyTaskPatch(index: number, patch: Partial<{ dueDate: string; status: string }>) {
    this.tasks[index] = {
      ...this.tasks[index],
      ...patch
    };
    this.tasks = [...this.tasks];
    this.filterTasksStatus();
    this.syncTasksToHub();
  }

  getDifficultyLevel(task: any): number {
    const raw = task?.difficulty ?? task?.Difficulty;
    if (typeof raw === 'number') return raw;

    const map: Record<string, number> = {
      Easy: 0,
      Medium: 1,
      Hard: 2,
      VeryHard: 3,
      'Very Hard': 3
    };

    return map[String(raw)] ?? 0;
  }

  getDifficultyLabel(task: any): string {
    return ['Easy', 'Medium', 'Hard', 'Very Hard'][this.getDifficultyLevel(task)] ?? 'Easy';
  }

  getDifficultyClass(task: any): string {
    return ['easy', 'medium', 'hard', 'vhard'][this.getDifficultyLevel(task)] ?? 'easy';
  }

  private findTaskIndex(task: any): number {
    const id = String(task.publicId ?? task.PublicId ?? '');
    if (!id) return -1;

    return this.tasks.findIndex(t => String(t.publicId) === id);
  }

  onMenuAction(event: Event) {
    event.stopPropagation();
  }

  // CREATE TASK
  createTask() {
    this.newTask.workspaceId = this.worksapce_info.id;
    const points =
      this.newTask.points === null || this.newTask.points === ''
        ? null
        : Number(this.newTask.points);

    const payload: any = {
      title: this.newTask.title,
      description: this.newTask.description,
      dueDate: this.newTask.dueDate,
      startDate: this.newTask.startDate,
      status: this.newTask.status,
      points,
      assignedUserIds: this.selectedUsers.map(u => String(u.id)),
      tagIds: this.newTask.tagIds,
      newTags: this.newTask.newTags,
      workspaceId: this.newTask.workspaceId
    };

    if (this.newTask.difficulty !== null && this.newTask.difficulty !== undefined) {
      payload.difficulty = this.newTask.difficulty;
    }

    console.log('Creating task payload:', payload);

    this.auth.createTask(payload).subscribe({
      next: (res: any) => {
        const newTask = this.normalizeTask(res);
        if (!this.tasks.some(t => t.publicId === newTask.publicId)) {
          this.tasks = [newTask, ...this.tasks];
        }
        this.syncTasksToHub();
        this.refreshAvailableTags();
        this.filterTasksStatus();
        this.closeTaskModal();
        this.resetTaskForm();
      },
      error: (err) => {
        console.error('Create task failed:', err?.error ?? err);
      }
    });
  }

  private syncTasksToHub() {
    if (this.workspaceId) {
      this.taskhub.setInitialTasks(this.workspaceId, [...this.tasks]);
    }
  }

  private normalizeTask(task: any) {
    const rawDifficulty = task.difficulty ?? task.Difficulty;
    const difficultyMap: any = {
      Easy: 0,
      Medium: 1,
      Hard: 2,
      VeryHard: 3,
      'Very Hard': 3
    };

    return {
      ...task,
      publicId: String(task.publicId ?? task.PublicId ?? ''),
      title: task.title ?? task.Title,
      description: task.description ?? task.Description,
      dueDate: task.dueDate ?? task.DueDate,
      startDate: task.startDate ?? task.StartDate,
      points: task.points ?? task.Points,
      status: task.status ?? task.Status,
      difficulty: typeof rawDifficulty === 'number'
        ? rawDifficulty
        : difficultyMap[String(task.difficulty ?? task.Difficulty)] ?? 0,
      tags: (task.tags ?? task.Tags ?? []).map((tag: any) =>
        typeof tag === 'string' ? { name: tag } : {
          id: tag.id ?? tag.Id,
          name: tag.name ?? tag.Name
        }
      ),
      assignedUsers: (task.assignedUsers ?? task.AssignedUsers ?? []).map((u: any) => ({
        userName: u.userName ?? u.UserName,
        email: u.email ?? u.Email,
        profilePictureUrl: u.profilePictureUrl ?? u.ProfilePictureUrl
      }))
    };
  }

  private refreshAvailableTags() {
    this.availableTags = this.tasks.reduce((acc: any[], task) => {
      task.tags?.forEach((tag: any) => {
        if (!acc.find(t => t.name === tag.name)) {
          acc.push(tag);
        }
      });
      return acc;
    }, []);
  }

  // UI HELPERS
  setStatus(status: number) {
    this.newTask.status = status;
  }

  setDifficulty(level: number) {
    this.newTask.difficulty = level;
  }

  toggleUser(user: any) {
    const exists = this.selectedUsers.find(u => u.id === user.id);
    if (exists) {
      this.selectedUsers = this.selectedUsers.filter(u => u.id !== user.id);
    } else {
      this.selectedUsers.push(user);
    }
  }

  openTaskModal() {
    this.isEditingTask = false;
    this.editingTaskPublicId = null;
    this.resetTaskForm();

    const modal = new (window as any).bootstrap.Modal(
      document.getElementById('createTaskModal')
    );
    modal.show();
  }

  openEditTaskModal(task: any) {
    this.isEditingTask = true;
    this.editingTaskPublicId = task.publicId;
    this.activeMenuTaskId = null;

    const statusValue = typeof task.status === 'number'
      ? task.status
      : this.statusReverseMap[task.status] ?? 0;

    this.newTask = {
      title: task.title ?? '',
      description: task.description ?? '',
      dueDate: this.formatDateForInput(task.dueDate),
      startDate: this.formatDateForInput(task.startDate),
      status: statusValue,
      difficulty: task.difficulty ?? null,
      points: task.points ?? null,
      assignedUserIds: [],
      tagIds: [],
      newTags: [],
      workspaceId: this.worksapce_info?.id ?? 0
    };

    this.selectedUsers = (task.assignedUsers ?? task.AssignedUsers ?? []).map((user: any) => ({
      id: user.id ?? user.userId ?? user.userName ?? user.UserName,
      userName: user.userName ?? user.UserName,
      email: user.email ?? user.Email,
      profilePictureUrl: user.profilePictureUrl ?? user.ProfilePictureUrl
    }));

    const modal = new (window as any).bootstrap.Modal(
      document.getElementById('createTaskModal')
    );
    modal.show();
  }

  saveTask() {
    if (this.isEditingTask) {
      this.updateTask();
      return;
    }

    this.createTask();
  }

  updateTask() {
    if (!this.editingTaskPublicId) {
      return;
    }

    const points =
      this.newTask.points === null || this.newTask.points === ''
        ? 0
        : Number(this.newTask.points);

    const payload = {
      title: this.newTask.title,
      description: this.newTask.description,
      startDate: this.newTask.startDate,
      dueDate: this.newTask.dueDate,
      status: this.newTask.status,
      difficulty: this.newTask.difficulty,
      points,
      assignedUsers: this.selectedUsers.map((user: any) => user.userName || user.email)
    };

    this.auth.editTask(this.editingTaskPublicId, payload).subscribe({
      next: () => {
        const index = this.tasks.findIndex(t => t.publicId === this.editingTaskPublicId);
        if (index !== -1) {
          this.tasks[index] = this.normalizeTask({
            ...this.tasks[index],
            ...payload,
            publicId: this.editingTaskPublicId,
            status: this.statusMap[payload.status] ?? payload.status,
            assignedUsers: [...this.selectedUsers]
          });
        }

        this.syncTasksToHub();
        this.filterTasksStatus();
        this.closeTaskModal();
        this.resetTaskForm();
      },
      error: (err) => {
        console.error('Update task failed:', err?.error ?? err);
      }
    });
  }

  private closeTaskModal() {
    const modalEl = document.getElementById('createTaskModal');
    const modalInstance = (window as any).bootstrap.Modal.getInstance(modalEl);
    modalInstance?.hide();
  }

  private resetTaskForm() {
    this.isEditingTask = false;
    this.editingTaskPublicId = null;
    this.newTask = {
      title: '',
      description: '',
      dueDate: '',
      startDate: '',
      status: 0,
      difficulty: null,
      points: null,
      assignedUserIds: [],
      tagIds: [],
      newTags: [],
      workspaceId: 0
    };
    this.selectedUsers = [];
    this.newTag = '';
  }

  private formatDateForInput(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString().split('T')[0];
  }

  canEditTask(): boolean {
    const role = this.getCurrentUserRole();
    return role === 1 || role === 2;
  }

  canDeleteTask(): boolean {
    return this.getCurrentUserRole() === 2;
  }

  private getCurrentUserRole(): number {
    const currentUserId = this.user_data?.id;
    if (!currentUserId || !this.worksapce_info) {
      return 0;
    }

    if (this.worksapce_info.owner?.id === currentUserId) {
      return 2;
    }

    const member = (this.worksapce_info.members ?? []).find((m: any) => m.id === currentUserId);
    return member?.role ?? 0;
  }

  moveTask(task: any, status: string, event?: Event) {
    event?.stopPropagation();
    this.activeMenuTaskId = null;

    const index = this.findTaskIndex(task);
    if (index !== -1) {
      this.tasks[index] = { ...this.tasks[index], status };
    }

    this.filterTasksStatus();

    this.auth.updateTaskStatus(task.publicId, this.statusReverseMap[status])
      .subscribe({
        next: () => {
          this.syncTasksToHub();
          console.log('Task moved');
        },
        error: (err) => {
          console.error(err);
          this.filterTasksStatus();
        }
      });
  }

  deleteTask(task: any, event?: Event) {
    event?.stopPropagation();
    this.activeMenuTaskId = null;
    if (!task.publicId) {
      console.error('Delete task failed: missing task public id', task);
      return;
    }

    this.auth.deleteTask(task.publicId)
      .subscribe({
        next: () => {
          this.tasks = this.tasks.filter(t => t.publicId !== task.publicId);
          this.syncTasksToHub();
          this.filterTasksStatus();
          this.activeMenuTaskId = null;
        },
        error: (err) => {
          console.error('Delete task failed', err);
          if (err.status === 400) {
            this.tasks = this.tasks.filter(t => t.publicId !== task.publicId);
            this.filterTasksStatus();
            this.activeMenuTaskId = null;
          }
        }
      });
  }

  toggleMenu(event: MouseEvent, taskId: string) {
    event.stopPropagation();
    this.activeMenuTaskId = this.activeMenuTaskId === taskId ? null : taskId;
  }

  toggleRoleMenu(event: Event): void {
    event.stopPropagation();
    this.roleMenuOpen = !this.roleMenuOpen;
    this.tagMenuOpen = false;
    this.difficultyMenuOpen = false;
  }

  setRoleFilter(role: string, event?: Event): void {
    event?.stopPropagation();
    this.filters.user = role;
    localStorage.setItem('taskFilter_user', role);
    this.roleMenuOpen = false;
    this.filterTasksStatus();
  }

  onSearch(value: string) {
    this.filters.search = value;
    this.filterTasksStatus();
  }

  get activeFilterLabel(): string {
    if (this.filters.user === 'all') return 'All Members';
    return this.filters.user;
  }

  isFilterActive(userName: string): boolean {
    return this.filters.user === userName;
  }

  get sortedUsers() {
    if (!this.worksapce_info) return [];

    const currentUserId = this.user_data?.id;
    const owner = this.worksapce_info.owner;
    const members = this.worksapce_info.members || [];

    const currentUser =
      members.find((u: any) => u.id === currentUserId) ||
      (owner?.id === currentUserId ? owner : null);

    const otherMembers = members.filter(
      (u: any) => u.id !== currentUserId
    );

    const includeOwner =
      owner && owner.id !== currentUserId &&
      !otherMembers.some((u: any) => u.id === owner.id);

    const result: any[] = [];

    if (currentUser) result.push(currentUser);
    result.push(...otherMembers);
    if (includeOwner) result.push(owner);

    return result;
  }

  toggleTagFilter(tagName: string): void {
    const idx = this.filters.tags.indexOf(tagName);
    if (idx > -1) {
      this.filters.tags.splice(idx, 1);
    } else {
      this.filters.tags.push(tagName);
    }
    localStorage.setItem('taskFilter_tags', JSON.stringify(this.filters.tags));
    this.filterTasksStatus();
  }

  isTagFilterActive(tagName: string): boolean {
    return this.filters.tags.includes(tagName);
  }

  setDifficultyFilter(level: string, event?: Event): void {
    event?.stopPropagation();
    this.filters.difficulty = level;
    localStorage.setItem('taskFilter_difficulty', level);
    this.difficultyMenuOpen = false;
    this.filterTasksStatus();
  }

  get activeDifficultyLabel(): string {
    const map: any = { 'all': 'All Difficulties', '0': 'Easy', '1': 'Medium', '2': 'Hard', '3': 'Very Hard' };
    return map[this.filters.difficulty] || 'All Difficulties';
  }

  toggleTagMenu(event: Event): void {
    event.stopPropagation();
    this.tagMenuOpen = !this.tagMenuOpen;
    this.difficultyMenuOpen = false;
  }

  toggleDifficultyMenu(event: Event): void {
    event.stopPropagation();
    this.difficultyMenuOpen = !this.difficultyMenuOpen;
    this.tagMenuOpen = false;
  }

  applyFilters(): any[] {
    return this.tasks.filter(task => {

      // USER FILTER — assignedUsers have no id, filter by userName
      if (this.filters.user !== 'all') {
        const assigned = task.assignedUsers?.some(
          (u: any) => u.userName === this.filters.user
        );
        if (!assigned) return false;
      }

      // SEARCH FILTER
      if (this.filters.search) {
        const text = (task.title + ' ' + task.description).toLowerCase();
        if (!text.includes(this.filters.search.toLowerCase())) {
          return false;
        }
      }

      // TAG FILTER
      if (this.filters.tags.length > 0) {
        const hasTag = task.tags?.some((t: any) =>
          this.filters.tags.includes(t.name)
        );
        if (!hasTag) return false;
      }

      // DIFFICULTY FILTER
      if (this.filters.difficulty !== 'all') {
        if (String(task.difficulty) !== String(this.filters.difficulty)) return false;
      }

      // STATUS FILTER
      if (this.filters.status !== 'all') {
        if (task.status !== this.filters.status) return false;
      }

      return true;
    });
  }

  openFilterModal() {
    this.filtersOpen = !this.filtersOpen;
  }

  clearAllFilters(): void {
    this.filters.user = 'all';
    this.filters.difficulty = 'all';
    this.filters.tags = [];
    localStorage.setItem('taskFilter_user', 'all');
    localStorage.setItem('taskFilter_difficulty', 'all');
    localStorage.setItem('taskFilter_tags', '[]');
    this.roleMenuOpen = false;
    this.filterTasksStatus();
  }
}
