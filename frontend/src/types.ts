export type User = { username: string; isAdmin: boolean; timezone: string };
export type Task = {
  id: string;
  title: string;
  notes: string;
  category: string;
  priority: number;
  startDate: string;
  dueDate: string | null;
  recurrence: string;
  checklist: string;
  archived: boolean;
};
export type RecordDay = {
  taskId: string;
  date: string;
  done: boolean;
  checkedItems: string;
  updatedAt: string;
};
export type Draft = {
  title: string;
  notes: string;
  category: string;
  priority: number;
  startDate: string;
  dueDate: string;
  recurrence: string;
  checklist: string;
};
