// Choix du lieu d'enregistrement :
//  - clés Firebase présentes dans .env  → base Firebase de GAAM ;
//  - sinon                              → mode démonstration (navigateur seul).
import { firebaseStore } from "./firebase";
import { demoStore } from "./demo";

export const DEMO = !import.meta.env.VITE_FIREBASE_API_KEY;
export const store = DEMO ? demoStore : firebaseStore;
