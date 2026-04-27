# Car Dealer Management System

A full-stack mobile application for managing car dealership operations, including inventory, leads, appointments, and sales tracking.

## 📱 Project Structure
- `BACKEND/`: Express.js server with MongoDB (Mongoose), handling authentication, file uploads, and business logic.
- `mobile-app/`: React Native (Expo) application featuring a custom UI kit and role-based access control.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB](https://www.mongodb.com/try/download/community) (Local or Atlas)
- [Expo Go](https://expo.dev/expo-go) app on your mobile device

---

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd BACKEND
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `BACKEND` root:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/car-dealer
   JWT_SECRET=your_jwt_secret_key
   ```
4. Seed initial data (Optional):
   ```bash
   npm run seed:admin      # Creates default admin
   npm run seed:holidays   # Populates holiday calendar
   ```
5. Start the server:
   ```bash
   npm run dev
   ```

---

### 2. Mobile App Setup
1. Navigate to the mobile app directory:
   ```bash
   cd mobile-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. **Configure API URL**:
   Open `src/services/api.js` and update the `baseURL` to your computer's local IP address (e.g., `http://192.168.1.10:5000`).
4. Start the Expo server:
   ```bash
   npx expo start
   ```
5. Scan the QR code with your **Expo Go** app.

---

## 🛠 Features
- **Role-Based Access**: Specialized views for Admin, Staff, and Customers.
- **Inventory Management**: Full CRUD for vehicles with image upload support.
- **Leads & Sales**: Track customer enquiries and convert them into successful sales.
- **Appointment Booking**: Integrated calendar with holiday and slot validation.
- **Custom UI Kit**: Standardized design system for a professional look and feel.

## 🧹 Maintenance Commands
- **Backend Clean**: Pointed to `server.js` as the main entry point.
- **Mobile Kit**: Centralized components in `src/ui/kit.js` and theme in `src/ui/theme.js`.

---
*Developed by Group 14*
