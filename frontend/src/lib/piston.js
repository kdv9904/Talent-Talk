// Piston API is a service for code execution

const PISTON_API = import.meta.env.VITE_API_BASE_URL;

const LANGUAGE_VERSIONS = {
  javascript: { language: "javascript", version: "18.15.0" },
  python: { language: "python", version: "3.10.0" },
  java: { language: "java", version: "15.0.2" },
};

/**
 * @param {string} language - programming language
 * @param {string} code - source code to executed
 * @returns {Promise<{success:boolean, output?:string, error?: string}>}
 */
export async function executeCode(language, code, getToken) { // ✅ add getToken param
  try {
    const languageConfig = LANGUAGE_VERSIONS[language];
    if (!languageConfig) {
      return { success: false, error: `Unsupported language: ${language}` };
    }

    const token = await getToken(); // ✅ get auth token

    const response = await fetch(`${PISTON_API}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` // ✅ add token
      },
      body: JSON.stringify({
  language: languageConfig.language,
  version: languageConfig.version,
  source_code: code,
  stdin: "",
}),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();

    if (!data.run) {
  return {
    success: false,
    error: data.error || data.message || "Code execution failed",
  };
}

    const output = data.run.output || "";
    const stderr = data.run.stderr || "";

    if (stderr) {
      return {
        success: false,
        output: output,
        error: stderr,
      };
    }

    return {
      success: true,
      output: output || "No output",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute code: ${error.message}`,
    };
  }
}

function getFileExtension(language) {
  const extensions = {
    javascript: "js",
    python: "py",
    java: "java",
  };

  return extensions[language] || "txt";
}