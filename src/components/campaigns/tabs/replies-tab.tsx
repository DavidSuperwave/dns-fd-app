"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Search,
    Inbox,
    Tag,
    Send,
    Archive,
    FileText,
    Star,
    Clock,
    MoreVertical,
    ChevronLeft,
    ChevronRight,
    Reply,
    Megaphone,
    Mail
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// Mock data for development/visual verification
const MOCK_REPLIES = [
    {
        id: "1",
        sender: "Ben Petraglia",
        email: "ben@accelerate.com",
        subject: "Re: Deliverability issues",
        preview: "Excellent Ben - to not waste your time or ours before w...",
        time: "08:31 PM",
        date: "Nov 18, 2025",
        campaign: "12.11.2025 - Superwave Infra - No C",
        status: "Interested",
        unread: true,
        body: "Excellent Ben - to not waste your time or ours before we jump on a call, could you send over some pricing info?\n\nThanks,\nBen"
    },
    {
        id: "2",
        sender: "Nasif Sid",
        email: "nasif@6sensehq.com",
        subject: "Re: Campaigns not performing?",
        preview: "Sounds great, thanks for the update! On Tue, 18 Nov, 20...",
        time: "12:53 PM",
        date: "Nov 18, 2025",
        campaign: "12.11.2025 - Superwave Infra",
        status: "Meeting Booked",
        unread: false,
        body: "Sounds great, thanks for the update! On Tue, 18 Nov, 2025 at 12:00 PM, David wrote:\n> Hey Nasif,\n> Just checking in on this."
    },
    {
        id: "3",
        sender: "Omkar Shinde",
        email: "omkar.shinde@e...",
        subject: "Opt out",
        preview: "--- Best regards, Omkar Shinde Director of Data Partner...",
        time: "08:54 AM",
        date: "Nov 18, 2025",
        campaign: "12.11.2025 - Superwave Infra - No Outlook - A",
        status: "Opt out",
        unread: false,
        body: "Please remove me from your list."
    },
    {
        id: "4",
        sender: "Elizabeth Ortlieb",
        email: "elizabeth@alp...",
        subject: "Re: Deliverability issues",
        preview: "Please remove me from your list, not interested *Elizabe...",
        time: "07:49 AM",
        date: "Nov 18, 2025",
        campaign: "12.11.2025 - Superwave Infra - I",
        status: "Not Interested",
        unread: false,
        body: "Please remove me from your list, not interested\n\n*Elizabeth Ortlieb*"
    }
];

