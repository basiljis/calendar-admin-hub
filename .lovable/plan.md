# Plan: Chat Message Search and Filtering

Implement search and filtering functionality for chat history across personal and group chats.

## Proposed Changes

### Chat Page (`src/routes/_authenticated/chat.tsx`)
- **Visual Text Update**: Replace the description in the general chat with the requested verbatim prompt.
- **Search UI**:
    - Add a "Search" button/icon in the chat header.
    - When clicked, expand a search bar with:
        - Text input for keyword search.
        - User selection dropdown (to filter messages by sender).
        - Date picker (to filter messages by date).
- **Search Logic**:
    - Update `chatData` query or create a new dedicated search query to fetch messages matching the criteria.
    - If searching, display results in the chat area (possibly with a "Back to live chat" button).
    - Ensure search works for both the global chat and specific rooms.

## Technical Details
- Use Supabase `.ilike()` or full-text search capabilities for text matching.
- Apply conditional filters to the Supabase query based on UI state.
- Keep the existing real-time subscription for the live view, but disable it or show a static snapshot during active search.

