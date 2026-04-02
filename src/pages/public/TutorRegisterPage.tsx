import { useState } from "react";
import { Link } from "react-router-dom";
import "./RegisterPage.css";

const YEAR_OPTIONS = ["Year 7", "Year 8", "Year 9", "Year 10"];
const BIO_MAX = 300;

export default function TutorRegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [mobile, setMobile]       = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [qualification, setQualification] = useState("");
  const [yearLevels, setYearLevels] = useState<string[]>([]);
  const [bio, setBio]             = useState("");

  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function toggleYear(y: string) {
    setYearLevels((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]
    );
  }

  function validate(): string | null {
    if (!firstName.trim() || !lastName.trim()) return "Please enter your full name.";
    if (!email.trim()) return "Please enter your email address.";
    if (!mobile.trim()) return "Please enter your mobile number.";
    if (!password) return "Please choose a password.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    if (!qualification.trim()) return "Please enter your qualification or university.";
    if (yearLevels.length === 0) return "Please select at least one year level you can tutor.";
    if (bio.length > BIO_MAX) return `Bio must be ${BIO_MAX} characters or fewer.`;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    const API_URL = (process.env.REACT_APP_API_URL ?? "").replace(/\/$/, "");
    try {
      const res = await fetch(`${API_URL}/api/auth/register_tutor/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          confirm_password: confirm,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          mobile: mobile.trim(),
          qualification: qualification.trim(),
          year_levels: yearLevels,
          bio: bio.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Submission failed. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="reg-page">
        <nav className="reg-nav">
          <Link to="/" className="reg-nav-logo">
            <img src="/subjectmatter_wordmark.svg" alt="SubjectMatter" />
          </Link>
          <Link to="/" className="reg-nav-back">← Back to home</Link>
        </nav>
        <main className="reg-main" style={{ alignItems: "center" }}>
          <div className="reg-card" style={{ textAlign: "center", padding: "3.5rem 2.5rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1.5rem" }}>🎉</div>
            <h1 className="reg-heading">Application received</h1>
            <p className="reg-sub" style={{ maxWidth: "380px", margin: "0 auto 2rem" }}>
              Thanks for applying to join SubjectMatter. We'll review your
              application and be in touch shortly.
            </p>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--sm-text-muted)", lineHeight: 1.6 }}>
              Tutor accounts require manual approval before you can log in.
              You'll receive an email once your application has been assessed.
            </p>
            <Link to="/" className="sm-btn-primary" style={{ marginTop: "2rem", display: "inline-flex" }}>
              Back to home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="reg-page">
      <nav className="reg-nav">
        <Link to="/" className="reg-nav-logo">
          <img src="/subjectmatter_wordmark.svg" alt="SubjectMatter" />
        </Link>
        <Link to="/" className="reg-nav-back">← Back to home</Link>
      </nav>

      <main className="reg-main">
        <div className="reg-card">
          <div className="reg-logo">
            <img src="/subjectmatter_wordmark.svg" alt="SubjectMatter" />
          </div>

          <h1 className="reg-heading">Apply to tutor</h1>
          <p className="reg-sub">
            Tell us about yourself. We review every application before
            approving tutors on the platform.
          </p>

          {error && (
            <div className="sm-alert sm-alert-error" style={{ marginBottom: "1.5rem" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* ── Personal details ───────────────────── */}
            <div className="reg-section">
              <div className="reg-section-header">
                <div className="reg-section-badge">1</div>
                <h2 className="reg-section-title">Personal details</h2>
              </div>

              <div className="reg-row">
                <div className="sm-form-group">
                  <label htmlFor="t-first">First name</label>
                  <input id="t-first" type="text" className="sm-input"
                    placeholder="Sarah" value={firstName}
                    onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="sm-form-group">
                  <label htmlFor="t-last">Last name</label>
                  <input id="t-last" type="text" className="sm-input"
                    placeholder="Chen" value={lastName}
                    onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>

              <div className="sm-form-group">
                <label htmlFor="t-email">Email address</label>
                <input id="t-email" type="email" className="sm-input"
                  placeholder="you@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>

              <div className="sm-form-group">
                <label htmlFor="t-mobile">Mobile number</label>
                <input id="t-mobile" type="tel" className="sm-input"
                  placeholder="04xx xxx xxx" value={mobile}
                  onChange={(e) => setMobile(e.target.value)} required autoComplete="tel" />
              </div>

              <div className="reg-row">
                <div className="sm-form-group">
                  <label htmlFor="t-password">Password</label>
                  <input id="t-password" type="password" className="sm-input"
                    placeholder="Min. 8 characters" value={password}
                    onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
                </div>
                <div className="sm-form-group">
                  <label htmlFor="t-confirm">Confirm password</label>
                  <input id="t-confirm" type="password" className="sm-input"
                    placeholder="Repeat password" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
                </div>
              </div>
            </div>

            <hr className="reg-section-divider" />

            {/* ── Teaching details ───────────────────── */}
            <div className="reg-section">
              <div className="reg-section-header">
                <div className="reg-section-badge">2</div>
                <h2 className="reg-section-title">Teaching details</h2>
              </div>

              <div className="sm-form-group">
                <label htmlFor="t-qual">University / Qualification</label>
                <input id="t-qual" type="text" className="sm-input"
                  placeholder="e.g. B.Sc. Mathematics, University of Sydney"
                  value={qualification} onChange={(e) => setQualification(e.target.value)} required />
              </div>

              <div className="sm-form-group">
                <label>Year levels you can tutor</label>
                <div className="reg-checkboxes">
                  {YEAR_OPTIONS.map((y) => (
                    <label key={y} className="reg-checkbox-item">
                      <input
                        type="checkbox"
                        checked={yearLevels.includes(y)}
                        onChange={() => toggleYear(y)}
                      />
                      {y}
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm-form-group">
                <label htmlFor="t-bio">
                  Brief bio{" "}
                  <span style={{ fontWeight: 400, color: "var(--sm-text-muted)" }}>
                    (optional)
                  </span>
                </label>
                <textarea
                  id="t-bio"
                  className="sm-input"
                  placeholder="Tell us about your teaching approach, experience and style…"
                  rows={4}
                  maxLength={BIO_MAX + 20}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  style={{ resize: "vertical", minHeight: "100px" }}
                />
                <div className={`reg-char-count${bio.length > BIO_MAX ? " over" : ""}`}>
                  {bio.length}/{BIO_MAX}
                </div>
              </div>
            </div>

            <div className="reg-submit-area">
              <button type="submit" className="sm-btn-primary reg-submit" disabled={loading}>
                {loading ? "Submitting application…" : "Submit Application"}
              </button>
              <p className="reg-terms">
                Your application will be reviewed within 1–2 business days.
                You'll receive an email once approved.
              </p>
            </div>
          </form>

          <div className="reg-login-link">
            Already approved?{" "}
            <Link to="/login?tab=tutor">Sign in here</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
