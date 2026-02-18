import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const app = initializeApp({
  apiKey: "AIzaSyDxuO_oEg2WM4e22X0kyu-tkzZuVvUmlsQ",
  authDomain: "calorie-tracker-c483b.firebaseapp.com",
  projectId: "calorie-tracker-c483b",
  storageBucket: "calorie-tracker-c483b.firebasestorage.app",
  messagingSenderId: "906126032220",
  appId: "1:906126032220:web:fb1e8f3700cc1a69a01599"
});

export const db = getFirestore(app);
export default app;
