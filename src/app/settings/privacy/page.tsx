"use client";

import * as React from "react";

export default function PrivacySettingsPage() {
  const [privacyMode, setPrivacyMode] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Check current privacy mode from preferences
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        setPrivacyMode(data.preferences?.privacyMode === "true");
      })
      .finally(() => setLoading(false));
  }, []);

  async function togglePrivacy() {
    const newValue = !privacyMode;
    setPrivacyMode(newValue);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privacyMode: String(newValue) }),
    });
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen font-serif text-lg text-[#87867f]">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f0eee6] dark:bg-[#2b2a27]">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="font-serif text-3xl font-normal text-[#141413] dark:text-[#eeeeee] mb-2">Privacy</h1>
        <p className="font-sans text-sm text-[#87867f] mb-8">Control how your data is processed</p>

        <div className="bg-[#faf9f5] dark:bg-[#1f1e1b] border border-[#cccbc8] dark:border-[#3d3a35] rounded-3xl p-6">
          <label className="flex items-center gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyMode}
              onChange={togglePrivacy}
              className="h-5 w-5 accent-[#d97757]"
            />
            <div>
              <div className="font-sans font-medium text-[#141413] dark:text-[#eeeeee]">Privacy Mode</div>
              <p className="font-sans text-sm text-[#87867f] mt-1">
                Use local models only (Ollama). No data leaves your device. Slower but 100% private.
              </p>
            </div>
          </label>
        </div>

        <div className="mt-6 bg-[#faf9f5] dark:bg-[#1f1e1b] border border-[#cccbc8] dark:border-[#3d3a35] rounded-3xl p-6">
          <h2 className="font-sans text-sm font-medium text-[#141413] dark:text-[#eeeeee] mb-3">Data Storage</h2>
          <p className="font-sans text-sm text-[#87867f]">
            Your conversations, memories, and research are stored in the local database.
            File uploads are stored in S3/MinIO. No data is sent to external services
            unless cloud LLM providers are explicitly configured.
          </p>
        </div>
      </div>
    </div>
  );
}