export function RepliesTab({ projectId }: { projectId: string }) {
    const [selectedReplyId, setSelectedReplyId] = useState<string | null>(null);
    const [activeFolder, setActiveFolder] = useState("inbox");

    const selectedReply = MOCK_REPLIES.find(r => r.id === selectedReplyId);

    function getStatusColor(status: string) {
        switch (status) {
            case "Interested": return "bg-pink-100 text-pink-700 border-pink-200";
            case "Meeting Booked": return "bg-green-100 text-green-700 border-green-200";
            case "Not Interested": return "bg-gray-100 text-gray-700 border-gray-200";
            case "Opt out": return "bg-red-100 text-red-700 border-red-200";
            default: return "bg-blue-100 text-blue-700 border-blue-200";
        }
    }

    return (
        <div className="flex h-[calc(100vh-220px)] min-h-[600px] border rounded-lg overflow-hidden bg-background shadow-sm">
            {/* Left Sidebar - Navigation */}
            <div className="w-64 border-r bg-muted/10 flex flex-col">
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-lg flex items-center gap-2">
                            <Mail className="h-5 w-5 text-primary" />
                            Inbox
                            <Badge variant="secondary" className="ml-auto bg-blue-600 text-white hover:bg-blue-700">1</Badge>
                        </h2>
                    </div>

                    <div className="space-y-1">
                        <Button variant="ghost" className="w-full justify-between font-normal bg-secondary/50">
                            <span className="flex items-center gap-2"><Inbox className="h-4 w-4" /> Labels</span>
                            <ChevronRight className="h-4 w-4 opacity-50" />
                        </Button>
                        <Button variant="ghost" className="w-full justify-between font-normal">
                            <span className="flex items-center gap-2"><Megaphone className="h-4 w-4" /> Campaigns</span>
                            <ChevronRight className="h-4 w-4 opacity-50" />
                        </Button>
                        <Button variant="ghost" className="w-full justify-between font-normal">
                            <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Emails</span>
                            <ChevronRight className="h-4 w-4 opacity-50" />
                        </Button>
                    </div>

                    <div className="mt-8 space-y-1">
                        <Button variant="ghost" className="w-full justify-start gap-2 font-normal text-muted-foreground">
                            <FileText className="h-4 w-4" /> Others
                        </Button>
                        <Button variant="ghost" className="w-full justify-start gap-2 font-normal text-muted-foreground">
                            <Clock className="h-4 w-4" /> Scheduled
                        </Button>
                        <Button variant="ghost" className="w-full justify-start gap-2 font-normal text-muted-foreground">
                            <Send className="h-4 w-4" /> Sent
                        </Button>
                        <Button variant="ghost" className="w-full justify-start gap-2 font-normal text-muted-foreground">
                            <Star className="h-4 w-4" /> Starred
                        </Button>
                        <Button variant="ghost" className="w-full justify-start gap-2 font-normal text-muted-foreground">
                            <Archive className="h-4 w-4" /> Archive
                        </Button>
                        <Button variant="ghost" className="w-full justify-start gap-2 font-normal text-muted-foreground">
                            <FileText className="h-4 w-4" /> Drafts
                        </Button>
                    </div>
                </div>

                <div className="mt-auto p-4 space-y-2">
                    <Button variant="outline" className="w-full justify-start gap-2 border-pink-200 text-pink-700 hover:bg-pink-50">
                        <Star className="h-4 w-4" /> AI Reply Agent
                    </Button>
                    <Button className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4" /> Compose Email
                    </Button>
                </div>
            </div>

            {/* Middle Pane - Message List */}
            <div className="w-96 border-r flex flex-col bg-white">
                <div className="p-4 border-b space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Your Replies (170)</h3>
                        <div className="flex items-center gap-2">
                            <Checkbox id="unread-only" />
                            <label htmlFor="unread-only" className="text-xs text-muted-foreground cursor-pointer">Show only unread</label>
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox />
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search mail" className="pl-8 h-9" />
                        </div>
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="divide-y">
                        {MOCK_REPLIES.map((reply) => (
                            <div
                                key={reply.id}
                                onClick={() => setSelectedReplyId(reply.id)}
                                className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedReplyId === reply.id ? 'bg-blue-50/50' : ''} ${reply.unread ? 'bg-white' : 'bg-gray-50/50'}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${reply.unread ? 'bg-pink-100 text-pink-700' : 'bg-gray-200 text-gray-600'}`}>
                                        {reply.sender.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-sm truncate ${reply.unread ? 'font-semibold' : 'font-medium'}`}>
                                                {reply.sender}
                                            </span>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                                {reply.time}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate mb-1">
                                            &lt;{reply.email}&gt;
                                        </div>
                                        <div className={`text-sm truncate mb-1 ${reply.unread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                            {reply.subject}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate mb-2">
                                            {reply.preview}
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            <Badge variant="secondary" className="text-[10px] px-1.5 h-5 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 truncate max-w-[120px]">
                                                <Megaphone className="h-3 w-3 mr-1" />
                                                {reply.campaign}
                                            </Badge>
                                            <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${getStatusColor(reply.status)}`}>
                                                <Tag className="h-3 w-3 mr-1" />
                                                {reply.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="p-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>1-50 of 170</span>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled><ChevronLeft className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>

            {/* Right Pane - Message Detail */}
            <div className="flex-1 bg-white flex flex-col">
                {selectedReply ? (
                    <div className="flex flex-col h-full">
                        <div className="p-6 border-b">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-semibold mb-2">{selectedReply.subject}</h2>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Badge variant="outline" className={getStatusColor(selectedReply.status)}>
                                            {selectedReply.status}
                                        </Badge>
                                        <span className="text-muted-foreground">in</span>
                                        <span className="text-blue-600">{selectedReply.campaign}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm">
                                        <Archive className="h-4 w-4 mr-2" />
                                        Archive
                                    </Button>
                                    <Button variant="outline" size="sm">
                                        <Tag className="h-4 w-4 mr-2" />
                                        Label
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center font-medium text-gray-600">
                                    {selectedReply.sender.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{selectedReply.sender}</span>
                                        <span className="text-sm text-muted-foreground">{selectedReply.date} at {selectedReply.time}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">&lt;{selectedReply.email}&gt;</div>
                                </div>
                            </div>
                        </div>

                        <ScrollArea className="flex-1 p-6">
                            <div className="prose prose-sm max-w-none">
                                <p className="whitespace-pre-wrap">{selectedReply.body}</p>
                            </div>
                        </ScrollArea>

                        <div className="p-4 border-t bg-gray-50">
                            <div className="flex gap-2">
                                <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                                    <Reply className="h-4 w-4 mr-2" />
                                    Reply
                                </Button>
                                <Button variant="outline" className="w-full sm:w-auto">
                                    Forward
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                        <div className="w-64 h-48 bg-blue-50 rounded-2xl mb-6 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-transparent" />
                            <Mail className="h-24 w-24 text-blue-200" />
                            <div className="absolute bottom-8 right-8 bg-blue-500 h-16 w-20 rounded-lg shadow-lg transform rotate-12 flex items-center justify-center">
                                <Mail className="h-8 w-8 text-white" />
                            </div>
                        </div>
                        <h3 className="text-lg font-medium mb-2">Select an email to read</h3>
                        <p className="text-sm text-center max-w-xs">
                            Choose a conversation from the list to view details and reply.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function Plus(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    )
}
