import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { app } from './firebase';

export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence);
