# 🌍 **Phoenix Adventures**  

**Phoenix Adventures** is a full-featured platform for exploring, booking, and customizing trips. Designed with scalability and user-friendliness in mind, it provides seamless experiences for both users and administrators.  

---

## 🚀 **Features**  

### 🔒 **User Authentication & Authorization**  
- Secure login with role-based access control.  
- Data protection using encryption and token-based authentication.  

### 🧳 **Trip Booking & Management**  
- Browse, apply for, and confirm trips effortlessly.  
- Bookings are linked to payment receipts for streamlined tracking.  

### ✨ **Customized Trip Creation**  
- Users can propose personalized trips based on their preferences.  
- Admins can accept, reject, or counter these proposals to suit requirements.  

### 🧾 **Receipt Management**  
- Upload Vodafone Cash payment receipts directly via the platform.  
- Receipts are securely stored and linked to user profiles.  

### 🖼️ **Image Upload Functionality**  
- Integrated with Cloudinary for fast and efficient image uploads.  
- Supports image management for trip displays.  

### ✅ **Admin Receipt Verification**  
- Admins can verify uploaded payment receipts using user information like names and emails.  

### ⚙️ **Automated Inactive User Cleanup**  
- Daily jobs automatically delete users inactive for over 30 days.  
- Enhances database efficiency and reduces storage costs.  

---

## 🛠️ **Technologies Used**  

- **Backend:** Node.js, Express.js  
- **Database:** PostgreSQL  
- **Authentication:** JWT (JSON Web Tokens)  
- **File Storage:** Cloudinary (for images)  
- **Task Scheduling:** Node Schedule (or Cron jobs)  

---

## 📂 **Installation**  

1. Clone the repository:  
   ```bash
   git clone https://github.com/your-username/phoenix-adventures.git
   cd phoenix-adventures
