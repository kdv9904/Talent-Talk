import { lazy, Suspense, useEffect } from "react";
import axiosInstance from "./lib/axios";
import { useUser, useAuth } from "@clerk/clerk-react";
import { Navigate, Route, Routes } from "react-router";
import { Toaster } from "react-hot-toast";

// Home is loaded up front because it is the landing page
import HomePage from "./pages/HomePage";

// Everything else is downloaded only when the user opens that page
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ProblemPage = lazy(() => import("./pages/ProblemPage"));
const ProblemsPage = lazy(() => import("./pages/ProblemsPage"));
const SessionPage = lazy(() => import("./pages/SessionPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  );
}

function App() {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    const interceptor = axiosInstance.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return () => axiosInstance.interceptors.request.eject(interceptor);
  }, [getToken]);

  // Protected pages wait for Clerk; the homepage does not.
  const protectedPage = (page) => {
    if (!isLoaded) return <PageLoader />;
    return isSignedIn ? page : <Navigate to="/" replace />;
  };

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={
              isLoaded && isSignedIn ? <Navigate to="/dashboard" replace /> : <HomePage />
            }
          />
          <Route path="/dashboard" element={protectedPage(<DashboardPage />)} />
          <Route path="/admin" element={protectedPage(<AdminDashboard />)} />
          <Route path="/problems" element={protectedPage(<ProblemsPage />)} />
          <Route path="/problem/:id" element={protectedPage(<ProblemPage />)} />
          <Route path="/session/:id" element={protectedPage(<SessionPage />)} />
        </Routes>
      </Suspense>

      <Toaster toastOptions={{ duration: 3000 }} />
    </>
  );
}

export default App;