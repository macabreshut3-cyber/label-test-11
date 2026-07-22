import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "skilled-depot-tnn32",
  appId: "1:1011409627354:web:3eb1dd1b47308c4157dde3",
  apiKey: "AIzaSyBOjLb5TrZQQTLVpuQwyD2zgtkcvDxEuwQ",
  authDomain: "skilled-depot-tnn32.firebaseapp.com",
  storageBucket: "skilled-depot-tnn32.firebasestorage.app",
  messagingSenderId: "1011409627354",
  measurementId: ""
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, "ai-studio-79d99a57-6909-4f5a-9a3a-fa69e30d5a39");
