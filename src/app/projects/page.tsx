"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  status: string;
  logo_url?: string | null;
  company_profile_id?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

type ProjectAction = "archive" | "unarchive" | "delete" | "restore";

export default function ProjectsPage() {
  const router = useRouter();
  const [viewFilter, setViewFilter] = useState<"all" | "deleted">("all");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectActionId, setProjectActionId] = useState<string | null>(null);
  const [projectActionLoading, setProjectActionLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [viewFilter]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      // Add debug=true to see all projects in console
      const debug = new URLSearchParams(window.location.search).get('debug') === 'true';
      const response = await fetch(`/api/projects?filter=${viewFilter}${debug ? '&debug=true' : ''}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Projects Page] Fetched projects:', data);
        const fetchedProjects = data.projects || [];
        setProjects(fetchedProjects);
        setError(null);
        
        if (fetchedProjects.length === 0) {
          console.warn('[Projects Page] No projects returned from API');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Projects Page] API error:', response.status, errorData);
        setError(errorData.error || 'Failed to fetch projects');
        // Mock data for testing
        const mockProjects: Project[] = [
          { 
            id: "prj-001", 
            name: "Acme Corp", 
            status: "active",
            logo_url: undefined,
            created_at: new Date().toISOString()
          },
          { 
            id: "prj-002", 
            name: "TechStart Inc", 
            status: "active",
            logo_url: undefined,
            created_at: new Date().toISOString()
          },
          { 
            id: "prj-003", 
            name: "Global Solutions", 
            status: "active",
            logo_url: undefined,
            created_at: new Date().toISOString()
          },
        ];
        setProjects(mockProjects.filter((p) => 
          viewFilter === "all" ? p.status !== "deleted" : p.status === "deleted"
        ));
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      setError(error instanceof Error ? error.message : 'Failed to fetch projects');
      setProjects([]); // Don't use mock data - show empty state instead
    } finally {
      setLoading(false);
    }
  };

  const handleProjectAction = async (project: Project, action: ProjectAction) => {
    if (projectActionLoading && projectActionId === project.id) {
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm(
        `Delete ${project.name}? This moves the project to Deleted projects.`
      );
      if (!confirmed) {
        return;
      }
    }

    const successMessages: Record<ProjectAction, string> = {
      archive: "Project archived",
      unarchive: "Project unarchived",
      delete: "Project deleted",
      restore: "Project restored",
    };

    setProjectActionId(project.id);
    setProjectActionLoading(true);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update project");
      }

      toast.success(successMessages[action] || "Project updated");
      await fetchProjects();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update project");
    } finally {
      setProjectActionLoading(false);
      setProjectActionId(null);
    }
  };

  const handleCardClick = (projectId: string, projectStatus: string) => {
    router.push(`/projects/${projectId}/campaign`);
  };

  const filteredProjects = useMemo(() => {
    console.log('[Projects Page] Filtering projects:', { 
      total: projects.length, 
      viewFilter, 
      projects: projects.map(p => ({ id: p.id, name: p.name, status: p.status, deleted_at: p.deleted_at }))
    });
    
    if (viewFilter === "all") {
      // Filter out deleted projects (either status = 'deleted' OR deleted_at is not null)
      const filtered = projects.filter((project) => 
        project.status !== "deleted" && !project.deleted_at
      );
      console.log('[Projects Page] Filtered (all):', filtered.length);
      return filtered;
    } else {
      // Show only deleted projects
      const filtered = projects.filter((project) => 
        project.status === "deleted" || project.deleted_at !== null
      );
      console.log('[Projects Page] Filtered (deleted):', filtered.length);
      return filtered;
    }
  }, [projects, viewFilter]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Organize campaign workstreams and infrastructure efforts.</p>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Project Board</CardTitle>
              <CardDescription>Use the filter to toggle between all projects or deleted ones.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                size="sm" 
                onClick={fetchProjects}
                disabled={loading}
              >
                Refresh
              </Button>
              <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as "all" | "deleted")}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                size="sm" 
                onClick={() => router.push('/create-company')}
              >
                Create Company
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Check browser console for details. Make sure the project's user_id matches your logged-in user ID.
                </p>
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground mb-4">
                  {viewFilter === "all" ? "No active projects yet." : "No deleted projects found."}
                </p>
                {viewFilter === "all" && (
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/create-company')}
                  >
                    Create Your First Company
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => {
                  const isGenerating = project.status === "generating";
                  const isDeleted = project.status === "deleted" || project.deleted_at !== null;
                  const isArchived = project.status === "archived";
                  const isActionPending = projectActionLoading && projectActionId === project.id;
                  return (
                    <Card 
                      key={project.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleCardClick(project.id, project.status)}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          {/* Logo */}
                          <div className="flex-shrink-0">
                            {project.logo_url ? (
                              <img
                                src={project.logo_url}
                                alt={`${project.name} logo`}
                                className="h-16 w-16 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="h-16 w-16 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                                <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                              </div>
                            )}
                          </div>

                          {/* Name and Status */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate">{project.name}</h3>
                            <div className="mt-2">
                              <Badge variant={isGenerating ? "secondary" : project.status === "active" ? "default" : "outline"}>
                                {isGenerating ? (
                                  <span className="flex items-center gap-1">
                                    <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full"></div>
                                    Generating
                                  </span>
                                ) : project.status === "active" ? (
                                  "Active"
                                ) : (
                                  project.status
                                )}
                              </Badge>
                            </div>
                            {isGenerating && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Report being generated...
                              </p>
                            )}
                          </div>

                        {/* Actions Menu */}
                        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => handleCardClick(project.id, project.status)}
                              >
                                View Report
                              </DropdownMenuItem>
                              <DropdownMenuItem>Edit</DropdownMenuItem>
                              {!isDeleted && (
                                <DropdownMenuItem
                                  disabled={isActionPending}
                                  onClick={() =>
                                    handleProjectAction(project, isArchived ? "unarchive" : "archive")
                                  }
                                >
                                  {isArchived ? "Unarchive" : "Archive"}
                                </DropdownMenuItem>
                              )}
                              {isDeleted ? (
                                <DropdownMenuItem
                                  disabled={isActionPending}
                                  onClick={() => handleProjectAction(project, "restore")}
                                >
                                  Restore
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  disabled={isActionPending}
                                  onClick={() => handleProjectAction(project, "delete")}
                                >
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

