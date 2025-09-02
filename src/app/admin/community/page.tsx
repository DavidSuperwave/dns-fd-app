"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Paperclip, Smile, Bell, Users, Settings, Search, Menu, ChevronDown, Plus, CreditCard, Globe, NotebookPen } from 'lucide-react';
import { TicketIcon } from 'lucide-react';

export default function AdminCommunityPage() {
  const [activeCompany, setActiveCompany] = useState<string | null>('acme-corp');
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Mock company detailed information
  const companyDetails = {
    'acme-corp': {
      name: 'Acme Corporation',
      plan: 'Enterprise',
      subscription: 'Annual',
      status: 'Active',
      joined: 'Jan 15, 2023',
      contactEmail: 'contact@acmecorp.com',
      website: 'www.acmecorp.com',
      employees: '500-1000',
      location: 'San Francisco, CA',
      industry: 'Technology'
    },
    'globex': {
      name: 'Globex Industries',
      plan: 'Business',
      subscription: 'Monthly',
      status: 'Active',
      joined: 'Mar 22, 2023',
      contactEmail: 'info@globex.com',
      website: 'www.globex.com',
      employees: '100-500',
      location: 'Chicago, IL',
      industry: 'Manufacturing'
    },
    'soylent': {
      name: 'Soylent Corp',
      plan: 'Enterprise',
      subscription: 'Annual',
      status: 'Active',
      joined: 'Sep 5, 2022',
      contactEmail: 'hello@soylentcorp.com',
      website: 'www.soylentcorp.com',
      employees: '1000+',
      location: 'New York, NY',
      industry: 'Food Technology'
    },
    'initech': {
      name: 'Initech',
      plan: 'Starter',
      subscription: 'Monthly',
      status: 'Trial',
      joined: 'May 12, 2023',
      contactEmail: 'support@initech.com',
      website: 'www.initech.com',
      employees: '50-100',
      location: 'Austin, TX',
      industry: 'Software'
    },
    'umbrella': {
      name: 'Umbrella Corp',
      plan: 'Enterprise',
      subscription: 'Annual',
      status: 'Active',
      joined: 'Feb 28, 2023',
      contactEmail: 'contact@umbrellacorp.com',
      website: 'www.umbrellacorp.com',
      employees: '5000+',
      location: 'Seattle, WA',
      industry: 'Pharmaceuticals'
    }
  };

  // Define company and DM types for proper typing
  interface Company {
    id: string;
    name: string;
    unread: number;
    status: string;
  }

  interface DirectMessage {
    id: string;
    name: string;
    status: string;
    unread: number;
  }

  // Sample companies with state for unread counts
  const [companies, setCompanies] = useState<Company[]>([
    { id: 'acme-corp', name: 'Acme Corporation', unread: 2, status: 'active' },
    { id: 'globex', name: 'Globex Industries', unread: 0, status: 'active' },
    { id: 'soylent', name: 'Soylent Corp', unread: 5, status: 'active' },
    { id: 'initech', name: 'Initech', unread: 0, status: 'active' },
    { id: 'umbrella', name: 'Umbrella Corp', unread: 1, status: 'active' }
  ]);

  // Sample direct messages with state for unread counts
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([
    { id: 'sarah', name: 'Sarah Johnson', status: 'online', unread: 2 },
    { id: 'michael', name: 'Michael Chen', status: 'away', unread: 0 },
    { id: 'amelia', name: 'Amelia Rodriguez', status: 'offline', unread: 0 }
  ]);

  // Define message type with proper TypeScript interface
  interface Message {
    id: string;
    sender: string;
    content: string;
    timestamp: string;
    type: string;
    avatar?: string; // Make avatar optional to fix TypeScript errors
  }

  // Define initial message data
  const initialCompanyMessages: Record<string, Message[]> = {
    'acme-corp': [
      { id: 'acme-1', sender: 'John Doe', content: 'Here is the latest report from Acme Corporation.', timestamp: '9:30 AM', type: 'user', avatar: 'JD' },
      { id: 'acme-2', sender: 'System', content: 'Acme Corporation renewed their subscription', timestamp: '9:35 AM', type: 'system' },
      { id: 'acme-3', sender: 'Sarah Johnson', content: 'Great news! Their usage is up 25% this month.', timestamp: '9:40 AM', type: 'user', avatar: 'SJ' },
    ],
    'globex': [
      { id: 'globex-1', sender: 'System', content: 'Globex Industries joined Superwave', timestamp: '2 days ago', type: 'system' },
      { id: 'globex-2', sender: 'Michael Chen', content: 'Welcome to the platform! Let me know if you need help getting started.', timestamp: '2 days ago', type: 'user', avatar: 'MC' },
    ],
    'soylent': [
      { id: 'soylent-1', sender: 'Amelia Rodriguez', content: 'Soylent Corp is having issues with the API integration.', timestamp: 'Yesterday', type: 'user', avatar: 'AR' },
      { id: 'soylent-2', sender: 'Sarah Johnson', content: "I'll check their error logs and get back to you.", timestamp: 'Yesterday', type: 'user', avatar: 'SJ' },
      { id: 'soylent-3', sender: 'Michael Chen', content: "Found the issue - their webhook URL is incorrect. I'll send them an update.", timestamp: '3 hours ago', type: 'user', avatar: 'MC' },
      { id: 'soylent-4', sender: 'System', content: 'Support ticket #4582 created', timestamp: '3 hours ago', type: 'system' },
      { id: 'soylent-5', sender: 'Amelia Rodriguez', content: 'Thanks for the quick response.', timestamp: '2 hours ago', type: 'user', avatar: 'AR' },
    ],
    'initech': [
      { id: 'initech-1', sender: 'System', content: 'Initech completed onboarding', timestamp: 'Last week', type: 'system' },
    ],
    'umbrella': [
      { id: 'umbrella-1', sender: 'Sarah Johnson', content: 'Umbrella Corp is interested in upgrading to the enterprise plan.', timestamp: 'This morning', type: 'user', avatar: 'SJ' },
      { id: 'umbrella-2', sender: 'Michael Chen', content: "I'll schedule a call with their procurement team.", timestamp: '1 hour ago', type: 'user', avatar: 'MC' },
    ],
  };

  // Define initial direct message data
  const initialDmMessages: Record<string, Message[]> = {
    'sarah': [
      { id: 'sarah-1', sender: 'Sarah Johnson', content: 'Have you reviewed the quarterly report?', timestamp: 'Yesterday', type: 'user', avatar: 'SJ' },
      { id: 'sarah-2', sender: 'You', content: 'Yes, I have some feedback. The numbers look good.', timestamp: 'Yesterday', type: 'current-user', avatar: 'YO' },
      { id: 'sarah-3', sender: 'Sarah Johnson', content: "Great! Let's discuss it in the team meeting.", timestamp: 'This morning', type: 'user', avatar: 'SJ' },
    ],
    'michael': [
      { id: 'michael-1', sender: 'You', content: 'Michael, do you have a moment to discuss the Soylent Corp case?', timestamp: '3 days ago', type: 'current-user', avatar: 'YO' },
      { id: 'michael-2', sender: 'Michael Chen', content: 'Sure, what do you need?', timestamp: '3 days ago', type: 'user', avatar: 'MC' },
    ],
    'amelia': [
      { id: 'amelia-1', sender: 'Amelia Rodriguez', content: 'The new feature request came in from Acme Corp', timestamp: 'Last week', type: 'user', avatar: 'AR' },
      { id: 'amelia-2', sender: 'You', content: "Thanks for letting me know. I'll prioritize it for next sprint.", timestamp: 'Last week', type: 'current-user', avatar: 'YO' },
    ],
  };
  
  // State for message data
  const [companyMessages, setCompanyMessages] = useState<Record<string, Message[]>>(initialCompanyMessages);
  const [dmMessages, setDmMessages] = useState<Record<string, Message[]>>(initialDmMessages);

  // Get current messages based on active selection
  const getCurrentMessages = () => {
    if (activeChannel) {
      const dmId = directMessages.find(dm => dm.id === activeChannel)?.id;
      if (dmId === 'sarah') return dmMessages.sarah;
      if (dmId === 'michael') return dmMessages.michael;
      if (dmId === 'amelia') return dmMessages.amelia;
      return [];
    } else if (activeCompany) {
      return companyMessages[activeCompany as keyof typeof companyMessages] || [];
    }
    return [];
  };
  
  const messages = getCurrentMessages();
  
  // Scroll to bottom of messages on load and when messages change
  useEffect(() => {
    scrollToBottom();
  }, [companyMessages, dmMessages, activeCompany, activeChannel]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Send message function
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (message.trim()) {
      // In a real implementation, we would send this to a backend
      // For now, we'll just update our local state
      const recipient = activeCompany 
        ? companies.find(c => c.id === activeCompany)?.name 
        : directMessages.find(dm => dm.id === activeChannel)?.name;
      
      console.log(`Sending message to ${recipient}:`, message);
      
      // Create new message object
      const newMessage = {
        id: `new-${Date.now()}`,
        sender: 'You',
        content: message,
        timestamp: 'Just now',
        type: 'current-user',
        avatar: 'YO'
      };
      
      // Update the appropriate message list with the new message
      if (activeCompany) {
        setCompanyMessages(prevMessages => ({
          ...prevMessages,
          [activeCompany]: [...(prevMessages[activeCompany] || []), newMessage]
        }));
      } else if (activeChannel) {
        setDmMessages(prevMessages => ({
          ...prevMessages,
          [activeChannel]: [...(prevMessages[activeChannel] || []), newMessage]
        }));
      }
      
      // Clear the input
      setMessage('');
      
      // Scroll to bottom after sending message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <div className="flex flex-row h-full w-full bg-background overflow-hidden -m-6 min-h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-60 bg-slate-900 text-white flex flex-col h-full overflow-hidden">
        {/* Workspace Header */}
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          <div className="font-bold text-lg flex items-center">
            <span>Messages</span>
            <ChevronDown className="h-4 w-4 ml-1" />
          </div>
          <Bell className="h-5 w-5 text-slate-300" />
        </div>
        
        {/* Channels */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          <div>
            <div className="text-slate-400 text-sm font-medium mb-2 flex items-center justify-between">
              <span>Companies</span>
              <button className="hover:bg-slate-700 p-1 rounded">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1">
              {companies.map(company => (
                <li key={company.id}>
                  <button 
                    onClick={() => {
                      setActiveCompany(company.id);
                      setActiveChannel(null);
                      
                      // Clear unread count for this company
                      setCompanies(prevCompanies => 
                        prevCompanies.map(c => 
                          c.id === company.id ? { ...c, unread: 0 } : c
                        )
                      );
                    }}
                    className={`w-full text-left flex items-center rounded py-1.5 px-2 ${activeCompany === company.id ? 'bg-primary text-primary-foreground' : 'hover:bg-slate-800'}`}
                  >
                    <div className="bg-blue-500 h-3 w-3 rounded-sm mr-2"></div>
                    <span className="flex-1 truncate">{company.name}</span>
                    {company.unread > 0 && activeCompany !== company.id && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                        {company.unread}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          
          {/* User Messages - Fixed at bottom */}
          <div className="mt-auto">
            <div className="text-slate-400 text-sm font-medium mb-2 flex items-center justify-between">
              <span>Direct Messages</span>
              <button className="hover:bg-slate-700 p-1 rounded">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1">
              {directMessages.map(dm => (
                <li key={dm.id}>
                  <button 
                    onClick={() => {
                      setActiveChannel(dm.id);
                      setActiveCompany(null);
                      
                      // Clear unread count for this direct message
                      setDirectMessages(prevDMs => 
                        prevDMs.map(d => 
                          d.id === dm.id ? { ...d, unread: 0 } : d
                        )
                      );
                    }}
                    className={`w-full text-left flex items-center rounded py-1.5 px-2 ${activeChannel === dm.id ? 'bg-green-600 text-white' : 'hover:bg-slate-800'}`}
                  >
                    <div className={`h-3 w-3 rounded-full mr-2 ${dm.status === 'online' ? 'bg-green-500' : dm.status === 'away' ? 'bg-yellow-500' : 'bg-slate-500'}`}></div>
                    <span className="flex-1 truncate">{dm.name}</span>
                    {dm.unread > 0 && activeChannel !== dm.id && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                        {dm.unread}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-slate-200">
        {/* Chat Header */}
        <div className="border-b border-slate-200 p-3 flex items-center justify-between">
          <div className="flex items-center">
            <div className={`h-3 w-3 ${activeCompany ? 'bg-blue-500 rounded-sm' : 'bg-green-500 rounded-full'} mr-2`}></div>
            <h2 className="font-semibold">
              {activeCompany ? companies.find(c => c.id === activeCompany)?.name : 
               activeChannel ? directMessages.find(dm => dm.id === activeChannel)?.name : 
               'Select a conversation'}
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <button className="p-1.5 rounded-md hover:bg-slate-100">
              <Users className="h-5 w-5 text-slate-500" />
            </button>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
              <Input placeholder="Search messages" className="pl-9 w-64 h-9 rounded-md" />
            </div>
            <button className="p-1.5 rounded-md hover:bg-slate-100">
              <Settings className="h-5 w-5 text-slate-500" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-slate-100 lg:hidden">
              <Menu className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Messages Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col min-h-0">
          {activeCompany && (
            <div className="flex justify-center mb-4">
              <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-2 text-center">
                <p className="text-blue-700">Viewing company chat for {companies.find(c => c.id === activeCompany)?.name}</p>
              </div>
            </div>
          )}
          {activeChannel && (
            <div className="flex justify-center mb-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-md px-4 py-2 text-center">
                <p className="text-emerald-700">Direct message with {directMessages.find(d => d.id === activeChannel)?.name}</p>
              </div>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.type === 'system' ? 'justify-center' : msg.type === 'current-user' ? 'justify-end' : ''}`}>
              {msg.type !== 'system' && msg.type !== 'current-user' && (
                <Avatar className="h-9 w-9 mr-2 mt-0.5">
                  <AvatarFallback>{msg.avatar}</AvatarFallback>
                </Avatar>
              )}
              <div className={`
                ${msg.type === 'system' ? 'bg-yellow-50 border border-yellow-100 rounded-md px-4 py-2 text-center max-w-[80%]' : ''}
                ${msg.type === 'current-user' ? 'bg-primary text-primary-foreground rounded-md px-4 py-2 max-w-[80%]' : ''}
                ${msg.type === 'user' ? 'flex-1' : ''}
              `}>
                {msg.type !== 'system' && (
                  <div className="flex items-baseline">
                    <span className="font-semibold">{msg.sender}</span>
                    <span className="text-xs text-slate-400 ml-2">{msg.timestamp}</span>
                  </div>
                )}
                <div className={msg.type !== 'system' ? 'mt-1' : ''}>
                  <p className={msg.type === 'system' ? 'text-yellow-700' : ''}>{msg.content}</p>
                </div>
              </div>
              {msg.type === 'current-user' && (
                <Avatar className="h-9 w-9 ml-2 mt-0.5">
                  <AvatarFallback>{msg.avatar}</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t p-3">
          <form onSubmit={handleSendMessage} className="relative">
            <Input 
              placeholder={activeChannel ? 
                `Message ${directMessages.find(dm => dm.id === activeChannel)?.name}` : 
                activeCompany ? `Message ${companies.find(c => c.id === activeCompany)?.name}` : 'Type a message...'
              } 
              value={message} 
              onChange={(e) => setMessage(e.target.value)}
              className="w-full py-2 pl-4 pr-24 rounded-md border border-slate-300"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                <Smile className="h-4 w-4" />
              </Button>
              <Button type="submit" size="icon" className="h-8 w-8 rounded-full">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Quick Action Panel - Always Visible */}
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Quick Actions</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {/* Company Information Section */}
            {activeCompany && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center text-slate-800">
                  <Users className="h-4 w-4 mr-2" /> 
                  Company Info
                </h4>
                <div className="bg-slate-50 p-3 rounded-md">
                  <div className="mb-2 pb-2 border-b border-slate-200">
                    <h5 className="font-semibold text-md">{companyDetails[activeCompany as keyof typeof companyDetails]?.name}</h5>
                    <span className="inline-block px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800 mt-1">
                      {companyDetails[activeCompany as keyof typeof companyDetails]?.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Plan:</span>
                      <span className="font-medium">{companyDetails[activeCompany as keyof typeof companyDetails]?.plan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Subscription:</span>
                      <span className="font-medium">{companyDetails[activeCompany as keyof typeof companyDetails]?.subscription}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Joined:</span>
                      <span className="font-medium">{companyDetails[activeCompany as keyof typeof companyDetails]?.joined}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Industry:</span>
                      <span className="font-medium">{companyDetails[activeCompany as keyof typeof companyDetails]?.industry}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Size:</span>
                      <span className="font-medium">{companyDetails[activeCompany as keyof typeof companyDetails]?.employees}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Location:</span>
                      <span className="font-medium">{companyDetails[activeCompany as keyof typeof companyDetails]?.location}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Contact:</div>
                      <div className="text-sm break-all">{companyDetails[activeCompany as keyof typeof companyDetails]?.contactEmail}</div>
                      <div className="text-sm break-all">{companyDetails[activeCompany as keyof typeof companyDetails]?.website}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeChannel && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center text-slate-800">
                  <Users className="h-4 w-4 mr-2" /> 
                  User Info
                </h4>
                <div className="bg-slate-50 p-3 rounded-md">
                  <div className="flex items-center gap-3 mb-2 pb-2 border-b border-slate-200">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {activeChannel === 'sarah' ? 'SJ' : activeChannel === 'michael' ? 'MC' : 'AR'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h5 className="font-semibold text-md">
                        {activeChannel === 'sarah' ? 'Sarah Johnson' : 
                         activeChannel === 'michael' ? 'Michael Chen' : 
                         'Amelia Rodriguez'}
                      </h5>
                      <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                        {activeChannel === 'sarah' ? 'Online' : 
                         activeChannel === 'michael' ? 'Away' : 
                         'Offline'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Role:</span>
                      <span className="font-medium">
                        {activeChannel === 'sarah' ? 'Customer Success Manager' : 
                         activeChannel === 'michael' ? 'Support Engineer' : 
                         'Product Specialist'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Department:</span>
                      <span className="font-medium">
                        {activeChannel === 'sarah' ? 'Customer Success' : 
                         activeChannel === 'michael' ? 'Support' : 
                         'Product'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Joined:</span>
                      <span className="font-medium">
                        {activeChannel === 'sarah' ? 'Mar 2021' : 
                         activeChannel === 'michael' ? 'Jan 2022' : 
                         'Nov 2020'}
                      </span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Contact:</div>
                      <div className="text-sm break-all">
                        {activeChannel === 'sarah' ? 'sarah.j@superwave.ai' : 
                         activeChannel === 'michael' ? 'michael.c@superwave.ai' : 
                         'amelia.r@superwave.ai'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Create Ticket Section */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center text-slate-800">
                <TicketIcon className="h-4 w-4 mr-2" /> Create Ticket
              </h4>
              <div className="bg-slate-50 p-3 rounded-md">
                <Button className="w-full" variant="outline">
                  New Support Ticket
                </Button>
                <div className="mt-2 text-sm text-slate-500">
                  Create a new support ticket for {activeCompany ? companies.find(c => c.id === activeCompany)?.name : activeChannel ? directMessages.find(dm => dm.id === activeChannel)?.name : 'current contact'}
                </div>
              </div>
            </div>
            
            {/* Create Note Section */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center text-slate-800">
                <NotebookPen className="h-4 w-4 mr-2" /> Add Note
              </h4>
              <div className="bg-slate-50 p-3 rounded-md">
                <Input placeholder="Type a note..." className="mb-2" />
                <Button className="w-full" variant="outline">
                  Save Note
                </Button>
              </div>
            </div>
            
            {/* Payment Link Section */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center text-slate-800">
                <CreditCard className="h-4 w-4 mr-2" /> Payment
              </h4>
              <div className="bg-slate-50 p-3 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <Input placeholder="Amount" type="number" className="w-1/2" />
                  <select className="w-1/2 h-9 rounded-md border border-input bg-transparent px-3 py-1">
                    <option>One-time</option>
                    <option>Monthly</option>
                    <option>Annual</option>
                  </select>
                </div>
                <Button className="w-full" variant="outline">
                  Generate Payment Link
                </Button>
              </div>
            </div>
            
            {/* Domain Check Section */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center text-slate-800">
                <Globe className="h-4 w-4 mr-2" /> Domain Check
              </h4>
              <div className="bg-slate-50 p-3 rounded-md">
                <Input placeholder="Enter domain name..." className="mb-2" />
                <Button className="w-full" variant="outline">
                  Check Domain Status
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
