import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyDxuO_oEg2WM4e22X0kyu-tkzZuVvUmlsQ",
  authDomain: "calorie-tracker-c483b.firebaseapp.com",
  projectId: "calorie-tracker-c483b",
  storageBucket: "calorie-tracker-c483b.firebasestorage.app",
  messagingSenderId: "906126032220",
  appId: "1:906126032220:web:fb1e8f3700cc1a69a01599"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
