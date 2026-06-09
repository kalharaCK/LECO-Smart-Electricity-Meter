# ⚡ LECO Electricity Meter App 

Welcome to the LECO Electricity Meter App repository. This is a full-stack group project consisting of a **React Frontend** and a **Node.js/Express Backend**.

## 📂 Project Structure
Our project is divided into distinct folders to separate concerns:
- `/frontend` - React.js (Vite), Tailwind CSS, Context API
- `/backend` - Node.js, Express, REST API, Database Models
- `/docs` - Project documentation (API, Database, Architecture)
- `/docker` - Docker configuration files (Optional for deployment)

---

## 🎨 1. Frontend UI System Guidelines
We are using **Tailwind CSS** to maintain a single UI style across all 4 developers.
* **Component Library:** Check `frontend/src/components` before building. Do not use raw `<button>` or `<input>` tags. Use the shared components.
* **Colors:** Use Tailwind classes `bg-leco-primary` (Yellow) and `bg-leco-secondary` (Blue).
* **Spacing:** Use Tailwind's standard spacing (multiples of 4, e.g., `p-4`, `m-4`).

---

## 🚀 2. Local Setup Instructions

To run this project locally, you need to start both the backend and frontend servers.

### Backend Setup (Terminal 1)
\`\`\`bash
cd backend
npm install
# Create a .env file based on .env.example (Add your DB credentials)
npm run dev
\`\`\`

### Frontend Setup (Terminal 2)
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

---

## 💻 3. Team Git Workflow (CRITICAL FOR 4 USERS)

Since there are 4 of us, **NEVER commit directly to the `main` branch.** Follow this exactly to avoid overwriting each other's code.

### Step 1: Sync your computer
\`\`\`bash
git checkout main
git pull origin main
\`\`\`

### Step 2: Create a Feature Branch
\`\`\`bash
git checkout -b feat/your-feature-name 
# Use 'feat/' for new things, 'fix/' for bugs.
\`\`\`

### Step 3: Write Code & Commit
\`\`\`bash
git add .
git commit -m "feat: added login API endpoint" 
\`\`\`

### Step 4: Push and PR
\`\`\`bash
git push origin feat/your-feature-name
\`\`\`
1. Go to GitHub and click **Compare & pull request**.
2. **DO NOT CLICK MERGE.** Ask another team member to review and merge your code.
3. Once merged, switch back to main (`git checkout main`), pull (`git pull origin main`), and start a new branch for your next task.