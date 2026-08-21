# Plan: File and Image Attachments for Chat

Implement the ability for users to attach files and images to chat messages.

## Proposed Changes

### Database & Storage
- Create a new storage bucket `chat-attachments` in Supabase.
- Add an `attachments` JSONB column to the `chat_messages` table to store metadata (URL, name, type, size).
- Set up RLS for the storage bucket to allow authenticated users to upload and read.

### Chat Page (`src/routes/_authenticated/chat.tsx`)
- **Visual Text Update**: Replace the description in the general chat with the requested verbatim prompt.
- **Upload Functionality**:
    - Add a "Paperclip" icon/button next to the message input.
    - Implement a hidden file input to trigger the upload.
    - Handle multi-file selection and upload to the `chat-attachments` bucket.
    - Show a preview/list of pending attachments before sending.
- **Message Rendering**:
    - Update the message component to display attachments.
    - Show images as thumbnails/previews.
    - Show other files as downloadable links with icons.

## Technical Details
- Use Supabase Storage JS client for uploads.
- Limit file size and types if necessary (e.g., max 5MB, common formats).
- Use unique filenames (UUIDs) in storage to avoid collisions.

