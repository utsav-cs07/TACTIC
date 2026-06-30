# TACTIC AI — Intelligent Productivity Companion   tactic-ai.netlify.app

### 🌐 Live Demo
**Try the app here:** https://your-netlify-site.netlify.app


> 🏆 Hackathon Project — AI-powered task scheduler with Google Calendar integration & Firebase cloud storage

![TACTIC AI](https://img.shields.io/badge/NEXUS-AI%20Powered-00d4ff?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?style=for-the-badge&logo=firebase)
![Google Calendar](https://img.shields.io/badge/Google-Calendar%20API-4285F4?style=for-the-badge&logo=google-calendar)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **AI Task Engine** | Auto-prioritizes tasks using deadline urgency, keywords & category scoring |
| 💬 **TACTIC AI Chat** | Natural language task creation — *"Add meeting tomorrow at 3pm"* |
| ☁️ **Firebase Database** | Real-time cloud sync — data persists across all devices |
| 📅 **Google Calendar Sync** | Two-way sync — tasks appear in your real Google Calendar |
| 🎙️ **Voice Input** | Web Speech API — speak your tasks |
| 🔥 **Habit Tracking** | Streaks, heatmaps, goal milestones |
| 📊 **Analytics** | Completion rates, weekly charts, AI productivity report |
| 🔔 **Smart Reminders** | Browser notifications 1 hour & 15 minutes before deadlines |
| 🍅 **Pomodoro Timer** | Built-in 25-min focus sessions |

---

## 🚀 Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/ai-productivity-companion.git
cd ai-productivity-companion
```

### 2. Firebase Setup (Database + Auth)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project** → name it `nexus-ai`
3. Enable **Google Analytics** (optional)
4. Go to **Build → Firestore Database** → Create database → Start in **test mode**
5. Go to **Build → Authentication** → Sign-in method → Enable **Google**
6. Go to **Project Settings** → Your apps → Click `</>` (Web) → Register app
7. Copy your Firebase config and paste it into `js/firebase-config.js`

```javascript
// js/firebase-config.js — paste YOUR values here
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Google Calendar API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project (same project)
3. Go to **APIs & Services → Library** → Enable **Google Calendar API**
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth 2.0 Client ID**
6. Application type: **Web application**
7. Add `http://localhost` and your deployed domain to **Authorized JavaScript origins**
8. Copy the **Client ID** and paste into `js/gcal.js`

```javascript
// js/gcal.js — paste YOUR values here
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_API_KEY   = 'YOUR_GOOGLE_API_KEY'; // from Credentials → API keys
```

### 4. Open the app
Simply open `index.html` in your browser — **no build step needed!**

> ⚠️ For voice input and notifications, use Chrome and open via a local server:
> ```bash
> npx serve .
> # or
> python -m http.server 8080
> ```

---

## 📁 Project Structure

```
ai-productivity-companion/
├── index.html                  ← App shell (all 6 views)
├── README.md
├── .gitignore
├── css/
│   ├── main.css                ← Design system & variables
│   ├── components.css          ← UI components (cards, modals, sidebar)
│   └── animations.css          ← Keyframe animations
└── js/
    ├── firebase-config.js      ← 🔥 Firebase config (YOU EDIT THIS)
    ├── auth.js                 ← Firebase Google Auth
    ├── db.js                   ← Database layer (Firestore + localStorage fallback)
    ├── gcal.js                 ← 📅 Google Calendar API sync
    ├── tasks.js                ← Task data model & CRUD
    ├── ai.js                   ← AI scoring engine & NLP
    ├── habits.js               ← Habit streaks & goal tracking
    ├── analytics.js            ← Canvas charts
    ├── voice.js                ← Web Speech API
    ├── notifications.js        ← Browser push notifications
    └── app.js                  ← Main app controller
```

---

## 🗄️ Database Schema (Firestore)

```
users/{userId}/
  ├── tasks/{taskId}
  │     ├── title: string
  │     ├── desc: string
  │     ├── priority: "critical" | "high" | "medium" | "low"
  │     ├── category: "work" | "personal" | "shopping" | "health"
  │     ├── dueDate: timestamp
  │     ├── completed: boolean
  │     ├── subtasks: [{t: string, done: boolean}]
  │     ├── tags: string[]
  │     ├── estimatedMins: number
  │     ├── repeat: "daily" | "weekly" | "monthly" | null
  │     ├── gcalEventId: string | null   ← Google Calendar event ID
  │     └── createdAt: timestamp
  │
  ├── habits/{habitId}
  │     ├── name: string
  │     ├── icon: string
  │     ├── color: string
  │     ├── streak: number
  │     ├── completedDates: string[]
  │     └── target: "daily" | "weekly"
  │
  └── goals/{goalId}
        ├── title: string
        ├── icon: string
        ├── deadline: timestamp
        ├── milestones: [{t: string, done: boolean}]
        └── color: string
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + N` | New task |
| `Ctrl + K` | Search |
| `Ctrl + /` | Toggle AI panel |
| `Esc` | Close modal |

---

## 🔑 AI Chat Commands

| Say this | What happens |
|---|---|
| `"Add meeting with team tomorrow at 3pm"` | Creates task with parsed date/time |
| `"What should I focus on?"` | AI-ranked priority list |
| `"Give me stats"` | Completion metrics |
| `"What's overdue?"` | Overdue task list |
| `"Schedule my week"` | AI suggests time slots |
| `"Motivate me"` | Productivity quote |

---

## 🌐 Deployment

### Netlify (Recommended — Free)
```bash
# Install Netlify CLI
npm install -g netlify-cli
# Deploy
netlify deploy --dir . --prod
```

### GitHub Pages
1. Push to GitHub
2. Go to repo Settings → Pages → Source: main branch / root
3. Your app will be at `https://username.github.io/ai-productivity-companion`

### Vercel
```bash
npm install -g vercel
vercel --prod
```

> ⚠️ After deploying, add your production URL to Firebase Auth authorized domains and Google OAuth origins!

---

## 🛡️ Security Rules (Firestore)

After deploying, update Firestore rules to protect user data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🧪 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript |
| Database | Firebase Firestore (cloud) + localStorage (offline fallback) |
| Auth | Firebase Authentication (Google OAuth) |
| Calendar | Google Calendar API v3 |
| Voice | Web Speech API (browser native) |
| Charts | Canvas 2D API |
| Notifications | Notification API (browser native) |
| AI | Rule-based NLP engine (no API key needed) |

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

Made with ⚡ for hackathon by **TACTIC AI Team**
