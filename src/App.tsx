// src/App.tsx
import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AppointmentProvider } from "./contexts/AppointmentContext";
import { AuthForm } from "./components/AuthForm";
import { Navigation } from "./components/Navigation";
import { PatientDashboard } from "./components/PatientDashboard";
import { DoctorDashboard } from "./components/DoctorDashboard";
import BookingPage from "./components/BookingPage";
import { SettingsPage } from "./components/SettingsPage";
import ProfilePage from "./components/ProfilePage";
import PatientHistory from "./components/PatientHistory";
import PatientNotifications from "./components/PatientNotifications";
import { Toaster } from "./components/ui/sonner";
import "./styles/globals.css";

// กำหนด type ให้หน้าอย่างชัดเจน
type PatientPages = "dashboard" | "booking" | "history" | "notifications" | "profile";
type AdminPages = "doctor_dashboard" | "settings";
type Page = PatientPages | AdminPages;

function AppContent() {
  const { user, isAdmin, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  // กำหนดหน้าเริ่มต้นเมื่อสถานะผู้ใช้เปลี่ยน
  useEffect(() => {
    if (!user) {
      setCurrentPage("dashboard");
      return;
    }
    setCurrentPage(isAdmin ? "doctor_dashboard" : "dashboard");
  }, [user, isAdmin]);

  if (isLoading) return null;
  if (!user) return <AuthForm />;

  const renderPage = () => {
    // โหมดแอดมิน
    if (isAdmin) {
      switch (currentPage as AdminPages) {
        case "doctor_dashboard":
          return <DoctorDashboard />;
        case "settings":
          return <SettingsPage />;
        default:
          return <DoctorDashboard />;
      }
    }

    // โหมดผู้ป่วย
    switch (currentPage as PatientPages) {
      case "dashboard":
        return <PatientDashboard onNavigate={(p) => setCurrentPage(p as Page)} />;
      case "booking":
        return <BookingPage onBack={() => setCurrentPage("dashboard")} />;
      case "history":
        // ✅ ประวัติ = completed เท่านั้น
        return <PatientHistory />;
      case "notifications":
        // ✅ แจ้งเตือน = scheduled เท่านั้น
        return <PatientNotifications />;
      case "profile":
        return <ProfilePage />;
      default:
        return <PatientDashboard onNavigate={(p) => setCurrentPage(p as Page)} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 flex-shrink-0">
        <Navigation
          currentPage={currentPage}
          onNavigate={(p) => setCurrentPage(p as Page)}
          isAdmin={isAdmin}
        />
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6">{renderPage()}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppointmentProvider>
        <AppContent />
        <Toaster richColors position="top-right" />
      </AppointmentProvider>
    </AuthProvider>
  );
}
