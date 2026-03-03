import { useNavigate } from "react-router";
import { useUser } from "@clerk/clerk-react";
import { useState, useEffect } from "react";
import { useActiveSessions, useCreateSession, useMyRecentSessions } from "../hooks/useSessions";
import { useUserRole } from "../hooks/useUserRole";

import Navbar from "../components/Navbar";
import WelcomeSection from "../components/WelcomeSection";
import StatsCards from "../components/StatsCards";
import ActiveSessions from "../components/ActiveSessions";
import RecentSessions from "../components/RecentSessions";
import CreateSessionModal from "../components/CreateSessionModal";

function DashboardPage() {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const { isHR, loading: roleLoading } = useUserRole();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [roomConfig, setRoomConfig] = useState({ problem: "", difficulty: "" });

  const createSessionMutation = useCreateSession();

  const { data: activeSessionsData, isLoading: loadingActiveSessions } = useActiveSessions();
  const { data: recentSessionsData, isLoading: loadingRecentSessions } = useMyRecentSessions();

  // SHOW WELCOME POPUP FOR NEW USERS (non-HR users on first visit)
  useEffect(() => {
    if (!isLoaded || !user || isHR || roleLoading) return;

    // Check if user has seen the popup before
    const hasSeenPopup = localStorage.getItem(`hasSeenWelcomePopup_${user.id}`);
    
    if (!hasSeenPopup) {
      // Show popup after a short delay for better UX
      const timer = setTimeout(() => {
        setShowWelcomePopup(true);
        localStorage.setItem(`hasSeenWelcomePopup_${user.id}`, 'true');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isLoaded, user, isHR, roleLoading]);

  const handleCreateRoom = () => {
    if (!roomConfig.problem || !roomConfig.difficulty) return;

    createSessionMutation.mutate(
      {
        problem: roomConfig.problem,
        difficulty: roomConfig.difficulty.toLowerCase(),
      },
      {
        onSuccess: (data) => {
          setShowCreateModal(false);
          navigate(`/session/${data.session._id}`);
        },
      }
    );
  };

  const handleEmailAdmin = () => {
    const subject = "HR Access Request";
    const body = `Hello Admin,\n\nI would like to request HR access for my account.\n\nMy Details:\n- Name: ${user?.fullName || 'User'}\n- Email: ${user?.primaryEmailAddress?.emailAddress || 'Not provided'}\n\nThank you.\n\nBest regards,\n${user?.fullName || 'User'}`;
    window.open(`mailto:kirtanvyas9916@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    setShowWelcomePopup(false);
  };

  const activeSessions = activeSessionsData?.sessions || [];
  const recentSessions = recentSessionsData?.sessions || [];

  const isUserInSession = (session) => {
    if (!user?.id) return false;
    return session.host?.clerkId === user.id || session.participant?.clerkId === user.id;
  };

  return (
    <>
      <div className="min-h-screen bg-base-300">
        <Navbar />
        {/* CREATE SESSION BUTTON ONLY VISIBLE TO HR USERS */}
        <WelcomeSection 
          onCreateSession={() => setShowCreateModal(true)} 
          canCreateSession={isHR && !roleLoading}
        />

        {/* Grid layout */}
        <div className="container mx-auto px-6 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <StatsCards
              activeSessionsCount={activeSessions.length}
              recentSessionsCount={recentSessions.length}
            />
            <ActiveSessions
              sessions={activeSessions}
              isLoading={loadingActiveSessions}
              isUserInSession={isUserInSession}
            />
          </div>

          <RecentSessions sessions={recentSessions} isLoading={loadingRecentSessions} />
        </div>
      </div>

      {/* ONLY SHOW MODAL IF USER IS HR */}
      {isHR && (
        <CreateSessionModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          roomConfig={roomConfig}
          setRoomConfig={setRoomConfig}
          onCreateRoom={handleCreateRoom}
          isCreating={createSessionMutation.isPending}
        />
      )}

      {/* WELCOME POPUP FOR NEW USERS */}
      {showWelcomePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">👋</span>
              </div>
              
              <h2 className="text-2xl font-bold text-base-content mb-3">
                Welcome to Talent-Talk!
              </h2>
              
              <p className="text-base-content/70 mb-4">
                Great to have you here! To create interview sessions and access advanced features, you'll need HR access.
              </p>

              <div className="bg-info/20 border border-info rounded-lg p-4 mb-4">
                <p className="text-info-content text-sm">
                  💼 <strong>Need HR access?</strong><br />
                  Contact: <strong>Kirtan Vyas</strong><br />
                  Email: kirtanvyas9916@gmail.com
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleEmailAdmin}
                  className="btn btn-primary flex-1 gap-2"
                >
                  📧 Request HR Access
                </button>
                <button
                  onClick={() => setShowWelcomePopup(false)}
                  className="btn btn-ghost"
                >
                  Explore First
                </button>
              </div>

              <p className="text-xs text-base-content/50 mt-4">
                You can only join sessions as a participant without HR access.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DashboardPage;