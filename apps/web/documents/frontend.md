# Frontend Development Guide

This guide covers frontend development for the PITCH application using Next.js, shadcn/ui, and modern React practices.

## Tech Stack

- **Next.js 15** with App Router
- **React 19** 
- **TypeScript**
- **Tailwind CSS** v4
- **shadcn/ui** components
- **TanStack Query** for data fetching
- **NextAuth** for authentication
- **React Hook Form** for forms
- **Recharts** for data visualization

## Getting Started

### Development Server
```bash
# Start the frontend development server
pnpm --filter web dev

# Or from the root
pnpm dev
```

The frontend will be available at `http://localhost:3000`.

### Project Structure
```
apps/web/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Home page
│   │   └── globals.css     # Global styles
│   ├── components/         # React components
│   │   └── ui/            # shadcn/ui components
│   └── lib/               # Utilities and configurations
│       └── utils.ts       # Utility functions
├── public/                # Static assets
├── components.json        # shadcn/ui configuration
└── package.json
```

## shadcn/ui Setup and Usage

### Current Configuration
The project is already configured with shadcn/ui using the "new-york" style:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### Available Components
Currently installed shadcn/ui components:
- `Button` - Interactive button component
- `Card` - Content container
- `Chart` - Data visualization wrapper
- `Dialog` - Modal dialogs
- `Input` - Form input fields

### Adding New shadcn/ui Components

```bash
# Navigate to the web app directory
cd apps/web

# Add a new component
npx shadcn@latest add component-name

# Examples:
npx shadcn@latest add dropdown-menu
npx shadcn@latest add form
npx shadcn@latest add table
npx shadcn@latest add toast
```

### Using Components
```tsx
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Example Form</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input placeholder="Enter your name" />
          <Button>Submit</Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

## Development Practices

### Component Structure
```tsx
// components/my-component.tsx
import { cn } from "@/lib/utils"

interface MyComponentProps {
  className?: string
  children: React.ReactNode
}

export function MyComponent({ className, children }: MyComponentProps) {
  return (
    <div className={cn("base-styles", className)}>
      {children}
    </div>
  )
}
```

### Styling with Tailwind CSS
The project uses Tailwind CSS v4 with CSS variables for theming:

```tsx
// Use consistent spacing and sizing
<div className="space-y-4 p-6">
  <h1 className="text-2xl font-bold">Title</h1>
  <p className="text-muted-foreground">Description</p>
</div>

// Responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* content */}
</div>
```

### Data Fetching with TanStack Query
```tsx
import { useQuery } from "@tanstack/react-query"

export function DataComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["data"],
    queryFn: async () => {
      const response = await fetch("/api/data")
      return response.json()
    }
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading data</div>

  return (
    <div>
      {data?.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  )
}
```

### Form Handling with React Hook Form
```tsx
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface FormData {
  name: string
  email: string
}

export function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>()

  const onSubmit = (data: FormData) => {
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        {...register("name", { required: "Name is required" })}
        placeholder="Name"
      />
      {errors.name && <span className="text-red-500">{errors.name.message}</span>}
      
      <Input
        {...register("email", { required: "Email is required" })}
        type="email"
        placeholder="Email"
      />
      {errors.email && <span className="text-red-500">{errors.email.message}</span>}
      
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

## Customization

### Theme Customization
Edit `src/app/globals.css` to customize the design system:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    /* Add more custom CSS variables */
  }
}
```

### Custom Components
Create reusable components in `src/components/`:

```tsx
// src/components/custom-button.tsx
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CustomButtonProps {
  variant?: "primary" | "secondary"
  size?: "sm" | "md" | "lg"
  children: React.ReactNode
  className?: string
}

export function CustomButton({ 
  variant = "primary", 
  size = "md", 
  children, 
  className 
}: CustomButtonProps) {
  return (
    <Button
      className={cn(
        "custom-styles",
        variant === "primary" && "bg-blue-600 hover:bg-blue-700",
        size === "sm" && "px-2 py-1 text-sm",
        className
      )}
    >
      {children}
    </Button>
  )
}
```

## Building and Deployment

### Build Commands
```bash
# Development build
pnpm --filter web dev

# Production build
pnpm --filter web build

# Start production server
pnpm --filter web start

# Lint code
pnpm --filter web lint
```

### Environment Variables
Create `.env.local` in the `apps/web` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

## Best Practices

1. **Component Organization**
   - Keep components small and focused
   - Use TypeScript interfaces for props
   - Export components from index files

2. **Styling**
   - Use Tailwind utility classes
   - Leverage shadcn/ui components
   - Create custom variants with `cn()` utility

3. **State Management**
   - Use TanStack Query for server state
   - Use React useState for local component state
   - Consider Zustand for complex client state

4. **Performance**
   - Use Next.js Image component for images
   - Implement proper loading states
   - Lazy load components when appropriate

5. **Accessibility**
   - Use semantic HTML elements
   - Implement proper ARIA attributes
   - Test with keyboard navigation

## Troubleshooting

### Common Issues

**shadcn/ui component not found:**
```bash
# Make sure you're in the web directory
cd apps/web
npx shadcn@latest add component-name
```

**Tailwind classes not working:**
- Check that classes are not being purged
- Verify Tailwind CSS v4 configuration
- Restart the development server

**TypeScript errors:**
```bash
# Check TypeScript configuration
pnpm --filter web run type-check
```