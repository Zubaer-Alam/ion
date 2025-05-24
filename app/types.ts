export interface User {
  id: string;
  displayName: string;
  email?: string;
}

export interface Task {
  id: string;
  title: string;
  percentComplete: number;
  dueDateTime: string | null;
  priority: number;
  createdDateTime: string;
  completedDateTime: string | null;
  activeChecklistItemCount: number;
  checklistItemCount: number;
  createdBy: {
    user: User;
  };
  assignments: Record<string, any>;
  assignedTo: User[];
}

export interface TasksResponse {
  user: User;
  tasks: Task[];
  totalTasks: number;
}

export interface ErrorResponse {
  error: string;
}
