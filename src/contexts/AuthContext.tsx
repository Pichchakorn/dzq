// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FbUser,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

type Role = "admin" | "patient";

export type AppUser = {
  id: string;
  email: string;
  name?: string;
  photoURL?: string;
  role: Role;
};

type RegisterObj = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  medicalRights?: string;
};

type Ctx = {
  user: AppUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: {
    (email: string, password: string, name: string): Promise<boolean>;
    (payload: RegisterObj): Promise<boolean>;
  };
  logout: () => Promise<void>;
  updateUserProfile: (patch: Partial<{ name: string }>) => Promise<void>;
};

// 🎲 ฟังก์ชันสร้าง avatar จาก DiceBear
function dicebearAvatar(seed: string, style = "initials", format: "svg" | "png" = "svg") {
  const s = encodeURIComponent(seed || "guest");
  return `https://api.dicebear.com/7.x/${style}/${format}?seed=${s}`;
}

const AuthCtx = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthCtx);

// --- whitelist admin ---
const ADMIN_EMAILS_RAW =
  (import.meta as any).env?.VITE_ADMIN_EMAILS ||
  (process.env as any).REACT_APP_ADMIN_EMAIL ||
  "";

const ADMIN_EMAILS = ADMIN_EMAILS_RAW
  .split(",")
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);

async function loadUser(fb: FbUser): Promise<AppUser> {
  const uid = fb.uid;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  const email = (fb.email || "").trim().toLowerCase();
  const inWhitelist = ADMIN_EMAILS.includes(email);

  if (!snap.exists()) {
    const base: AppUser = {
      id: uid,
      email,
      name: fb.displayName || "",
      photoURL: fb.photoURL || dicebearAvatar(email),
      role: inWhitelist ? "admin" : "patient",
    };
    await setDoc(ref, base, { merge: true });
    return base;
  }

  const data = snap.data() as Partial<AppUser>;
  return {
    id: uid,
    email,
    name: data.name ?? fb.displayName ?? "",
    photoURL: data.photoURL ?? fb.photoURL ?? dicebearAvatar(email),
    role: inWhitelist ? "admin" : (data.role as Role) || "patient",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (fb) => {
      try {
        if (!fb) {
          setUser(null);
          return;
        }
        const u = await loadUser(fb);
        setUser(u);
      } finally {
        setIsLoading(false);
      }
    });
    return () => off();
  }, []);

  const login: Ctx["login"] = async (email, password) => {
    setIsLoading(true);
    try {
      const { user: fb } = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
      const u = await loadUser(fb);
      setUser(u);
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // --- Register ---
  async function registerImpl(email: string, password: string, name: string): Promise<boolean>;
  async function registerImpl(payload: RegisterObj): Promise<boolean>;
  async function registerImpl(a: string | RegisterObj, b?: string, c?: string): Promise<boolean> {
    const form: RegisterObj =
      typeof a === "string"
        ? { email: a.trim().toLowerCase(), password: b || "", name: c || "" }
        : { ...a, email: a.email.trim().toLowerCase() };

    try {
      const { user: fb } = await createUserWithEmailAndPassword(auth, form.email, form.password);

      if (form.name) await updateProfile(fb, { displayName: form.name });

      // ใช้ DiceBear Avatar ตั้งแต่แรก
      const seed = form.name || form.email;
      const photoURL = dicebearAvatar(seed, "initials", "svg");

      const role: Role = ADMIN_EMAILS.includes(form.email) ? "admin" : "patient";
      await setDoc(doc(db, "users", fb.uid), {
        id: fb.uid,
        email: form.email,
        name: form.name ?? "",
        role,
        photoURL,
        phone: form.phone ?? "",
        dateOfBirth: form.dateOfBirth ?? "",
        medicalRights: form.medicalRights ?? "",
      });

      const u = await loadUser(fb);
      setUser(u);
      return true;
    } catch {
      return false;
    }
  }

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  // ✅ update เฉพาะ name (ไม่ยุ่งกับรูป)
  const updateUserProfile: Ctx["updateUserProfile"] = async (patch) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.id), patch as any);
    setUser({ ...user, ...patch });
  };

  const value: Ctx = {
    user,
    isAdmin: !!(user && user.role === "admin"),
    isLoading,
    login,
    register: registerImpl,
    logout,
    updateUserProfile,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
