import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { DatasetProvider } from "./context/DatasetContext";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { DisclaimerBanner } from "./components/DisclaimerBanner";
import { GlobalSearchModal } from "./components/GlobalSearchModal";
import { AiAssistantModal } from "./components/AiAssistantModal";
import { ProjectCreditsDrawer } from "./components/ProjectCreditsDrawer";

import { HomePage } from "./pages/HomePage";
import { MedicinesPage } from "./pages/MedicinesPage";
import { MedicineDetailPage } from "./pages/MedicineDetailPage";
import { SymptomsPage } from "./pages/SymptomsPage";
import { InteractionsPage } from "./pages/InteractionsPage";
import { InteractionAnalyzerPage } from "./pages/InteractionAnalyzerPage";
import { ComparePage } from "./pages/ComparePage";
import { EmergencyPage } from "./pages/EmergencyPage";

// Scroll to top on route change component
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export function AppContent() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [creditsOpen, setCreditsOpen] = useState(false);

  const handleOpenAiAssistant = (initialPrompt?: string) => {
    if (initialPrompt) {
      setAiPrompt(initialPrompt);
    } else {
      setAiPrompt("");
    }
    setAiAssistantOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9F7] dark:bg-[#0F172A] text-slate-900 dark:text-slate-300 font-sans transition-colors duration-200">
      <ScrollToTop />
      <DisclaimerBanner />
      <Header
        onOpenSearch={() => setSearchOpen(true)}
        onOpenAiAssistant={() => handleOpenAiAssistant()}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                onOpenSearch={() => setSearchOpen(true)}
                onOpenAiAssistant={(p) => handleOpenAiAssistant(p)}
              />
            }
          />
          <Route path="/medicines" element={<MedicinesPage />} />
          <Route
            path="/medicine/:id"
            element={
              <MedicineDetailPage
                onOpenAiAssistant={(p) => handleOpenAiAssistant(p)}
              />
            }
          />
          <Route
            path="/symptoms"
            element={
              <SymptomsPage
                onOpenAiAssistant={(p) => handleOpenAiAssistant(p)}
              />
            }
          />
          <Route
            path="/interactions"
            element={
              <InteractionsPage
                onOpenAiAssistant={(p) => handleOpenAiAssistant(p)}
              />
            }
          />
          <Route
            path="/interaction-analyzer"
            element={
              <InteractionAnalyzerPage
                onOpenAiAssistant={(p) => handleOpenAiAssistant(p)}
              />
            }
          />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/emergency" element={<EmergencyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer onOpenCredits={() => setCreditsOpen(true)} />

      {/* Global Modals & Drawers */}
      <GlobalSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenAiAssistant={(p) => handleOpenAiAssistant(p)}
      />

      <AiAssistantModal
        isOpen={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        initialPrompt={aiPrompt}
      />

      <ProjectCreditsDrawer
        isOpen={creditsOpen}
        onClose={() => setCreditsOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DatasetProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </DatasetProvider>
    </ThemeProvider>
  );
}
