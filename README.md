# Car Dealer Management System

A full-stack mobile application for managing car dealership operations, including inventory, leads, appointments, sales tracking, and role-based access.

## 📁 Project Structure
- `BACKEND/`: Express.js API with MongoDB (Mongoose). Handles authentication, user roles, file uploads, appointments, vehicles, leads, sales, and notifications.
- `mobile-app/`: React Native (Expo) mobile client with shared UI kit, session management, and role-specific navigation.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB](https://www.mongodb.com/try/download/community) or MongoDB Atlas
- [Expo Go](https://expo.dev/expo-go) for mobile testing

---

### 1. Backend Setup
1. Change to the backend folder:
   ```bash
   cd BACKEND
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in `BACKEND/` with the required values:
   ```env
   PORT=8070
   MONGODB_URI=mongodb://localhost:27017/car-dealer
   JWT_SECRET=your_jwt_secret_key
   EMAIL_HOST=smtp.example.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@example.com
   EMAIL_PASS=your-email-password
   ```
4. Seed initial admin user (optional but recommended):
   ```bash
   npm run seed:admin
   ```
5. Start the backend server:
   ```bash
   npm run dev
   ```

The backend defaults to port `8070`, unless overridden in `.env`.

---

### 2. Mobile App Setup
1. Change to the mobile app folder:
   ```bash
   cd mobile-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start Expo:
   ```bash
   npx expo start
   ```
4. Open the app using Expo Go on your device or an emulator.

> Note: `src/services/api.js` already includes local host and emulator fallbacks. If using a physical device on the same network, you may need to replace the API base URL with your machine IP.

---

## 🔐 Default Admin Credentials
Use these after seeding the admin user or creating an admin account:
- Email: `admin@autopulse.com`
- Password: `admin123`

---

## 🧠 Key Features
- Role-based access controls for Admin, Staff, and Customer users
- Vehicle inventory management with image uploads
- Lead capture and sales tracking
- Appointment booking with holiday and availability validation
- Password reset via OTP email
- Mobile-friendly Expo React Native client

---

## 🛠 What Changed in This Update
- Fixed backend startup order and MongoDB connection handling
- Restored mobile session persistence on app launch
- Standardized auth email validation across login and password flows
- Improved mobile API error handling and timeout behavior
- Updated Expo package compatibility for stable dependencies

---

## 📌 Notes
- Keep `BACKEND/.env` secure and do not commit secrets.
- Use the `mobile-app` folder for all mobile client work and `BACKEND` for backend changes.

---

*Developed by Group 14*