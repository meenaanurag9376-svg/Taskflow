import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAbmek7i4WNwPGxFaDA6xsTISFSUtKFF4c",
  authDomain: "taskflow-todo-51b97.firebaseapp.com",
  projectId: "taskflow-todo-51b97",
  storageBucket: "taskflow-todo-51b97.firebasestorage.app",
  messagingSenderId: "116047160578",
  appId: "1:116047160578:web:9ed36d15b6d306c7a48e1b",
  measurementId: "G-WYRSWCMN5G"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);