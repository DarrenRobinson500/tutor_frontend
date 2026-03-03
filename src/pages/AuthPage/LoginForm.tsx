import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiFetch";

export default function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("https://web-production-f1310.up.railway.app/api/auth/register/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

//     const res = await apiFetch("/api/auth/login/", {
//       method: "POST",
//       body: JSON.stringify({ email, password }),
//     });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }

    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    localStorage.setItem("user", JSON.stringify(data.user));

    const role = data.user.role;
    if (role === "tutor") navigate(`/tutor/${data.user.id}`);
    if (role === "student") navigate(`/student/${data.user.id}`);
    if (role === "parent") navigate(`/parent/${data.user.id}`);
  }

  return (
    <form onSubmit={handleLogin} className="auth-form">
      <input
        type="text"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && <div className="auth-error">{error}</div>}

      <button type="submit">Login</button>
    </form>
  );
}