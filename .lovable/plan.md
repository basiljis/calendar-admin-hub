# Plan: Chat Notifications and Unread Messages

Implement real-time notifications for new chat messages and tracking of unread status for employees and admins.

## Proposed Changes

### Database Schema
- **New Table**: `chat_unread_messages` or similar to track which messages have been seen by which users.
    - Fields: `user_id`, `room_id`, `last_seen_at`.
- **Update `notifications`**: Ensure chat messages trigger entries in the existing `notifications` table if the user is not currently in the chat room.

### Chat Logic (`src/routes/_authenticated/chat.tsx`)
- **Unread Tracking**:
    - Update "last seen" timestamp when a user enters a room or receives a message while in the room.
    - Fetch unread counts for each room in the sidebar.
- **In-App Notifications**:
    - Trigger a browser/UI notification when a message arrives in a room the user is not currently viewing.
    - Update the existing notification bell (AppLayout) to include chat message alerts.

### Layout (`src/components/AppLayout.tsx`)
- Ensure the notification bell reflects unread chat messages.

## Technical Details
- Use Supabase `postgres_changes` subscription to detect new messages.
- Use a dedicated table or a JSONB field in profiles to track unread status efficiently.
- Integrate with the existing `notifications` system for consistency.

