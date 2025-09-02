"use client";

import React, { useState } from "react";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { useAuth } from "../../components/auth/auth-provider";

export default function CommunityPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("discussions");

  return (
    <DashboardLayout>
      <div className="py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Community</h1>
          <Button>Create Post</Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="discussions">Discussions</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>
          
          <TabsContent value="discussions">
            <div className="grid grid-cols-1 gap-6">
              {/* Sample Discussion Cards - Replace with real data */}
              <CommunityCard 
                title="Welcome to our Community!" 
                author="Admin Team"
                date="2025-07-28"
                description="This is a place to connect, share tips, and help each other succeed." 
                commentCount={5}
                likeCount={12}
              />
              
              <CommunityCard 
                title="Best practices for domain management" 
                author="David Moore"
                date="2025-07-26"
                description="I've been managing domains for a while, here are some tips I've learned along the way." 
                commentCount={8}
                likeCount={24}
              />
              
              <CommunityCard 
                title="Question about redirects" 
                author="Sarah Williams"
                date="2025-07-24"
                description="Has anyone found a good way to manage multiple redirects efficiently?" 
                commentCount={12}
                likeCount={7}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="announcements">
            <div className="grid grid-cols-1 gap-6">
              <CommunityCard 
                title="New Features Released!" 
                author="Product Team"
                date="2025-07-29"
                description="We've just released new features including the community section you're exploring now." 
                commentCount={3}
                likeCount={45}
                isAnnouncement={true}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="resources">
            <div className="grid grid-cols-1 gap-6">
              <CommunityCard 
                title="Domain Management Guide" 
                author="Knowledge Base"
                date="2025-07-15"
                description="A comprehensive guide to managing domains effectively." 
                commentCount={0}
                likeCount={18}
                isResource={true}
              />
              
              <CommunityCard 
                title="Video: Setting up redirects" 
                author="Tutorial Team"
                date="2025-07-10"
                description="Watch this step-by-step guide on setting up and managing redirects." 
                commentCount={0}
                likeCount={32}
                isResource={true}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

interface CommunityCardProps {
  title: string;
  author: string;
  date: string;
  description: string;
  commentCount: number;
  likeCount: number;
  isAnnouncement?: boolean;
  isResource?: boolean;
}

function CommunityCard({ 
  title, 
  author, 
  date, 
  description, 
  commentCount, 
  likeCount, 
  isAnnouncement = false,
  isResource = false
}: CommunityCardProps) {
  return (
    <Card className={`${isAnnouncement ? 'border-blue-500 border-l-4' : isResource ? 'border-green-500 border-l-4' : ''}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription className="text-sm mt-1">
              Posted by {author} • {date}
            </CardDescription>
          </div>
          {isAnnouncement && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              Announcement
            </span>
          )}
          {isResource && (
            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              Resource
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
      <CardFooter className="flex justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{commentCount} comments</span>
          <span>{likeCount} likes</span>
        </div>
        <Button variant="ghost" size="sm">
          Read More
        </Button>
      </CardFooter>
    </Card>
  );
}
