-- Chat Messaging Schema Migration
-- This migration adds the necessary tables for Slack-style messaging functionality
-- including company channels, direct messages, and message storage

-- Step 1: Create channels table for company-specific channels
CREATE TABLE IF NOT EXISTS public.chat_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, name)
);

-- Step 2: Create direct_message_threads table for DM conversations
CREATE TABLE IF NOT EXISTS public.chat_dm_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create chat_dm_participants table to track participants in each DM thread
CREATE TABLE IF NOT EXISTS public.chat_dm_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES public.chat_dm_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(thread_id, user_id)
);

-- Step 4: Create messages table to store all messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
    dm_thread_id UUID REFERENCES public.chat_dm_threads(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_system_message BOOLEAN DEFAULT false,
    reaction_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    parent_message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    CHECK ((channel_id IS NOT NULL AND dm_thread_id IS NULL) OR 
           (channel_id IS NULL AND dm_thread_id IS NOT NULL))
);

-- Step 5: Create message_reads table to track read status for unread count
CREATE TABLE IF NOT EXISTS public.chat_message_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, message_id)
);

-- Step 6: Create channel_members table to track channel membership
CREATE TABLE IF NOT EXISTS public.chat_channel_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- Step 7: Create message_attachments table for files, images, etc.
CREATE TABLE IF NOT EXISTS public.chat_message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 8: Create RLS policies for the chat tables

-- Channel policies
CREATE POLICY channels_select_policy ON public.chat_channels
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.user_company_memberships ucm
            WHERE ucm.user_id = auth.uid() 
            AND ucm.company_id = chat_channels.company_id
        ) OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Message policies
CREATE POLICY messages_select_policy ON public.chat_messages
    FOR SELECT TO authenticated USING (
        -- For channel messages
        (chat_messages.channel_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.chat_channel_members ccm
            JOIN public.chat_channels cc ON ccm.channel_id = cc.id
            JOIN public.user_company_memberships ucm ON ucm.company_id = cc.company_id
            WHERE ccm.user_id = auth.uid() AND ccm.channel_id = chat_messages.channel_id
        )) OR
        -- For direct messages
        (chat_messages.dm_thread_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.chat_dm_participants cdp
            WHERE cdp.user_id = auth.uid() AND cdp.thread_id = chat_messages.dm_thread_id
        )) OR
        -- For admins
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY messages_insert_policy ON public.chat_messages
    FOR INSERT TO authenticated WITH CHECK (
        -- Users can insert messages to channels they're members of
        (chat_messages.channel_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.chat_channel_members
            WHERE user_id = auth.uid() AND channel_id = chat_messages.channel_id
        )) OR
        -- Users can insert messages to DM threads they're part of
        (chat_messages.dm_thread_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.chat_dm_participants
            WHERE user_id = auth.uid() AND thread_id = chat_messages.dm_thread_id
        )) OR
        -- Admins can insert messages anywhere
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- View for unread message counts
CREATE OR REPLACE VIEW public.chat_unread_counts AS
    SELECT 
        u.id AS user_id,
        COALESCE(cm.channel_id, cdp.thread_id) AS conversation_id,
        CASE 
            WHEN cm.channel_id IS NOT NULL THEN 'channel'
            ELSE 'direct_message'
        END AS conversation_type,
        COUNT(msg.id) AS unread_count
    FROM 
        auth.users u
    LEFT JOIN public.chat_channel_members cm ON cm.user_id = u.id
    LEFT JOIN public.chat_dm_participants cdp ON cdp.user_id = u.id
    LEFT JOIN public.chat_messages msg ON 
        (msg.channel_id = cm.channel_id OR msg.dm_thread_id = cdp.thread_id)
    LEFT JOIN public.chat_message_reads mr ON mr.message_id = msg.id AND mr.user_id = u.id
    WHERE 
        mr.id IS NULL AND
        msg.sender_id != u.id AND
        msg.created_at > (
            SELECT COALESCE(MAX(last_login), (NOW() - INTERVAL '30 days'))
            FROM public.user_sessions
            WHERE user_id = u.id
        )
    GROUP BY
        u.id, conversation_id, conversation_type;

-- Function to mark messages as read for a specific conversation
CREATE OR REPLACE FUNCTION mark_conversation_as_read(
    p_user_id UUID,
    p_conversation_id UUID,
    p_conversation_type TEXT
)
RETURNS VOID AS $$
BEGIN
    IF p_conversation_type = 'channel' THEN
        INSERT INTO public.chat_message_reads (user_id, message_id)
        SELECT p_user_id, m.id
        FROM public.chat_messages m
        LEFT JOIN public.chat_message_reads mr ON mr.message_id = m.id AND mr.user_id = p_user_id
        WHERE m.channel_id = p_conversation_id AND mr.id IS NULL AND m.sender_id != p_user_id
        ON CONFLICT (user_id, message_id) DO NOTHING;
    ELSIF p_conversation_type = 'direct_message' THEN
        INSERT INTO public.chat_message_reads (user_id, message_id)
        SELECT p_user_id, m.id
        FROM public.chat_messages m
        LEFT JOIN public.chat_message_reads mr ON mr.message_id = m.id AND mr.user_id = p_user_id
        WHERE m.dm_thread_id = p_conversation_id AND mr.id IS NULL AND m.sender_id != p_user_id
        ON CONFLICT (user_id, message_id) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql;
