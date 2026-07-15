# Smart Electricity Meter System
ss
A full-stack web application for monitoring, managing, and analyzing electricity consumption data. Built with React (frontend) and Node.js + Express (backend).

---

## Table of Contents

- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Team Structure & Responsibilities](#team-structure--responsibilities)
- [Getting Started](#getting-started)
- [Git Workflow](#git-workflow)
- [UI Style Guide](#ui-style-guide)
- [Branch Naming Convention](#branch-naming-convention)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Environment Variables](#environment-variables)
- [Member-Specific Guides](#member-specific-guides)
  - [Member 1 — Project Lead & UI System](#member-1--project-lead--ui-system)
  - [Member 2 — Authentication & User Management](#member-2--authentication--user-management)
  - [Member 3 — Dashboard & Electricity Monitoring](#member-3--dashboard--electricity-monitoring)
  - [Member 4 — Backend API & Database](#member-4--backend-api--database)
- [API Reference](#api-reference)
- [Development Roadmap](#development-roadmap)
- [Code Review Checklist](#code-review-checklist)

---

## Project Overview

The Smart Electricity Meter System provides a centralized platform for electricity data management. It allows administrators to track consumption, manage user accounts, generate billing reports, and monitor meter data in real time. The system is designed to scale from a university project into a production-ready metering platform.

---

## Technology Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React (Vite), Tailwind CSS        |
| Backend  | Node.js, Express.js               |
| Database | MongoDB / PostgreSQL (configured by Member 4) |
| Auth     | JWT (JSON Web Tokens)             |
| Charts   | Recharts / Chart.js               |
| Version Control | Git + GitHub               |
| Containerization | Docker (optional)         |

---

## Repository Structure

```
smart-meter/
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/       # Shared reusable UI components (Member 1)
│       ├── pages/            # Page-level components
│       │   ├── auth/         # Login, Register, ForgotPassword (Member 2)
│       │   ├── dashboard/    # Dashboard, Analytics (Member 3)
│       │   ├── meters/       # Meter List, Consumption View (Member 3)
│       │   └── reports/      # Reports page (Member 3)
│       ├── layouts/          # Shared layout wrappers (Member 1)
│       ├── services/         # API call functions
│       ├── hooks/            # Custom React hooks
│       ├── context/          # Global state (AuthContext, etc.)
│       ├── utils/            # Helper functions
│       ├── routes/           # Route definitions
│       └── App.jsx
│
├── backend/
│   └── src/
│       ├── config/           # DB connection, environment config (Member 4)
│       ├── controllers/      # Request handlers (Member 4)
│       ├── models/           # Database schemas/models (Member 4)
│       ├── routes/           # API route definitions (Member 4)
│       ├── middleware/       # Auth middleware, error handling (Member 4)
│       ├── services/         # Business logic layer (Member 4)
│       └── app.js
│
├── docs/
│   ├── API.md
│   ├── DATABASE.md
│   ├── ARCHITECTURE.md
│   ├── REQUIREMENTS.md
│   └── MEETING_NOTES.md
│
├── .github/
│   └── workflows/
│
├── docker/
├── docker-compose.yml
├── README.md
└── .gitignore
```

---

## Team Structure & Responsibilities

| Member   | Role                              | Primary Ownership |
|----------|-----------------------------------|-------------------|
| Member 1 | Project Lead & UI System          | `frontend/src/components/`, `frontend/src/layouts/` |
| Member 2 | Authentication & User Management  | `frontend/src/pages/auth/`, `backend/src/routes/authRoutes.js` |
| Member 3 | Dashboard & Electricity Monitoring| `frontend/src/pages/dashboard/`, `frontend/src/pages/meters/` |
| Member 4 | Backend API & Database            | `backend/src/` (all) |

---

## Getting Started

### Prerequisites

Ensure the following are installed on your machine:

- [Node.js](https://nodejs.org/) v18 or higher
- [Git](https://git-scm.com/)
- A code editor (VS Code recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/smart-meter.git
cd smart-meter
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` by default.

### 3. Install Backend Dependencies

```bash
cd backend
npm install
npm run dev
```

The backend runs at `http://localhost:5000` by default.

### 4. Configure Environment Variables

Copy the example environment files and fill in the values:

```bash
cp backend/.env.example backend/.env
```

See the [Environment Variables](#environment-variables) section for details.

---

## Git Workflow

This project follows a feature branch workflow. **Never commit directly to `main`.**

### Step-by-Step

**1. Before starting any work, sync your local repository:**

```bash
git checkout main
git pull origin main
```

**2. Create a new feature branch from `main`:**

```bash
git checkout -b feature/your-feature-name
```

**3. Work on your feature, committing frequently:**

```bash
git add .
git commit -m "feat: add login page UI"
```

**4. Push your branch to GitHub:**

```bash
git push origin feature/your-feature-name
```

**5. Open a Pull Request on GitHub:**

- Base branch: `main`
- Compare branch: `feature/your-feature-name`
- Add a clear title and description
- Request a review from at least one other team member

**6. After approval, merge the Pull Request on GitHub.**

**7. Delete the remote branch after merging (GitHub offers this automatically).**

---

## UI Style Guide

All frontend members must follow this guide strictly. Consistency across the application depends entirely on it.

### Color Palette

| Token        | Hex       | Usage                         |
|--------------|-----------|-------------------------------|
| Primary      | `#2563EB` | Buttons, links, active states |
| Secondary    | `#64748B` | Subtext, inactive labels      |
| Success      | `#16A34A` | Success badges, alerts        |
| Danger       | `#DC2626` | Errors, destructive actions   |
| Background   | `#F8FAFC` | Page background               |
| Surface      | `#FFFFFF` | Cards, modals                 |
| Border       | `#E2E8F0` | Dividers, input borders       |

Do not use any color that is not in this palette.

### Typography

- **Font family:** Inter or Roboto (imported via Google Fonts)
- **Headings:** 24px / 20px / 18px, font-weight 600
- **Body text:** 14px or 16px, font-weight 400
- **Labels / captions:** 12px, font-weight 500

### Spacing System

Use multiples of 8px for all padding, margin, and gap values:

`4px` · `8px` · `16px` · `24px` · `32px` · `48px` · `64px`

### Component Rules

- All buttons must use the shared `<Button />` component
- All data tables must use the shared `<Table />` component
- All form inputs must use the shared `<Input />` component
- All pages must be wrapped in `<DashboardLayout />`
- Do not hardcode inline styles unless absolutely necessary

---

## Branch Naming Convention

```
feature/short-description       # New functionality
fix/short-description           # Bug fixes
chore/short-description         # Config, tooling, refactoring
docs/short-description          # Documentation only
```

Examples:

```
feature/login-page
feature/meter-list
fix/auth-token-expiry
chore/update-dependencies
docs/api-endpoints
```

---

## Commit Message Convention

Use the following format for all commits:

```
type: short description (max 72 characters)
```

| Type       | When to Use                                  |
|------------|----------------------------------------------|
| `feat`     | Adding a new feature                         |
| `fix`      | Fixing a bug                                 |
| `style`    | UI/CSS changes with no logic change          |
| `refactor` | Code restructuring without feature change    |
| `docs`     | Documentation only                           |
| `chore`    | Build config, dependencies, tooling          |
| `test`     | Adding or updating tests                     |

Examples:

```
feat: add consumption chart to dashboard
fix: resolve JWT token not refreshing
style: update button hover state to match style guide
docs: add API endpoint for meter data
```

---

## Pull Request Process

Before opening a Pull Request, verify the following:

- Your branch is up to date with `main` (`git pull origin main` and resolve any conflicts)
- The code runs without errors
- You have tested your feature manually
- Your code follows the UI style guide
- You have not introduced any hardcoded secrets or credentials

When reviewing a Pull Request:

- Check that shared components are used correctly
- Verify the UI matches the color palette and spacing system
- Confirm no inline styles or random colors are introduced
- Test the feature if possible before approving

A Pull Request requires at least one approval before merging.

---

## Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```env
PORT=5000
NODE_ENV=development

DATABASE_URL=your_database_connection_string

JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:5173
```

Never commit `.env` files to the repository. They are listed in `.gitignore`.

---

## Member-Specific Guides

---

### Member 1 — Project Lead & UI System

**Branch:** `feature/ui-system`

**Your responsibilities:**

- Initialize the React project using Vite
- Configure Tailwind CSS
- Build all shared reusable components
- Define the global design system and layout
- Review Pull Requests from all other members for UI consistency

**Folder Ownership:**

```
frontend/src/components/
frontend/src/layouts/
frontend/src/assets/
frontend/src/context/
```

**Components to Build:**

| Component       | File                          |
|-----------------|-------------------------------|
| Button          | `components/Button.jsx`        |
| Card            | `components/Card.jsx`          |
| Navbar          | `components/Navbar.jsx`        |
| Sidebar         | `components/Sidebar.jsx`       |
| Table           | `components/Table.jsx`         |
| Modal           | `components/Modal.jsx`         |
| Input           | `components/Input.jsx`         |
| Dashboard Layout| `layouts/DashboardLayout.jsx`  |

**Setup Instructions:**

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install recharts react-router-dom axios
```

Configure `tailwind.config.js`:

```js
content: ["./index.html", "./src/**/*.{js,jsx}"]
```

**Important Rules:**

- Define all colors and fonts in `tailwind.config.js` under `theme.extend` so all members use the same tokens
- Keep the DashboardLayout consistent; all pages must use it
- Maintain a `UI_STYLE_GUIDE.md` in the `docs/` folder
- Communicate to the team immediately when a shared component is updated

---

### Member 2 — Authentication & User Management

**Branch:** `feature/authentication`

**Your responsibilities:**

- Build login, register, and forgot password pages
- Integrate authentication APIs provided by Member 4
- Handle JWT token storage and route protection
- Build the user profile page

**Folder Ownership:**

```
frontend/src/pages/auth/
frontend/src/services/authService.js
frontend/src/context/AuthContext.jsx
frontend/src/hooks/useAuth.js
```

**Pages to Build:**

| Page            | File                          |
|-----------------|-------------------------------|
| Login           | `pages/auth/Login.jsx`         |
| Register        | `pages/auth/Register.jsx`      |
| Forgot Password | `pages/auth/ForgotPassword.jsx`|
| User Profile    | `pages/auth/Profile.jsx`       |

**Setup Instructions:**

Wait for Member 1 to complete the base component setup before building pages. Then:

```bash
git checkout main
git pull origin main
git checkout -b feature/authentication
```

Use Member 1's components exclusively:

```jsx
import Button from '../../components/Button';
import Input from '../../components/Input';
import DashboardLayout from '../../layouts/DashboardLayout';
```

**API Integration:**

Coordinate with Member 4 on the following endpoints:

```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/forgot-password
GET  /api/users/profile
PUT  /api/users/profile
```

Store the JWT token in `localStorage` or `httpOnly` cookies (confirm approach with Member 4).

**Protected Routes:**

Create a `PrivateRoute` wrapper that redirects unauthenticated users to `/login`.

**Important Rules:**

- Never store passwords in state or local variables
- Always use `AuthContext` for sharing login state across the app
- Use environment variables for the API base URL (`import.meta.env.VITE_API_URL`)

---

### Member 3 — Dashboard & Electricity Monitoring

**Branch:** `feature/dashboard`

**Your responsibilities:**

- Build the main dashboard and analytics pages
- Display electricity consumption data using charts and tables
- Build the meter list and consumption view pages
- Integrate with APIs provided by Member 4

**Folder Ownership:**

```
frontend/src/pages/dashboard/
frontend/src/pages/meters/
frontend/src/pages/reports/
frontend/src/services/meterService.js
```

**Pages to Build:**

| Page                  | File                                    |
|-----------------------|-----------------------------------------|
| Dashboard Home        | `pages/dashboard/Dashboard.jsx`         |
| Meter List            | `pages/meters/MeterList.jsx`            |
| Consumption Analytics | `pages/meters/ConsumptionAnalytics.jsx` |
| Reports               | `pages/reports/Reports.jsx`             |

**Setup Instructions:**

```bash
git checkout main
git pull origin main
git checkout -b feature/dashboard
npm install recharts
```

**Chart Implementation:**

Use Recharts for all charts. Example usage:

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
```

All charts must be wrapped in `<ResponsiveContainer width="100%" height={300}>` to ensure responsiveness.

**API Integration:**

Coordinate with Member 4 on the following endpoints:

```
GET /api/meters
GET /api/meters/:id
GET /api/consumption
GET /api/consumption?meterId=&startDate=&endDate=
GET /api/reports
```

**Important Rules:**

- Use the shared `<Table />` component for all data tables
- Charts must be responsive on all screen sizes
- Always show a loading state while API data is being fetched
- Always show an error state if the API call fails
- Use `DashboardLayout` for every page

---

### Member 4 — Backend API & Database

**Branch:** `feature/backend-api`

**Your responsibilities:**

- Set up the Node.js + Express server
- Configure the database connection
- Build all REST API endpoints
- Implement authentication middleware
- Handle input validation and error handling
- Document all endpoints in `docs/API.md`

**Folder Ownership:**

```
backend/src/config/
backend/src/controllers/
backend/src/models/
backend/src/routes/
backend/src/middleware/
backend/src/services/
backend/server.js
backend/src/app.js
```

**Setup Instructions:**

```bash
cd backend
npm init -y
npm install express mongoose dotenv bcryptjs jsonwebtoken cors express-validator
npm install -D nodemon
```

Add to `package.json`:

```json
"scripts": {
  "dev": "nodemon server.js",
  "start": "node server.js"
}
```

**APIs to Build:**

| Method | Endpoint                   | Description                  |
|--------|----------------------------|------------------------------|
| POST   | `/api/auth/login`          | Authenticate a user          |
| POST   | `/api/auth/register`       | Register a new user          |
| GET    | `/api/users`               | Get all users (admin only)   |
| GET    | `/api/users/:id`           | Get a specific user          |
| PUT    | `/api/users/:id`           | Update a user                |
| GET    | `/api/meters`              | Get all meters               |
| GET    | `/api/meters/:id`          | Get a specific meter         |
| GET    | `/api/consumption`         | Get consumption data         |
| GET    | `/api/reports`             | Get generated reports        |

**Standard API Response Format:**

All responses must follow this structure for consistency:

```json
// Success
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}

// Error
{
  "success": false,
  "error": "Error description"
}
```

**Important Rules:**

- Use environment variables for all secrets (database URL, JWT secret). Never hardcode them.
- All protected routes must use the `authMiddleware` to verify the JWT token
- Validate all incoming request data before processing
- Return meaningful HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Document every endpoint in `docs/API.md` as you build it so frontend members can integrate without waiting
- Share the `.env.example` file (not `.env`) so other members know which variables are required

---

## API Reference

Full documentation is maintained in [`docs/API.md`](docs/API.md).

A brief summary of available endpoints:

```
POST   /api/auth/login
POST   /api/auth/register
GET    /api/users
GET    /api/meters
GET    /api/consumption
GET    /api/reports
```

---

## Development Roadmap

### Phase 1 — Current Focus

- [ ] Project setup and shared UI components
- [ ] Authentication (login, register, JWT)
- [ ] User management
- [ ] Dashboard and meter list views
- [ ] Consumption data visualization
- [ ] Core REST APIs

### Phase 2 — Next

- [ ] Billing module
- [ ] Tariff management
- [ ] Notifications system
- [ ] Advanced analytics

### Phase 3 — Future

- [ ] ESP32 smart meter integration
- [ ] MQTT / HTTP gateway
- [ ] Modbus protocol support
- [ ] Mobile application

---

## Code Review Checklist

Use this checklist when reviewing a Pull Request:

**UI & Styling**
- [ ] Uses shared components (`Button`, `Input`, `Table`, `Modal`)
- [ ] Uses `DashboardLayout` on all pages
- [ ] No hardcoded colors or font sizes outside the style guide
- [ ] No inline styles unless justified
- [ ] Responsive on mobile and desktop

**Code Quality**
- [ ] No console logs left in production code
- [ ] No unused imports or variables
- [ ] Functions are small and have a single responsibility
- [ ] No sensitive data (passwords, tokens) logged or exposed

**Git**
- [ ] Branch is up to date with `main`
- [ ] Commit messages follow the convention
- [ ] PR description clearly explains what was changed and why

**Functionality**
- [ ] Feature works as expected
- [ ] API error states are handled
- [ ] Loading states are shown during async operations

---

## Contributing

All contributions go through a Pull Request. Direct pushes to `main` are not permitted.

If you encounter a conflict when merging, resolve it locally:

```bash
git checkout main
git pull origin main
git checkout feature/your-feature
git merge main
# Resolve conflicts in your editor
git add .
git commit -m "chore: resolve merge conflicts with main"
git push origin feature/your-feature
```

Then update your Pull Request on GitHub.

---

*Maintained by the Smart Meter project team.*
