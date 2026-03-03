// hooks/useBotDetection.js - FIXED VERSION
import { useEffect, useState } from "react";

export const useBotDetection = (sessionId, isHR = false) => {
  const [violations, setViolations] = useState(0);

  useEffect(() => {
    if (isHR || !sessionId) return;

    let detectionInterval;
    let violationCount = 0;

    const detectAutomation = () => {
      // ENHANCED CHECKS FOR AI EXTENSIONS
      const checks = {
        // Existing automation detection
        chromeRuntime: !!window.chrome?.runtime?.id,
        webdriver: !!navigator.webdriver,
        selenium: !!window.__webdriver_evaluate || 
                 !!window.__selenium_evaluate,
        
        // 🔥 NEW: AI EXTENSION DETECTION
        siderExtension: !!window.sider || 
                       document.querySelector('[class*="sider"], [id*="sider"]') ||
                       navigator.userAgent.toLowerCase().includes('sider'),
        
        chatGPTExtensions: !!window.chatgpt || 
                          document.querySelector('[class*="chatgpt"], [id*="chatgpt"]') ||
                          navigator.userAgent.toLowerCase().includes('chatgpt'),
        
        copilotExtension: !!window.copilot || 
                         document.querySelector('[class*="copilot"], [id*="copilot"]'),
        
        // Detect injected AI content
        hasAIContent: document.body.innerText.includes('Get smarter answer from') ||
                     document.body.innerText.includes('By Sider') ||
                     document.body.innerText.includes('Fusion'),
        
        // Detect common AI extension patterns
        aiToolbar: document.querySelector('.ai-toolbar, .sider-sidebar, .copilot-widget'),
        
        // Check for extension APIs
        hasAIPlugin: !!window.AI || !!window.aiAssistant || !!window.assistant,
        
        // Mutation Observer for dynamic injection
        hasInjectedElements: document.querySelectorAll('[extension-id], [ai-extension]').length > 0
      };

      // Count violations
      const detectedViolations = Object.values(checks).filter(Boolean).length;
      
      if (detectedViolations > 0) {
        violationCount++;
        setViolations(violationCount);
        
        console.warn(`🤖 BOT DETECTION TRIGGERED:`, {
          checks,
          violationCount,
          userAgent: navigator.userAgent
        });
        
        // 🔥 FIX: Use sessionId instead of id
        fetch(`/api/sessions/${sessionId}/violation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            type: 'ai_extension_detected', 
            tool: 'Sider', // Specific tool name
            violations: detectedViolations,
            details: checks,
            count: violationCount
          })
        }).catch(console.error);

        // Auto-exit after 3 violations
        if (violationCount >= 3) {
          alert('🚫 AI/Bot usage detected! You have been removed from the session.');
          window.location.href = '/dashboard';
          return;
        }
      }
    };

    // 🔥 MORE FREQUENT CHECKS
    detectionInterval = setInterval(detectAutomation, 1000); // Every 1 second

    // 🔥 ADD MUTATION OBSERVER FOR DYNAMIC CONTENT
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          detectAutomation(); // Check when new elements are added
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'src']
    });

    // Initial check
    detectAutomation();

    return () => {
      if (detectionInterval) clearInterval(detectionInterval);
      observer.disconnect();
    };
  }, [sessionId, isHR]);

  return { violations };
};