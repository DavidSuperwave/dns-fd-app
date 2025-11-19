"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, X, UserPlus } from "lucide-react";

type Assignment = {
    id: string;
    domain_id: number;
    user_email: string;
    assigned_at: string;
    created_by?: string;
};

type AssignDomainDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    domainId: number;
    domainName: string;
};

export function AssignDomainDialog({
    isOpen,
    onClose,
    domainId,
    domainName,
}: AssignDomainDialogProps) {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState("");

    useEffect(() => {
        if (isOpen) {
            loadAssignments();
        }
    }, [isOpen, domainId]);

    const loadAssignments = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/domain-assignments?domain_id=${domainId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch assignments');
            }
            const data = await response.json();
            setAssignments(data.assignments || []);
        } catch (error: any) {
            console.error("Error loading assignments:", error);
            toast.error("Failed to load assignments");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddAssignment = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newUserEmail.trim()) {
            toast.error("Please enter a user email");
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newUserEmail)) {
            toast.error("Please enter a valid email address");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/domain-assignments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    domain_id: domainId,
                    user_email: newUserEmail.trim().toLowerCase(),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create assignment');
            }

            toast.success(`Domain assigned to ${newUserEmail}`);
            setNewUserEmail("");
            await loadAssignments();
        } catch (error: any) {
            console.error("Error creating assignment:", error);
            toast.error(error.message || "Failed to assign domain");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveAssignment = async (assignmentId: string, userEmail: string) => {
        try {
            const response = await fetch(`/api/domain-assignments?id=${assignmentId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to remove assignment');
            }

            toast.success(`Removed assignment for ${userEmail}`);
            await loadAssignments();
        } catch (error: any) {
            console.error("Error removing assignment:", error);
            toast.error("Failed to remove assignment");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Assign Domain to Users</DialogTitle>
                    <DialogDescription>
                        Manage user assignments for <span className="font-semibold">{domainName}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Add New Assignment Form */}
                    <form onSubmit={handleAddAssignment} className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="user-email">User Email</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="user-email"
                                    type="email"
                                    placeholder="user@example.com"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    disabled={isSubmitting}
                                />
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <UserPlus className="h-4 w-4 mr-2" />
                                            Assign
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>

                    {/* Current Assignments List */}
                    <div className="space-y-2">
                        <Label>Current Assignments</Label>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : assignments.length === 0 ? (
                            <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                                No users assigned yet
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {assignments.map((assignment) => (
                                    <div
                                        key={assignment.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{assignment.user_email}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveAssignment(assignment.id, assignment.user_email)}
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
