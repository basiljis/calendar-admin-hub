# Plan: UI Refresh based on Reference Image

Update the application's overall style and specifically refactor the chat interface to match the layout and design of the provided reference image (user-uploads://file-3).

## Proposed Changes

### Global Styling (src/styles.css)
- Update theme variables to match the clean, light-blue tinted aesthetic of the reference.
- Focus on soft shadows, rounded corners, and a light background palette (#F8FAFC, #F1F5F9).

### App Layout (src/components/AppLayout.tsx)
- Refactor the sidebar to match the reference:
  - Narrow sidebar with icons and labels.
  - Consistent spacing and active state styling (blue background for active icon/item).
  - Add a "Need help?" or "Chat" button at the bottom of the sidebar as seen in the reference.

### Chat Page (src/routes/_authenticated/chat.tsx)
- Refactor the chat UI into a two-column layout that feels like part of a unified dashboard:
  - Sidebar for chat list (left).
  - Main message area (right) with a cleaner header.
  - Use the "Card" style with subtle borders and shadows as shown in the reference.
- Implement a floating or dedicated "New Message" button separately if it fits the new layout.

### Dashboard (src/routes/dashboard.tsx)
- Update the dashboard cards and charts to align with the "Key Indicators" and "Load Dynamics" visual style from the reference.

## Technical Details
- Utilize Tailwind CSS v4 variables for consistent colors.
- Use Lucide icons that match the reference's simplified style.
- Maintain existing logic and server functions while completely overhauling the presentation layer.

