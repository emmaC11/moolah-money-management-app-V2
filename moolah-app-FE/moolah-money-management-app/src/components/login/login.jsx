// src/components/Login.jsx
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";

export default function login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const login = async () => {
    setMessage("");
    try {
      // 1) Sign in with Firebase on the frontend
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // 2) Get the Firebase ID token from the signed-in user
      const token = await cred.user.getIdToken();

      // 3) add user to DB - call BE API
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/v1/user`;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName: cred.user.displayName || cred.user.email.split('@')[0],
          photoURL: cred.user.photoURL || null
        })
      });

      const data = await res.json();
      setMessage(`Backend says: ${JSON.stringify(data)}`);
    } catch (err) {
      setMessage(`Login error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 360 }}>
      <h2>Login</h2>
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 8, width: "100%" }}
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", marginBottom: 8, width: "100%" }}
      />
      <button onClick={login}>Log in</button>
      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
}