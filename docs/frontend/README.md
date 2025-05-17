# Frontend Documentation

## Overview

The frontend of Meowsenger is built using Next.js with App Router, TypeScript, and Tailwind CSS. It provides a modern, responsive user interface with real-time messaging capabilities.

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v3.4.17
- **UI Components**: HeroUI v2.7.8
- **Form Handling**: react-hook-form
- **State Management**: React Context API
- **Real-time Communication**: WebSocket

## Project Structure

```
frontend/
├── app/                 # Next.js App Router pages and layouts
├── components/          # Reusable React components
├── contexts/           # React Context providers
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── styles/             # Global styles and Tailwind config
├── public/             # Static assets
└── config/             # Configuration files
```

## Key Components

### 1. Layout Components
- `RootLayout`: Main application layout
- `AuthLayout`: Authentication pages layout
- `ChatLayout`: Chat interface layout

### 2. Feature Components
- `ChatWindow`: Main chat interface
- `MessageList`: Message display and management
- `UserList`: User/contact list
- `GroupManagement`: Group chat management
- `Settings`: User settings interface

### 3. Shared Components
- `Button`: Custom button component
- `Input`: Form input component
- `Modal`: Modal dialog component
- `Avatar`: User avatar component

## State Management

The application uses React Context for state management:

1. **AuthContext**: Manages authentication state
2. **ChatContext**: Manages chat state and messages
3. **ThemeContext**: Manages theme preferences
4. **LanguageContext**: Manages internationalization

## Custom Hooks

1. `useWebSocket`: WebSocket connection management
2. `useAuth`: Authentication and user management
3. `useChat`: Chat functionality
4. `useTheme`: Theme management
5. `useLanguage`: Language and translation management

## Routing

The application uses Next.js App Router with the following main routes:

- `/`: Home page
- `/auth`: Authentication pages
- `/chat`: Chat interface
- `/settings`: User settings
- `/profile`: User profile

## Styling Guidelines

1. Use Tailwind CSS for styling
2. Follow mobile-first responsive design
3. Use HeroUI components when available
4. Maintain consistent spacing and typography
5. Support dark/light theme

## Best Practices

1. **Component Development**:
   - Use functional components
   - Implement proper TypeScript types
   - Follow React best practices
   - Optimize with useMemo and useCallback

2. **Performance**:
   - Implement proper code splitting
   - Optimize images and assets
   - Use proper caching strategies
   - Monitor bundle size

3. **Code Quality**:
   - Follow ESLint rules
   - Write unit tests
   - Document components
   - Use proper error handling

## Development Workflow

1. **Setup**:
   ```bash
   npm install
   npm run dev
   ```

2. **Building**:
   ```bash
   npm run build
   ```

3. **Testing**:
   ```bash
   npm run test
   ```

## Environment Variables

Required environment variables:
- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_WS_URL`: WebSocket URL
- `NEXT_PUBLIC_ENV`: Environment (development/production)

## Contributing

1. Follow the coding standards
2. Write tests for new features
3. Update documentation
4. Create proper PR descriptions

## Common Issues and Solutions

1. **WebSocket Connection Issues**:
   - Check network connectivity
   - Verify WebSocket URL
   - Check authentication token

2. **Build Issues**:
   - Clear `.next` directory
   - Update dependencies
   - Check TypeScript errors 