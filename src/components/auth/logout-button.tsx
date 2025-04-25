"use client";

import { Button } from "../ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "./auth-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LogoutButton() {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className="text-muted-foreground hover:text-foreground"
    >
      <LogOut className="h-4 w-4 mr-2" />
      <span>Logout</span>
    </Button>
  );
}