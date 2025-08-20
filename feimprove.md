# Frontend UI Improvement Prompt

## Current Issue
The deployed frontend at https://scanner-frontend-242181373909.us-central1.run.app has severe styling issues:
- No card styling visible
- No proper spacing or padding
- Buttons and inputs appear unstyled
- Missing Tailwind CSS classes
- Overall broken/weak UI appearance

## Root Cause
The Tailwind CSS is not being applied properly in production build, likely due to:
1. PostCSS configuration issues with Tailwind v4
2. CSS purging removing necessary styles
3. Build process not processing Tailwind classes

## Fix Requirements

### 1. Fix Tailwind CSS Production Build
- Ensure Tailwind CSS v4 is properly configured for Next.js production builds
- Fix PostCSS configuration to work with `@tailwindcss/postcss`
- Ensure all component classes are included in the production CSS

### 2. Verify CSS is Loading
- Check that globals.css is being imported and processed
- Ensure Tailwind directives (@tailwind base/components/utilities) are working
- Verify CSS file is being served in production

### 3. Component Styling Checklist
All components should have proper styling:
- **Cards**: White background, shadow, rounded borders, proper padding
- **Buttons**: Primary blue background, hover states, proper padding
- **Inputs**: Border, rounded corners, focus states
- **Layout**: Proper spacing between elements, responsive grid
- **Header**: Clean white header with shadow
- **Typography**: Proper font sizes and weights

### 4. Specific Fixes Needed
Based on the screenshot:
- ScanForm component should be in a card with padding
- Input fields need borders and styling
- Buttons need background colors and hover states
- Overall layout needs proper container and spacing
- Quick Actions section needs card styling

### 5. Testing Requirements
- Build locally with `npm run build && npm start` to verify production build
- Check that all Tailwind classes are present in the final CSS
- Ensure no hydration mismatches between server and client

## Quick Fix Approach
1. Downgrade to Tailwind CSS v3 if v4 compatibility issues persist
2. Use inline styles or CSS modules as a temporary fix for critical components
3. Add a production-specific CSS file with all necessary styles

## Expected Result
A clean, modern UI with:
- Properly styled cards with shadows
- Blue primary buttons with hover effects
- Clean input fields with borders
- Proper spacing and layout
- Professional appearance matching the original design