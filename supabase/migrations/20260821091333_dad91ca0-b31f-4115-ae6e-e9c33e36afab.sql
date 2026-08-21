-- Storage RLS policies for chat-attachments bucket
-- Allow authenticated users to upload to chat-attachments
create policy "Authenticated users can upload chat attachments"
on storage.objects for insert
to authenticated
with check (bucket_id = 'chat-attachments');

-- Allow authenticated users to view chat attachments
create policy "Authenticated users can view chat attachments"
on storage.objects for select
to authenticated
using (bucket_id = 'chat-attachments');

-- Allow users to delete their own attachments
create policy "Users can delete their own chat attachments"
on storage.objects for delete
to authenticated
using (bucket_id = 'chat-attachments' and owner = auth.uid());