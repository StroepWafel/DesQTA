export interface SidebarFolder {
  id: string;
  name: string;
  icon?: string; // Optional icon identifier
  items: string[]; // Array of menu item paths
  collapsed: boolean; // Default collapsed state
  order: number; // Display order
}

export interface RecentActivity {
  path: string;
  visited_at: number; // Unix timestamp
}

export interface MenuItem {
  labelKey: string;
  icon: any;
  path: string;
  folderId?: string; // Optional folder assignment
  isFavorite?: boolean; // Favorite status
  isRecent?: boolean; // Recent activity flag
}
