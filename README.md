<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Electricity Meter System - Team Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #24292e;
            background-color: #ffffff;
            max-width: 900px;
            margin: 0 auto;
            padding: 30px;
        }
        h1, h2, h3 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
        h3 { font-size: 1.25em; }
        p, ul, ol { margin-top: 0; margin-bottom: 16px; }
        code {
            background-color: #f6f8fa;
            border-radius: 3px;
            font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
            font-size: 85%;
            padding: 0.2em 0.4em;
        }
        pre {
            background-color: #f6f8fa;
            border-radius: 3px;
            font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
            font-size: 85%;
            line-height: 1.45;
            overflow: auto;
            padding: 16px;
        }
        pre code {
            background-color: transparent;
            padding: 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 0;
            margin-bottom: 16px;
        }
        table th, table td {
            border: 1px solid #dfe2e5;
            padding: 6px 13px;
            text-align: left;
        }
        table th {
            background-color: #f6f8fa;
            font-weight: 600;
        }
        table tr:nth-child(2n) {
            background-color: #f6f8fa;
        }
        blockquote {
            border-left: 0.25em solid #dfe2e5;
            color: #6a737d;
            margin: 0 0 16px 0;
            padding: 0 1em;
        }
        .highlight {
            background-color: #fffbdd;
            padding: 2px 4px;
            border-radius: 3px;
        }
    </style>
</head>
<body>

    <h1>Smart Electricity Meter System</h1>
    
    <p>Welcome to the Smart Electricity Meter System repository. This project consists of a React frontend and a Node.js/Express backend. This document serves as the central guide for all team members regarding repository management, feature integration, and coding standards.</p>

    <h2>1. Team Roles and Responsibilities</h2>
    <p>To prevent merge conflicts and ensure a consistent system, responsibilities are strictly divided among the 4 team members.</p>
    <table>
        <thead>
            <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Primary Responsibilities</th>
                <th>Working Directories</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>Member 1</strong></td>
                <td>Project Lead & UI Architecture</td>
                <td>React setup, global layout, styling configuration, and building reusable UI components (Buttons, Tables, Modals). Ensures UI consistency.</td>
                <td><code>frontend/src/components/</code>, <code>frontend/src/layouts/</code></td>
            </tr>
            <tr>
                <td><strong>Member 2</strong></td>
                <td>Auth & User Management</td>
                <td>Login/Register pages, JWT token handling, route protection, and user profile management (Frontend + Backend APIs).</td>
                <td><code>frontend/src/pages/auth/</code>, <code>backend/src/routes/auth/</code></td>
            </tr>
            <tr>
                <td><strong>Member 3</strong></td>
                <td>Dashboard & Analytics</td>
                <td>Dashboard home, electricity usage charts, data tables, and meter management views. Integrates with data APIs.</td>
                <td><code>frontend/src/pages/dashboard/</code>, <code>frontend/src/pages/meters/</code></td>
            </tr>
            <tr>
                <td><strong>Member 4</strong></td>
                <td>Backend & Database</td>
                <td>Express server setup, database schema design, REST APIs for meters/consumption, data validation, and documentation.</td>
                <td><code>backend/src/</code>, <code>backend/src/models/</code>, <code>docs/</code></td>
            </tr>
        </tbody>
    </table>

    <h2>2. Initial Setup Instructions</h2>
    <p>Every member must follow these steps to set up the project on their local machine.</p>
    
    <h3>Prerequisites</h3>
    <ul>
        <li>Git installed on your machine.</li>
        <li>Node.js (v18 or higher) installed.</li>
        <li>Code Editor (VS Code recommended).</li>
    </ul>

    <h3>Clone and Install</h3>
    <pre><code># 1. Clone the repository
git clone https://github.com/your-org/smart-meter.git
cd smart-meter

# 2. Setup Backend
cd backend
npm install
# Create a .env file based on .env.example
npm run dev

