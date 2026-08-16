// components/WelcomeSection.js
import { useUser } from "@clerk/clerk-react";
import { ArrowRightIcon, SparklesIcon, ZapIcon } from "lucide-react";

function WelcomeSection({ onCreateSession, canCreateSession }) {
  const { user } = useUser();

  return (
    <div className="relative overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        {/* STACK VERTICALLY ON MOBILE, HORIZONTALLY ON DESKTOP */}
        <div className="flex flex-col gap-6 sm:gap-8 sm:flex-row sm:items-center sm:justify-between">
          
          {/* LEFT SECTION - TEXT */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent leading-tight">
                Welcome back, {user?.firstName || "there"}!
              </h1>
            </div>
            <p className="text-base sm:text-lg md:text-xl text-base-content/60 ml-0 sm:ml-16">
              Ready to level up your coding skills?
            </p>
          </div>
          
          {/* RIGHT SECTION - BUTTON (ONLY FOR HR USERS) */}
          {canCreateSession && (
            <button
              onClick={onCreateSession}
              className="group w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-primary to-secondary rounded-2xl transition-all duration-200 hover:opacity-90 active:scale-95"
            >
              <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 text-white font-bold text-base sm:text-lg">
                <ZapIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                <span>Create Session</span>
                <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default WelcomeSection;