import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { TemplateListPage } from "./pages/TemplateListPage";
import { TemplateEditorPage } from "./pages/TemplateEditorPage";
import { NewTemplatePage } from "./pages/NewTemplatePage";
import { SkillCreatePage } from "./pages/SkillCreatePage";
import { TutorListPage } from "./pages/TutorListPage";
import { TutorHomePage } from "./pages/TutorHomePage";
import { TutorEditPage } from "./pages/TutorEditPage";
import { TutorCreatePage } from "./pages/TutorCreatePage";
import { TutorSchedulePage } from "./pages/TutorSchedulePage";
import { TutorBookingPage } from "./pages/TutorBookingPage";
import { TutorSMSInboxPage } from "./pages/TutorSMSInboxPage";
import { TutorSMSConversationPage } from "./pages/TutorSMSConversationPage";

import { StudentListPage } from "./pages/StudentListPage";
import { StudentEditPage } from "./pages/StudentEditPage";
import { StudentQuestionPage } from "./pages/StudentQuestionPage";
import { StudentHomePage } from "./pages/StudentHomePage";
import { TestPage } from "./pages/TestPage";
import { StudentBookingPage } from "./pages/StudentBookingPage";
import { StudentCreatePage } from "./pages/StudentCreatePage";
import SkillsPage from "./pages/SkillsPage";
import { SkillOverviewPage } from "./pages/SkillOverviewPage";
import { TemplateMetadataPage } from "./pages/TemplateMetadataPage";
import PrinciplesPage from "./pages/PrinciplesPage";
import FeedbackPage from "./pages/FeedbackPage";
import { DocsPage } from "./pages/DocsPage";
import { KnowledgeEditorPage } from "./pages/KnowledgeEditorPage";
import { KnowledgeListPage } from "./pages/KnowledgeListPage";
import { PastTestsPage } from "./pages/PastTestsPage";
import AuthPage from "./pages/AuthPage/AuthPage";
import { apiFetch } from "./utils/apiFetch";
import { usePreferenceStore } from "./utils/pref";

import "bootstrap/dist/css/bootstrap.min.css";

// ------------------------------------------------------------
// FETCH CURRENT USER (session-based auth)
// ------------------------------------------------------------
function useCurrentUser() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/auth/me/")
      .then((res) => {
        if (res.status === 401) {
          setUser(null);
          setLoading(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setUser(data);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  return { user, loading };
}


// ------------------------------------------------------------
// PROTECTED ROUTE WRAPPER
// ------------------------------------------------------------
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  return <>{children}</>;
}


// ------------------------------------------------------------
// MAIN APP
// ------------------------------------------------------------
function App() {
  useEffect(() => {
    window.addEventListener("error", (e) => {
      console.log("GLOBAL ERROR:", e.error);
    });
  }, []);

  useEffect(() => {
    async function loadPrefs() {
      const res = await apiFetch("/api/preferences/flat/");
      const data = await res.json();
      usePreferenceStore.getState().load(data);
    }
    loadPrefs();
  }, []);


  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC */}
        <Route path="/auth" element={<AuthPage />} />

        {/* PROTECTED */}
        <Route path="/templates" element={<ProtectedRoute><TemplateListPage /></ProtectedRoute>} />
        <Route path="/templates/new" element={<ProtectedRoute><NewTemplatePage /></ProtectedRoute>} />
        <Route path="/templates/editor" element={<ProtectedRoute><TemplateEditorPage /></ProtectedRoute>} />
        <Route path="/templates/:id" element={<ProtectedRoute><TemplateEditorPage /></ProtectedRoute>} />
        <Route path="/templates/:id/metadata" element={<ProtectedRoute><TemplateMetadataPage /></ProtectedRoute>} />

        <Route path="/skills" element={<ProtectedRoute><SkillsPage /></ProtectedRoute>} />
        <Route path="/skills/new" element={<ProtectedRoute><SkillCreatePage /></ProtectedRoute>} />
        <Route path="/skills/:id" element={<ProtectedRoute><SkillsPage /></ProtectedRoute>} />
        <Route path="/skills/:parentId/new" element={<ProtectedRoute><SkillCreatePage /></ProtectedRoute>} />
        <Route path="/skills/:skillId/overview/:grade" element={<ProtectedRoute><SkillOverviewPage /></ProtectedRoute>} />
        <Route path="/skills/:skillId/overview" element={<ProtectedRoute><SkillOverviewPage /></ProtectedRoute>} />

        <Route path="/admin/tutors" element={<ProtectedRoute><TutorListPage /></ProtectedRoute>} />
        <Route path="/admin/tutors/new" element={<ProtectedRoute><TutorCreatePage /></ProtectedRoute>} />

        <Route path="/tutors/:id" element={<ProtectedRoute><TutorHomePage /></ProtectedRoute>} />
        <Route path="/tutors/:id/booking" element={<ProtectedRoute><TutorBookingPage /></ProtectedRoute>} />
        <Route path="/tutors/:id/edit" element={<ProtectedRoute><TutorEditPage /></ProtectedRoute>} />
        <Route path="/tutors/:id/sms" element={<TutorSMSInboxPage />} />
        <Route path="/tutors/:id/sms/:conversationId" element={<TutorSMSConversationPage />} />

        <Route path="/admin/students" element={<ProtectedRoute><StudentListPage /></ProtectedRoute>} />
        <Route path="/admin/students/new" element={<ProtectedRoute><StudentCreatePage /></ProtectedRoute>} />

        <Route path="/students/:studentId/edit" element={<ProtectedRoute><StudentEditPage /></ProtectedRoute>} />
        <Route path="/students/:studentId/test" element={<ProtectedRoute><TestPage /></ProtectedRoute>} />
        <Route path="/students/:studentId/test/:skillId" element={<ProtectedRoute><StudentQuestionPage /></ProtectedRoute>} />
        <Route path="/students/:id/booking" element={<ProtectedRoute><StudentBookingPage /></ProtectedRoute>} />
        <Route path="/students/:studentId/past-tests" element={<ProtectedRoute><PastTestsPage /></ProtectedRoute>} />
        <Route path="/students/:id" element={<ProtectedRoute><StudentHomePage /></ProtectedRoute>} />

        <Route path="/knowledge" element={<ProtectedRoute><KnowledgeListPage /></ProtectedRoute>} />
        <Route path="/knowledge/new" element={<ProtectedRoute><KnowledgeEditorPage /></ProtectedRoute>} />
        <Route path="/knowledge/:id" element={<ProtectedRoute><KnowledgeEditorPage /></ProtectedRoute>} />

        <Route path="/principles" element={<ProtectedRoute><PrinciplesPage /></ProtectedRoute>} />
        <Route path="/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
        <Route path="/docs" element={<ProtectedRoute><DocsPage /></ProtectedRoute>} />

        {/* DEFAULT */}
        <Route path="*" element={<Navigate to="/auth" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;