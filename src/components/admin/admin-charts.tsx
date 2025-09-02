"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronRight, Plus, Trash2, Loader2, X, AlertCircle, InboxIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from '@/lib/supabase-client';

interface StatsCardProps {
  title: string;
  value: string | number;
  description: string;
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
}

export function StatsCard({ title, value, description, trend }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {trend && (
            <span className={trend.isPositive ? "text-green-500" : "text-red-500"}>
              {trend.isPositive ? "+" : ""}{trend.value}
            </span>
          )} {description}
        </p>
      </CardContent>
    </Card>
  );
}

interface BarChartDemoProps {
  title: string;
  description?: string;
}

export function BarChartDemo({ title, description }: BarChartDemoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* This is a placeholder for a real chart library implementation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm">Domain Registrations</div>
              <div className="text-sm font-medium">45%</div>
            </div>
            <div className="h-2 w-full bg-muted rounded overflow-hidden">
              <div className="bg-primary h-full" style={{ width: "45%" }}></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm">DNS Record Updates</div>
              <div className="text-sm font-medium">32%</div>
            </div>
            <div className="h-2 w-full bg-muted rounded overflow-hidden">
              <div className="bg-primary h-full" style={{ width: "32%" }}></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm">API Requests</div>
              <div className="text-sm font-medium">68%</div>
            </div>
            <div className="h-2 w-full bg-muted rounded overflow-hidden">
              <div className="bg-primary h-full" style={{ width: "68%" }}></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm">User Logins</div>
              <div className="text-sm font-medium">23%</div>
            </div>
            <div className="h-2 w-full bg-muted rounded overflow-hidden">
              <div className="bg-primary h-full" style={{ width: "23%" }}></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TaskManagementProps {
  title: string;
  description?: string;
}

// Define Task interface
interface Task {
  id: string;
  userId: string;
  userAccount: string;
  userEmail: string;
  taskType: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  assignedTo: string;
  tags: string[];
  completed: boolean;
}

export function TaskManagementSection({ title, description, onTaskCountChange }: TaskManagementProps & { onTaskCountChange?: (count: number) => void }) {
  // State for component loading
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<'open' | 'completed'>('open');
  const [error, setError] = useState<string | null>(null);
  
  // UI state for dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // User selection and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  
  // Tag input state
  const [tagInput, setTagInput] = useState("");
  
  // State for new task form
  const [newTask, setNewTask] = useState<Omit<Task, 'id'>>({
    userId: "",
    userAccount: "",
    userEmail: "",
    taskType: "DNS Configuration",
    description: "",
    priority: "Medium",
    status: "Open",
    dueDate: new Date().toISOString().split('T')[0],
    assignedTo: "unassigned",
    tags: [],
    completed: false
  });
  
  // Sample fallback tasks
  const sampleTasks: Task[] = [
    {
      id: "task-1",
      userId: "sample1",
      userAccount: "Acme Corp",
      userEmail: "contact@acmecorp.com",
      taskType: "DNS Configuration",
      description: "Update MX records",
      priority: "High",
      status: "Open",
      dueDate: "2023-07-15",
      assignedTo: "Support Team",
      tags: ["dns", "email"],
      completed: false
    },
    {
      id: "task-2",
      userId: "sample2",
      userAccount: "Globex Inc.",
      userEmail: "support@globex.com",
      taskType: "Support",
      description: "Help with login issues",
      priority: "Medium",
      status: "In Progress",
      dueDate: "2023-07-20",
      assignedTo: "Tech Team",
      tags: ["login", "auth"],
      completed: false
    },
    {
      id: "task-3",
      userId: "sample3",
      userAccount: "Soylent Corp",
      userEmail: "it@soylentcorp.com",
      taskType: "Implementation",
      description: "Setup custom domain",
      priority: "Low",
      status: "Completed",
      dueDate: "2023-07-10",
      assignedTo: "Implementation Team",
      tags: ["domain", "setup"],
      completed: true
    },
    {
      id: "task-4",
      userId: "sample4",
      userAccount: "Initech",
      userEmail: "admin@initech.com",
      taskType: "DNS Configuration",
      description: "Fix subdomain routing",
      priority: "High",
      status: "Open",
      dueDate: "2023-07-25",
      assignedTo: "Support Team",
      tags: ["dns", "routing", "subdomain"],
      completed: false
    }
  ];
  
  // Initialize Supabase client
  const supabase = createClient();

  // Fetch tasks from Supabase
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          throw error;
        }
        
        if (data && data.length > 0) {
          // Map Supabase data to Task interface
          const mappedTasks = data.map((task: any) => ({
            id: task.id,
            userId: task.user_id || task.userId || '',
            userAccount: task.user_account || task.userAccount || '',
            userEmail: task.user_email || task.userEmail || '',
            taskType: task.task_type || task.taskType || 'DNS Configuration',
            description: task.description || '',
            priority: task.priority || 'Medium',
            status: task.status || 'Open',
            dueDate: task.due_date || task.dueDate || new Date().toISOString().split('T')[0],
            assignedTo: task.assigned_to || task.assignedTo || 'unassigned',
            tags: task.tags || [],
            completed: task.completed !== undefined ? task.completed : false
          }));
          setTasks(mappedTasks);
          console.log('Fetched tasks from Supabase:', mappedTasks);
        } else {
          // Use sample data as fallback
          console.log('No tasks found in Supabase, using sample data');
          setTasks(sampleTasks);
        }
      } catch (err) {
        console.error('Error fetching tasks:', err);
        // Use sample data as fallback
        setTasks(sampleTasks);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTasks();
  }, []);
  
  // Get auth session at component level
  const { session } = useAuth();
  
  // Fetch users from Supabase using the working API endpoint with auth
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      setError(null);
      
      try {
        console.log('Fetching users from working API endpoint...');
        
        if (!session?.access_token) {
          throw new Error('No active session or access token available');
        }
        
        // Use the working API endpoint with proper auth header
        const response = await fetch('/api/admin/users-with-domains', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API response:', data);
        
        if (Array.isArray(data) && data.length > 0) {
          // Map the user profiles to the format we need
          const foundUsers = data.map(user => ({
            id: user.id,
            email: user.email,
            name: user.email // Use email as display name
          }));
          
          console.log('Found users:', foundUsers.length);
          console.log('User sample:', foundUsers.slice(0, 3)); // Show first 3 users as sample
          
          setUsers(foundUsers);
        } else {
          console.warn('No users found in response');
          setError('No user accounts found');
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        setError(`Failed to load user accounts: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    
    fetchUsers();
  }, [session]);

  // Filter users based on search query
  // Add handler for input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTask(prev => ({ ...prev, [name]: value }));
  };

  // Add handler for select changes
  const handleSelectChange = (name: string, value: string) => {
    setNewTask(prev => ({ ...prev, [name]: value }));
  };
  
  // Filter users based on search query
  const filteredUsers = searchQuery.trim() === "" 
    ? users 
    : users.filter(user => 
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // Reset form function
  const resetForm = () => {
    setNewTask({
      userId: "",
      userAccount: "",
      userEmail: "",
      taskType: "DNS Configuration",
      description: "",
      priority: "Medium",
      status: "Open",
      dueDate: new Date().toISOString().split('T')[0],
      assignedTo: "unassigned",
      tags: [],
      completed: false
    });
    setTagInput("");
  };

  // Handle tag input
  const handleAddTag = () => {
    if (tagInput && !newTask.tags.includes(tagInput)) {
      setNewTask({
        ...newTask,
        tags: [...newTask.tags, tagInput]
      });
      setTagInput("");
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setNewTask({
      ...newTask,
      tags: newTask.tags.filter(tag => tag !== tagToRemove)
    });
  };

  // User search and selection handlers
  const handleUserSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleSelectUser = (user: { id: string; name: string; email: string }) => {
    setNewTask(prev => ({
      ...prev,
      userId: user.id,
      userAccount: user.name,
      userEmail: user.email
    }));
    setUserPopoverOpen(false);
  };

  // Create task in Supabase
  const createTask = async () => {
    try {
      // Validate required fields
      if (!newTask.userId || !newTask.taskType) {
        console.error('Missing required fields');
        return;
      }
      
      // Prepare task data for Supabase (snake_case keys)
      const taskData = {
        user_id: newTask.userId,
        user_account: newTask.userAccount,
        user_email: newTask.userEmail,
        task_type: newTask.taskType,
        description: newTask.description,
        priority: newTask.priority,
        status: newTask.status,
        due_date: newTask.dueDate,
        assigned_to: newTask.assignedTo,
        tags: newTask.tags,
        completed: false
      };
      
      // Insert task into Supabase
      const { data, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select();
      
      if (error) throw error;
      
      // Success! Add the new task to local state
      if (data && data.length > 0) {
        const createdTask: Task = {
          id: data[0].id,
          userId: data[0].user_id,
          userAccount: data[0].user_account,
          userEmail: data[0].user_email,
          taskType: data[0].task_type,
          description: data[0].description,
          priority: data[0].priority,
          status: data[0].status,
          dueDate: data[0].due_date,
          assignedTo: data[0].assigned_to,
          tags: data[0].tags,
          completed: data[0].completed !== undefined ? data[0].completed : false
        };
        
        setTasks([createdTask, ...tasks]);
        console.log('Task created successfully:', createdTask);
      }
      
      // Close dialog and reset form
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error creating task:', err);
      // You could add error notification here
    }
  };
  
  // Common tag suggestions
  const tagSuggestions = [
    "dns", "email", "domain", "setup", "login", "auth", 
    "routing", "ssl", "security", "billing", "support", "urgent"
  ];

  // Update task in Supabase
  const updateTaskInSupabase = async (taskId: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);
      
      if (error) {
        console.error('Error updating task in Supabase:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  // Delete task from Supabase
  const deleteTaskFromSupabase = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) {
        console.error('Error deleting task from Supabase:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  // Handle mark task as completed
  const handleMarkAsCompleted = async (taskId: string) => {
    // Update local state first for immediate UI feedback
    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, completed: true, status: 'Completed' } : task
    );
    setTasks(updatedTasks);
    
    // Then update in Supabase (fire and forget)
    updateTaskInSupabase(taskId, { completed: true, status: 'Completed' })
      .then(success => {
        if (!success) {
          // Optionally show an error notification
          console.error('Failed to mark task as completed in database');
        }
      });
  };

  // Handle reopen task
  const handleReopenTask = async (taskId: string) => {
    // Update local state first for immediate UI feedback
    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, completed: false, status: 'Open' } : task
    );
    setTasks(updatedTasks);
    
    // Then update in Supabase (fire and forget)
    updateTaskInSupabase(taskId, { completed: false, status: 'Open' })
      .then(success => {
        if (!success) {
          // Optionally show an error notification
          console.error('Failed to reopen task in database');
        }
      });
  };

  // Handle delete task
  const handleDeleteTask = async (taskId: string) => {
    // Update local state first for immediate UI feedback
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    setTasks(updatedTasks);
    
    // Then delete from Supabase (fire and forget)
    deleteTaskFromSupabase(taskId)
      .then(success => {
        if (!success) {
          // Optionally show an error notification
          console.error('Failed to delete task from database');
        }
      });
  };
  
  // Compute filtered tasks based on activeTab
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => 
      activeTab === 'open' ? !task.completed : task.completed
    );
  }, [tasks, activeTab]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Support Tasks</CardTitle>
            <CardDescription>Create and manage tasks for user accounts that need help</CardDescription>
          </div>
          <Button className="ml-auto" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Task
          </Button>
        </div>
        <div className="flex items-center mt-4 border-b">
          <div 
            className={`py-2 px-4 cursor-pointer flex items-center gap-2 ${activeTab === 'open' ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('open')}
          >
            Open Tickets
            <span className="inline-flex items-center justify-center bg-black text-white text-xs font-medium rounded-full h-5 w-5">
              {tasks.filter(task => !task.completed).length}
            </span>
          </div>
          <div 
            className={`py-2 px-4 cursor-pointer flex items-center gap-2 ${activeTab === 'completed' ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed Tickets
            <span className="inline-flex items-center justify-center bg-gray-500 text-white text-xs font-medium rounded-full h-5 w-5">
              {tasks.filter(task => task.completed).length}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <InboxIcon className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              {activeTab === 'open' 
                ? "No open tasks found. Create one to get started." 
                : "No completed tasks found."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div key={task.id} className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{task.userAccount}</h4>
                    <p className="text-sm text-muted-foreground">{task.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={task.priority === "High" ? "destructive" : 
                                  task.priority === "Medium" ? "default" : "outline"}
                           className="mr-1">
                      {task.priority}
                    </Badge>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <span className="sr-only">View details</span>
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Task Details</DialogTitle>
                          <DialogDescription>
                            Task for {task.userAccount} ({task.userEmail})
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="grid gap-4 py-4">
                          <div>
                            <h3 className="font-medium mb-1">Task Type</h3>
                            <p>{task.taskType}</p>
                          </div>
                          
                          <div>
                            <h3 className="font-medium mb-1">Description</h3>
                            <p className="text-sm">{task.description}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h3 className="font-medium mb-1">Priority</h3>
                              <Badge variant={task.priority === "High" ? "destructive" : 
                                          task.priority === "Medium" ? "default" : "outline"}>
                                {task.priority}
                              </Badge>
                            </div>
                            
                            <div>
                              <h3 className="font-medium mb-1">Status</h3>
                              <p className="text-sm">{task.status}</p>
                            </div>
                            
                            <div>
                              <h3 className="font-medium mb-1">Due Date</h3>
                              <p className="text-sm">{task.dueDate}</p>
                            </div>
                            
                            <div>
                              <h3 className="font-medium mb-1">Assigned To</h3>
                              <p className="text-sm">{task.assignedTo}</p>
                            </div>
                          </div>
                          
                          <div>
                            <h3 className="font-medium mb-1">Tags</h3>
                            <div className="flex flex-wrap gap-1">
                              {task.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <DialogFooter className="flex justify-between items-center">
                          {task.completed ? (
                            <Button
                              variant="outline"
                              onClick={() => {
                                handleReopenTask(task.id);
                              }}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" /> Reopen Task
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              onClick={() => {
                                handleMarkAsCompleted(task.id);
                              }}
                            >
                              <Check className="h-4 w-4 mr-2" /> Mark as Completed
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            onClick={() => {
                              handleDeleteTask(task.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete Task
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium">Task: {task.taskType}</p>
                  <p className="text-sm mt-1">{task.description}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {task.status === 'Completed' ? (
                      <span className="text-green-600 font-medium">Completed</span>
                    ) : (
                      <>{task.status} • Due {task.dueDate} • {task.assignedTo}</>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {/* Task Creation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Create a new task for a user account that needs assistance.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* User Account Selector */}
            <div className="grid gap-2">
              <Label htmlFor="userAccount">User Account</Label>
              <Select
                onValueChange={(value) => {
                  const selectedUser = users.find(user => user.id === value);
                  if (selectedUser) {
                    handleSelectUser(selectedUser);
                  }
                }}
                disabled={isLoadingUsers}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select user account..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingUsers ? (
                    <div className="py-6 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">Loading users...</p>
                    </div>
                  ) : error ? (
                    <div className="py-6 text-center">
                      <AlertCircle className="h-6 w-6 mx-auto text-destructive" />
                      <p className="text-sm text-destructive mt-2">{error}</p>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="py-6 text-center">
                      <p className="text-sm text-muted-foreground">No users found</p>
                    </div>
                  ) : (
                    users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Task Type */}
            <div className="grid gap-2">
              <Label htmlFor="taskType">Task Type</Label>
              <Select 
                value={newTask.taskType} 
                onValueChange={(value) => handleSelectChange('taskType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DNS Configuration">DNS Configuration</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                  <SelectItem value="Implementation">Implementation</SelectItem>
                  <SelectItem value="Training">Training</SelectItem>
                  <SelectItem value="Billing">Billing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={newTask.priority} 
                onValueChange={(value) => handleSelectChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={newTask.description}
                onChange={handleInputChange}
                placeholder="Describe the task..."
                className="resize-none"
                rows={3}
              />
            </div>

            {/* Assigned To */}
            <div className="grid gap-2">
              <Label htmlFor="assignedTo">Assigned To</Label>
              <Select 
                value={newTask.assignedTo} 
                onValueChange={(value) => handleSelectChange('assignedTo', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="Support Team">Support Team</SelectItem>
                  <SelectItem value="Tech Team">Tech Team</SelectItem>
                  <SelectItem value="Implementation Team">Implementation Team</SelectItem>
                  <SelectItem value="Account Manager">Account Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="grid gap-2">
              <Label htmlFor="tags">Issue Tags</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {newTask.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => handleRemoveTag(tag)} 
                    />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  id="tagInput"
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="flex-1"
                  onKeyDown={handleTagKeyDown}
                />
                <Button type="button" onClick={handleAddTag} variant="outline">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {tagSuggestions.filter(tag => !newTask.tags.includes(tag)).slice(0, 6).map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="outline" 
                    className="cursor-pointer" 
                    onClick={() => {
                      if (!newTask.tags.includes(tag)) {
                        setNewTask({
                          ...newTask,
                          tags: [...newTask.tags, tag]
                        });
                      }
                    }}
                  >
                    + {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={createTask} disabled={!newTask.userId || !newTask.taskType}>
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );

  // Function to save task to Supabase
  const saveTaskToSupabase = async (task: Task) => {
    try {
      // Insert the task into Supabase
      const { data, error } = await supabase
        .from('tasks') // Make sure this table exists in your Supabase instance
        .insert([
          {
            user_id: task.userId, // Using the userId for foreign key reference
            account_name: task.userAccount,
            email: task.userEmail,
            task_type: task.taskType,
            description: task.description,
            priority: task.priority,
            status: task.status,
            due_date: task.dueDate,
            assigned_to: task.assignedTo,
            tags: task.tags // Supabase supports array types
          }
        ]);

      if (error) {
        console.error("Error saving task to Supabase:", error);
        // We'll still show the task in the UI even if there's a backend error
        // This way the user experience isn't disrupted by backend issues
        return false;
      }

      console.log("Task successfully saved to Supabase:", data);
      return true;
    } catch (err) {
      console.error("Failed to save task:", err);
      return false;
    }
  };

  // Fetch tasks from Supabase on component mount
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('tasks')
          .select('*');

        if (error) {
          console.error('Error loading tasks:', error);
          setError('Failed to load tasks');
          // Fall back to sample tasks
          setTasks(sampleTasks);
          return;
        }

        console.log('Tasks loaded from Supabase:', data);
        
        if (data && data.length > 0) {
          // Map the data to match the Task interface
          const formattedTasks = data.map((task: any) => ({
            id: task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: task.userId || '',
            userAccount: task.userAccount || '',
            userEmail: task.userEmail || '',
            taskType: task.taskType || '',
            description: task.description || '',
            priority: task.priority || 'Medium',
            status: task.status || 'Open',
            dueDate: task.dueDate || new Date().toISOString().split('T')[0],
            assignedTo: task.assignedTo || 'Unassigned',
            tags: Array.isArray(task.tags) ? task.tags : [],
            completed: !!task.completed
          }));
          
          setTasks(formattedTasks);
        } else {
          // Use sample tasks if no tasks found
          console.log('No tasks found, using sample tasks');
          setTasks(sampleTasks);
        }
      } catch (error) {
        console.error('Error:', error);
        setError('Failed to load tasks due to an error');
        setTasks(sampleTasks);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, []);

// DUPLICATE:   // Update task in Supabase
// DUPLICATE:   const updateTaskInSupabase = async (taskId: string, updates: Partial<Task>) => {
// DUPLICATE:     try {
// DUPLICATE:       const { error } = await supabase
// DUPLICATE:         .from('tasks')
// DUPLICATE:         .update(updates)
// DUPLICATE:         .eq('id', taskId);
// DUPLICATE:       
// DUPLICATE:       if (error) {
// DUPLICATE:         console.error('Error updating task in Supabase:', error);
// DUPLICATE:         return false;
// DUPLICATE:       }
// DUPLICATE:       
// DUPLICATE:       return true;
// DUPLICATE:     } catch (error) {
// DUPLICATE:       console.error('Error:', error);
// DUPLICATE:       return false;
// DUPLICATE:     }
// DUPLICATE:   };
// DUPLICATE: 
// DUPLICATE:   // Delete task from Supabase
// DUPLICATE:   const deleteTaskFromSupabase = async (taskId: string) => {
// DUPLICATE:     try {
// DUPLICATE:       const { error } = await supabase
// DUPLICATE:         .from('tasks')
// DUPLICATE:         .delete()
// DUPLICATE:         .eq('id', taskId);
// DUPLICATE:       
// DUPLICATE:       if (error) {
// DUPLICATE:         console.error('Error deleting task from Supabase:', error);
// DUPLICATE:         return false;
// DUPLICATE:       }
// DUPLICATE:       
// DUPLICATE:       return true;
// DUPLICATE:     } catch (error) {
// DUPLICATE:       console.error('Error:', error);
// DUPLICATE:       return false;
// DUPLICATE:     }
// DUPLICATE:   };
  
  const handleAddTask = async () => {
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + 7); // Default due date: 7 days from now

    const newTaskItem: Task = {
      id: `task-${Date.now()}`,
      userId: newTask.userId,
      userAccount: newTask.userAccount,
      userEmail: newTask.userEmail,
      taskType: newTask.taskType,
      description: newTask.description,
      priority: newTask.priority,
      status: "Open",
      dueDate: dueDate.toISOString().split('T')[0],
      assignedTo: newTask.assignedTo === "unassigned" ? "Unassigned" : newTask.assignedTo,
      tags: [...newTask.tags],
      completed: false
    };

    // Add to local state first for immediate UI update
    setTasks([...tasks, newTaskItem]);
    
    // Close dialog and reset form
    setIsDialogOpen(false);
    resetForm();
    
    // Then save to Supabase (fire and forget)
    saveTaskToSupabase(newTaskItem).then(success => {
      if (!success) {
        // Optionally show a toast notification about the error
        // but keep the task in the UI for better UX
        console.error('Failed to save task to Supabase');
      }
    });
  };
  
  // Get today's date for comparing due dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="ml-auto" variant="default">
              Create New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Support Task</DialogTitle>
              <DialogDescription>
                Fill out the form below to create a new support task.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="taskType">Task Type</Label>
              <Select
                value={newTask.taskType}
                onValueChange={(value) => handleSelectChange("taskType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DNS Configuration">DNS Configuration</SelectItem>
                  <SelectItem value="Domain Transfer">Domain Transfer</SelectItem>
                  <SelectItem value="SSL Configuration">SSL Configuration</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                  <SelectItem value="Implementation">Implementation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={newTask.priority}
                onValueChange={(value) => handleSelectChange("priority", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={newTask.description}
                onChange={handleInputChange}
                placeholder="Enter task details..."
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {newTask.tags.map((tag, index) => (
                  <div 
                    key={index} 
                    className="bg-secondary text-secondary-foreground px-2 py-1 text-xs rounded-md flex items-center gap-1"
                  >
                    {tag}
                    <button 
                      type="button"
                      onClick={() => {
                        setNewTask(prev => ({
                          ...prev,
                          tags: prev.tags.filter((_, i) => i !== index)
                        }));
                      }}
                      className="text-muted-foreground hover:text-foreground rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  id="tag-input"
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="flex-grow"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault();
                      if (!newTask.tags.includes(tagInput.trim())) {
                        setNewTask(prev => ({
                          ...prev,
                          tags: [...prev.tags, tagInput.trim()]
                        }));
                      }
                      setTagInput('');
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddTask}>Create Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground">
                <th className="h-10 px-4 text-left font-medium">User Account</th>
                <th className="h-10 px-2 text-left font-medium">Task Type</th>
                <th className="h-10 px-2 text-left font-medium">Priority</th>
                <th className="h-10 px-2 text-left font-medium">Status</th>
                <th className="h-10 px-2 text-left font-medium">Due Date</th>
                <th className="h-10 px-2 text-left font-medium">Assigned To</th>
                <th className="h-10 px-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const dueDate = new Date(task.dueDate);
                const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                let priorityColor = "";
                switch(task.priority) {
                  case "Critical":
                    priorityColor = "bg-red-100 text-red-800";
                    break;
                  case "High":
                    priorityColor = "bg-orange-100 text-orange-800";
                    break;
                  case "Medium":
                    priorityColor = "bg-yellow-100 text-yellow-800";
                    break;
                  case "Low":
                    priorityColor = "bg-green-100 text-green-800";
                    break;
                }
                
                let statusColor = "";
                switch(task.status) {
                  case "Open":
                    statusColor = "bg-blue-100 text-blue-800";
                    break;
                  case "In Progress":
                    statusColor = "bg-purple-100 text-purple-800";
                    break;
                  case "Completed":
                    statusColor = "bg-green-100 text-green-800";
                    break;
                  case "Blocked":
                    statusColor = "bg-red-100 text-red-800";
                    break;
                }
                
                let dueDateColor = "bg-green-100 text-green-800";
                if (daysRemaining <= 1) {
                  dueDateColor = "bg-red-100 text-red-800";
                } else if (daysRemaining <= 3) {
                  dueDateColor = "bg-orange-100 text-orange-800";
                } else if (daysRemaining <= 5) {
                  dueDateColor = "bg-yellow-100 text-yellow-800";
                }
                
                return (
                  <tr key={task.id} className="border-b hover:bg-muted/50">
                    <td className="p-4 align-middle">
                      <div className="font-medium">{task.userAccount}</div>
                      <div className="text-xs text-muted-foreground">{task.userEmail}</div>
                    </td>
                    <td className="p-2 align-middle">{task.taskType}</td>
                    <td className="p-2 align-middle">
                      <div className={`inline-block rounded-full px-2 py-1 text-xs ${priorityColor}`}>
                        {task.priority}
                      </div>
                    </td>
                    <td className="p-2 align-middle">
                      <div className={`inline-block rounded-full px-2 py-1 text-xs ${statusColor}`}>
                        {task.status}
                      </div>
                    </td>
                    <td className="p-2 align-middle">
                      <div className={`inline-block rounded-full px-2 py-1 text-xs ${dueDateColor}`}>
                        {task.dueDate} ({daysRemaining} days)
                      </div>
                    </td>
                    <td className="p-2 align-middle">{task.assignedTo}</td>
                    <td className="p-4 align-middle text-right">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

interface PieChartDemoProps {
  title: string;
  description?: string;
}

export function PieChartDemo({ title, description }: PieChartDemoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex justify-center items-center h-64">
        <div className="relative w-40 h-40">
          {/* Placeholder for a pie chart */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold">65%</div>
                <div className="text-xs text-muted-foreground">Primary segment</div>
              </div>
            </div>
          </div>
          
          {/* Simple pie chart segments */}
          <svg viewBox="0 0 100 100" className="absolute inset-0">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="hsl(var(--primary))"
              strokeWidth="20"
              strokeDasharray="251.2 188.4"
              strokeDashoffset="0"
              transform="rotate(-90 50 50)"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="hsl(var(--muted))"
              strokeWidth="20"
              strokeDasharray="62.8 376.8"
              strokeDashoffset="-251.2"
              transform="rotate(-90 50 50)"
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

// Export a component to use these charts in the admin dashboard
export function AdminDashboardCharts() {
  const [metrics, setMetrics] = useState({
    totalActiveDomains: 42, // Mock data for now
    openTickets: 3, // Default to 3 as shown in the UI
    isLoading: false,
    error: null as string | null
  });

  // Handle ticket count updates from the TaskManagementSection
  const handleTaskCountChange = useCallback((count: number) => {
    setMetrics(prev => ({ ...prev, openTickets: count }));
  }, []);

  // Mock data used instead of API call
  // Will implement real API fetch later
  // useEffect(() => {
  //   const fetchDashboardMetrics = async () => {
  //     // API implementation here
  //   };
  //   fetchDashboardMetrics();
  // }, []);

  return (
    <div className="space-y-6">
      {/* Stats Cards Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Active Domains"
          value={metrics.isLoading ? '...' : metrics.totalActiveDomains.toLocaleString()}
          description="currently active"
          trend={metrics.isLoading ? undefined : { value: "", isPositive: true }}
        />
        <StatsCard
          title="Domains that need to be deployed"
          value="--"
          description="schema not yet built"
          trend={undefined}
        />
        <StatsCard
          title="Issues with domains"
          value="--"
          description="schema not yet built"
          trend={undefined}
        />
        <StatsCard
          title="Tickets Open"
          value={metrics.isLoading ? '...' : metrics.openTickets.toLocaleString()}
          description="awaiting response"
          trend={metrics.isLoading ? undefined : { value: "", isPositive: false }}
        />
      </div>
      
      {/* Clients Table - Full Width */}
      <div className="grid gap-6">
        <TaskManagementSection
          title="Support Tasks"
          description="Create and manage tasks for user accounts that need help"
          onTaskCountChange={handleTaskCountChange}
        />
      </div>
    </div>
  );
}
