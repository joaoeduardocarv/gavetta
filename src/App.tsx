import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { DrawerProvider } from "@/contexts/DrawerContext";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useMigrateIncompleteContent } from "@/hooks/useMigrateIncompleteContent";
import { GlobalRatingDialog } from "@/components/GlobalRatingDialog";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { QuickStartLibrary } from "@/components/QuickStartLibrary";
import { AnalyticsTracker } from "@/hooks/useAnalytics";

// Eager: landing/auth (first paint critical)
import Welcome from "./pages/Welcome";
import Auth from "./pages/Auth";
import MyDrawers from "./pages/MyDrawers";

// Lazy: everything else (code split)
const Friends = lazy(() => import("./pages/Friends"));
const Search = lazy(() => import("./pages/Search"));
const Trending = lazy(() => import("./pages/Trending"));
const Profile = lazy(() => import("./pages/Profile"));
const SignupHelp = lazy(() => import("./pages/SignupHelp"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const AdminSignupDebug = lazy(() => import("./pages/AdminSignupDebug"));
const SharePage = lazy(() => import("./pages/SharePage"));
const ImportPage = lazy(() => import("./pages/ImportPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min — avoid refetch storms on remount
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Component to run migration inside providers
function MigrationRunner({ children }: { children: React.ReactNode }) {
  useMigrateIncompleteContent();
  return <>{children}</>;
}

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

// Legacy /share/:type/:tmdbId → /m/:tmdbId or /s/:tmdbId
const LegacyShareRedirect = () => {
  const { type, tmdbId } = useParams<{ type: string; tmdbId: string }>();
  if (!tmdbId || (type !== "movie" && type !== "tv")) {
    return <Navigate to="/" replace />;
  }
  const prefix = type === "movie" ? "m" : "s";
  return <Navigate to={`/${prefix}/${tmdbId}`} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <AuthProvider>
          <DrawerProvider>
            <MigrationRunner>
              <Toaster />
              <Sonner />
              <GlobalRatingDialog />
              <OnboardingDialog />
              <QuickStartLibrary />
              <BrowserRouter>
                <AnalyticsTracker />
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/signup-help" element={<SignupHelp />} />
                    <Route path="/" element={<ProtectedRoute><MyDrawers /></ProtectedRoute>} />
                    <Route path="/my-drawers" element={<ProtectedRoute><MyDrawers /></ProtectedRoute>} />
                    <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
                    <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
                    <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
                    <Route path="/trending" element={<ProtectedRoute><Trending /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/u/:username" element={<PublicProfile />} />
                    <Route path="/m/:tmdbId" element={<SharePage forcedType="movie" />} />
                    <Route path="/s/:tmdbId" element={<SharePage forcedType="tv" />} />
                    <Route path="/share/:type/:tmdbId" element={<LegacyShareRedirect />} />
                    <Route path="/admin/signup-debug" element={<ProtectedRoute><AdminSignupDebug /></ProtectedRoute>} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </MigrationRunner>
          </DrawerProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
