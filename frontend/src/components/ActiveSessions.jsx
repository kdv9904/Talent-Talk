import {
  ArrowRightIcon,
  Code2Icon,
  CrownIcon,
  SparklesIcon,
  UsersIcon,
  ZapIcon,
  LoaderIcon,
} from "lucide-react";
import { Link } from "react-router";
import { getDifficultyBadgeClass } from "../lib/utils";

function ActiveSessions({ sessions, isLoading, isUserInSession }) {
  return (
    <div className="lg:col-span-2 card bg-base-100 border-2 border-primary/20 hover:border-primary/30 h-full">
      <div className="card-body p-4 sm:p-6">
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          {/* TITLE AND ICON */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
              <ZapIcon className="size-4 sm:size-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black">Live Sessions</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="size-2 bg-success rounded-full" />
            <span className="text-xs sm:text-sm font-medium text-success">
              {sessions.length} active
            </span>
          </div>
        </div>

        {/* SESSIONS LIST */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <LoaderIcon className="size-8 sm:size-10 animate-spin text-primary" />
            </div>
          ) : sessions.length > 0 ? (
            sessions.map((session) => {
              const participantCount = session.participants ? session.participants.length + 1 : 1;
              const maxParticipants = session.maxParticipants || 4;
              const isFull = participantCount >= maxParticipants;
              const userInSession = isUserInSession(session);

              return (
                <div
                  key={session._id}
                  className="card bg-base-200 border-2 border-base-300 hover:border-primary/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-5">
                    {/* LEFT SIDE */}
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="relative size-12 sm:size-14 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                        <Code2Icon className="size-6 sm:size-7 text-white" />
                        <div className="absolute -top-1 -right-1 size-3 sm:size-4 bg-success rounded-full border-2 border-base-100" />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* TITLE AND DIFFICULTY */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-bold text-base sm:text-lg truncate">
                            {session.problem}
                          </h3>
                          <span
                            className={`badge badge-xs sm:badge-sm ${getDifficultyBadgeClass(
                              session.difficulty
                            )}`}
                          >
                            {session.difficulty.slice(0, 1).toUpperCase() +
                              session.difficulty.slice(1)}
                          </span>
                        </div>

                        {/* HOST AND PARTICIPANT INFO */}
                        <div className="flex flex-col gap-2 text-xs sm:text-sm opacity-80">
                          <div className="flex items-center gap-1.5">
                            <CrownIcon className="size-3 sm:size-4 flex-shrink-0" />
                            <span className="font-medium truncate">{session.host?.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <UsersIcon className="size-3 sm:size-4 flex-shrink-0" />
                            <span>{participantCount}/{maxParticipants}</span>
                            {isFull && !userInSession ? (
                              <span className="badge badge-error badge-xs sm:badge-sm">FULL</span>
                            ) : userInSession ? (
                              <span className="badge badge-info badge-xs sm:badge-sm">JOINED</span>
                            ) : (
                              <span className="badge badge-success badge-xs sm:badge-sm">OPEN</span>
                            )}
                          </div>

                          {/* PARTICIPANT NAMES */}
                          {session.participants && session.participants.length > 0 && (
                            <div className="text-xs opacity-60 truncate">
                              <span>With: </span>
                              {session.participants.slice(0, 2).map((p, index) => (
                                <span key={p.user?._id || index} className="truncate">
                                  {p.user?.name}
                                  {index < Math.min(session.participants.length - 1, 1) ? ", " : ""}
                                </span>
                              ))}
                              {session.participants.length > 2 && (
                                <span> +{session.participants.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* BUTTON */}
                    {isFull && !userInSession ? (
                      <button className="btn btn-disabled btn-sm w-full sm:w-auto">
                        Full
                      </button>
                    ) : (
                      <Link
                        to={`/session/${session._id}`}
                        className="btn btn-primary btn-sm gap-2 w-full sm:w-auto justify-center"
                      >
                        {userInSession ? "Rejoin" : "Join"}
                        <ArrowRightIcon className="size-3 sm:size-4" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 sm:py-16">
              <div className="w-16 sm:w-20 h-16 sm:h-20 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-3xl flex items-center justify-center">
                <SparklesIcon className="w-8 sm:w-10 h-8 sm:h-10 text-primary/50" />
              </div>
              <p className="text-base sm:text-lg font-semibold opacity-70 mb-1">
                No active sessions
              </p>
              <p className="text-xs sm:text-sm opacity-50">Be the first to create one!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActiveSessions;