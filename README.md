# FOCUS — Distraction-Free Telegram Communication App

> **"Stay connected without getting distracted."**  
> *"The user decides what enters the app. The app should never decide what the user should see."*

A minimalist mobile/web communication layer over your Telegram account that eliminates algorithmic feeds, search engines, recommendations, trending metrics, and cognitive noise.

---

## Key Features & Anti-Distraction Design

- **Allowed Channels Only**:
  - Manually approve channels by username (`@examplechannel`).
  - No channel discovery, no recommended channels, no trending posts.
  - Reader view shows latest posts chronologically with dates, timestamps, and media.
  
- **Allowed Contacts Only**:
  - Manually approve contacts by username (`@username`).
  - No global contact search, no "People you may know", no automatic contact syncing.
  
- **Distraction-Free Message Status**:
  - **🔵 New message**: Unread message indicator.
  - **⚪ No new message**: All caught up.
  - Actual message remains **completely hidden** until you intentionally enter the conversation.

- **Strict Hidden-Preview Notifications**:
  - When an approved contact sends a message, notification displays:  
    `New message from Ahmed`  
    *(Never reveals message content like "Ahmed: Can you send me the assignment?")*
  - Channel post notification displays:  
    `New post in Study Channel`

- **Focus Mode**:
  - Silences noise, guarantees hidden previews, and visually dims distractions.
  - Includes a visual checklist of permitted vs. blocked features.

- **Conversation Screen**:
  - Intentional chat view with timestamps, document cards, voice message audio player, and reply support.
  - No engagement stickers, no reaction counters, no stories, no ads.

- **Offline Resiliency**:
  - Minimal offline notice: `Offline — Last synchronized: 10:42 AM`.
  - No repetitive error popups; automatically syncs when network returns.

- **Calm Digital Notebook Aesthetics**:
  - Three serene themes: **Warm Washi Paper**, **High-Contrast E-Ink**, and **Midnight Restful**.
  - Gentle two-tone acoustic sine chime for peaceful notifications.

---

## Getting Started

### 1. Set Workspace
Recommended workspace path:
```bash
C:\Users\abdi\.gemini\antigravity\scratch\telegram-focus
```

### 2. Run the Application
The app is currently running on **`http://localhost:3000`**.

If restarting:
```bash
npm run dev
```

### 3. Telegram MTProto API Setup (Optional)
To link your live Telegram account via official MTProto:
1. Obtain free credentials at [my.telegram.org](https://my.telegram.org) under **API development tools**.
2. Add your credentials to `.env.local`:
   ```env
   TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
   ```
3. Click **Connect Telegram** in the app, enter your phone number, and input the code sent by Telegram.
4. If 2FA is active on your account, the app securely prompts for your cloud password.

*Note: The app comes pre-configured with a **Distraction-Free Sandbox Mode** so you can test all features, notifications, and contacts immediately without waiting for API keys.*

---

## Anti-Distraction Guarantees

| Feature | Status |
| :--- | :--- |
| **User-approved channels** | Allowed |
| **User-approved contacts** | Allowed |
| **Direct conversations** | Allowed |
| **Hidden-preview notifications** | Allowed |
| **Global search engine** | **Permanently Blocked** |
| **Explore / Discovery feed** | **Permanently Blocked** |
| **Channel recommendations** | **Permanently Blocked** |
| **"People you may know"** | **Permanently Blocked** |
| **Stories & reels** | **Permanently Blocked** |
| **Like & reaction counters** | **Permanently Blocked** |
| **Advertisements** | **Permanently Blocked** |