# 3. Setup Frontend (in a new terminal)
cd ../frontend
npm install
npm run dev</code></pre>

    <h2>3. Team Git Workflow: How to Add a Feature</h2>
    <p>We use a strict branching model. <strong>Never push code directly to the <code>main</code> branch.</strong> Follow this exact process every time you start a new task.</p>

    <h3>Step 1: Sync your local repository</h3>
    <p>Always start by ensuring your local machine has the latest code from the team.</p>
    <pre><code>git checkout main
git pull origin main</code></pre>

    <h3>Step 2: Create a Feature Branch</h3>
    <p>Create a new branch for the specific task you are working on. Name it clearly based on your task.</p>
    <pre><code># Naming convention: feature/your-feature-name
git checkout -b feature/login-page
# or
git checkout -b feature/dashboard-charts
</code></pre>

    <h3>Step 3: Write Code and Test</h3>
    <p>Write your code. Ensure there are no console errors and the application runs smoothly on your local machine.</p>

    <h3>Step 4: Commit Your Changes</h3>
    <p>Commit your work with clear, professional messages explaining <em>what</em> you changed.</p>
    <pre><code>git add .
git commit -m "feat: added login page layout and form validation"</code></pre>

    <h3>Step 5: Push Your Branch</h3>
    <p>Push your feature branch to the remote repository on GitHub.</p>
    <pre><code>git push origin feature/login-page</code></pre>

    <h3>Step 6: Create a Pull Request (PR)</h3>
    <ol>
        <li>Go to the repository on GitHub.</li>
        <li>Click <strong>Compare & pull request</strong> next to your recently pushed branch.</li>
        <li>Add a brief description of the changes.</li>
        <li>Request a review from <strong>Member 1</strong> (or another designated reviewer).</li>
        <li>Once approved, the reviewer will merge the branch into <code>main</code>.</li>
    </ol>

    <h2>4. UI Consistency Guide (Critical)</h2>
    <p>To ensure the application looks like it was built by a single developer, all members must adhere to the following UI standards.</p>
    
    <blockquote>
        <strong>Rule:</strong> Do not write custom CSS or inline styles. Do not choose random colors.
    </blockquote>

    <ul>
        <li><strong>Use Shared Components:</strong> Member 1 will create generic components (e.g., <code>&lt;Button /&gt;</code>, <code>&lt;Input /&gt;</code>, <code>&lt;Table /&gt;</code>). You must import and use these components rather than building your own HTML buttons or tables.</li>
        <li><strong>Use the Dashboard Layout:</strong> All pages must be wrapped in the global <code>&lt;DashboardLayout /&gt;</code> so the sidebar and navigation remain identical across the app.</li>
        <li><strong>Tailwind CSS Classes:</strong> If you must style a custom element, exclusively use the predefined utility classes (e.g., margins like <code>mt-4</code>, <code>p-6</code>).</li>
    </ul>

    <h2>5. Commit Naming Conventions</h2>
    <p>Please prefix your commit messages to keep the Git history organized:</p>
    <ul>
        <li><code>feat:</code> A new feature (e.g., <code>feat: added user authentication API</code>)</li>
        <li><code>fix:</code> A bug fix (e.g., <code>fix: corrected chart responsive width</code>)</li>
        <li><code>docs:</code> Documentation changes (e.g., <code>docs: updated API schema</code>)</li>
        <li><code>refactor:</code> Code restructuring without changing behavior (e.g., <code>refactor: moved database connection to config folder</code>)</li>
    </ul>

    <h2>6. Communication Rules</h2>
    <ul>
        <li>If you need an API endpoint, ask <strong>Member 4</strong>. Do not write backend routes yourself if it is not your assigned module.</li>
        <li>If you need a new UI element (like a specific toggle switch), ask <strong>Member 1</strong> to add it to the shared components folder.</li>
        <li>If you encounter a merge conflict, do not force push. Contact the team member whose code conflicts with yours and resolve it together.</li>
    </ul>

</body>
</html>