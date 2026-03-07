import { Loader2Icon, XIcon, CheckCircleIcon, AlertCircleIcon, TrendingUpIcon, ZapIcon } from "lucide-react";

// isParticipant prop: true = "Leave Session", false = "End Session" (host)
function AIFeedbackModal({ isOpen, onClose, feedback, isLoading, onConfirmEnd, isParticipant = false }) {
  if (!isOpen) return null;

  const verdictConfig = {
    "Excellent":         { color: "text-success",  bg: "bg-success/10",  border: "border-success/30",  emoji: "🏆" },
    "Good":              { color: "text-info",     bg: "bg-info/10",     border: "border-info/30",     emoji: "✅" },
    "Needs Improvement": { color: "text-warning",  bg: "bg-warning/10",  border: "border-warning/30",  emoji: "⚠️" },
    "Incomplete":        { color: "text-error",    bg: "bg-error/10",    border: "border-error/30",    emoji: "❌" },
  };

  const config = verdictConfig[feedback?.verdict] || verdictConfig["Good"];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <ZapIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">AI Code Review</h2>
              <p className="text-sm text-base-content/50">Powered by Groq · Llama 3.3</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2Icon className="w-10 h-10 animate-spin text-primary" />
            <p className="text-base-content/60">Analyzing your code...</p>
            <p className="text-xs text-base-content/30">This takes 3-5 seconds</p>
          </div>
        )}

        {/* Feedback content */}
        {!isLoading && feedback && (
          <div className="p-6 space-y-5">

            {/* Verdict */}
            <div className={`${config.bg} border ${config.border} rounded-xl p-4 flex items-center gap-3`}>
              <span className="text-3xl">{config.emoji}</span>
              <div>
                <div className={`font-bold text-lg ${config.color}`}>{feedback.verdict}</div>
                <div className="text-sm text-base-content/60">{feedback.overallFeedback}</div>
              </div>
            </div>

            {/* Complexity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-base-200 rounded-xl p-4 text-center">
                <div className="text-xs text-base-content/40 uppercase tracking-wider mb-1">Time Complexity</div>
                <div className="font-mono font-bold text-primary text-lg">{feedback.timeComplexity}</div>
              </div>
              <div className="bg-base-200 rounded-xl p-4 text-center">
                <div className="text-xs text-base-content/40 uppercase tracking-wider mb-1">Space Complexity</div>
                <div className="font-mono font-bold text-secondary text-lg">{feedback.spaceComplexity}</div>
              </div>
            </div>

            {/* Strengths */}
            {feedback.strengths?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircleIcon className="w-4 h-4 text-success" />
                  <span className="font-semibold text-sm">Strengths</span>
                </div>
                <ul className="space-y-2">
                  {feedback.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-base-content/70">
                      <span className="text-success mt-0.5">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvements */}
            {feedback.improvements?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUpIcon className="w-4 h-4 text-warning" />
                  <span className="font-semibold text-sm">Areas to Improve</span>
                </div>
                <ul className="space-y-2">
                  {feedback.improvements.map((imp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-base-content/70">
                      <span className="text-warning mt-0.5">•</span>
                      {imp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {!isLoading && !feedback && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircleIcon className="w-10 h-10 text-error" />
            <p className="text-base-content/60">Could not generate feedback</p>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-base-300 flex gap-3 justify-end">
          <button onClick={onClose} className="btn btn-ghost">
            Stay
          </button>
          <button onClick={onConfirmEnd} className="btn btn-error">
            {isParticipant ? "Leave Session" : "End Session"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default AIFeedbackModal;