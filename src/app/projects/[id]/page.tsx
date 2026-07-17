"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Brain } from "lucide-react";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [project, setProject] = React.useState<{ name: string; description: string | null; customInstructions?: string; conversations?: Array<{ id: string; title: string }> } | null>(null);
  const [instructions, setInstructions] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        setProject(data.project);
        setInstructions(data.project?.customInstructions || data.project?.description || "");
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  async function saveInstructions() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customInstructions: instructions }),
    });
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen font-serif text-lg text-[#87867f]">Loading...</div>;
  if (!project) return <div className="flex items-center justify-center min-h-screen font-serif text-lg text-[#87867f]">Project not found</div>;

  return (
    <div className="min-h-screen bg-[#f0eee6] dark:bg-[#2b2a27]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/projects" className="inline-flex items-center gap-1 font-sans text-sm text-[#87867f] hover:text-[#141413] dark:hover:text-[#eeeeee] mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Link>

        <h1 className="font-serif text-3xl font-normal text-[#141413] dark:text-[#eeeeee] mb-2">{project.name}</h1>
        <p className="font-sans text-sm text-[#87867f] mb-8">{project.description || "No description"}</p>

        {/* Custom Instructions Panel */}
        <div className="bg-[#faf9f5] dark:bg-[#1f1e1b] border border-[#cccbc8] dark:border-[#3d3a35] rounded-3xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-[#d97757]" />
            <h2 className="font-sans text-sm font-medium text-[#141413] dark:text-[#eeeeee]">Custom Instructions</h2>
          </div>
          <p className="font-sans text-xs text-[#87867f] mb-3">These instructions are prepended to every conversation in this project.</p>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
            placeholder="e.g., Always cite sources in APA format. Focus on renewable energy topics. Use technical language."
            className="w-full bg-[#f0eee6] dark:bg-[#2b2a27] border border-[#cccbc8] dark:border-[#3d3a35] rounded-xl px-4 py-3 font-sans text-sm text-[#141413] dark:text-[#eeeeee] placeholder:text-[#87867f] outline-none focus:border-[#d97757] resize-none"
            style={{ boxShadow: "none", minHeight: "120px" }}
          />
          <button
            onClick={saveInstructions}
            disabled={saving}
            className="mt-3 flex items-center gap-2 bg-[#d97757] text-[#faf9f5] rounded-lg px-4 py-2 font-sans text-sm font-medium hover:bg-[#c6613f] transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Instructions"}
          </button>
        </div>

        {/* Conversations in this project */}
        <div className="bg-[#faf9f5] dark:bg-[#1f1e1b] border border-[#cccbc8] dark:border-[#3d3a35] rounded-3xl p-6">
          <h2 className="font-sans text-sm font-medium text-[#141413] dark:text-[#eeeeee] mb-4">Conversations</h2>
          {project.conversations && project.conversations.length > 0 ? (
            <div className="space-y-2">
              {project.conversations.map((conv: { id: string; title: string }) => (
                <div key={conv.id} className="px-4 py-3 rounded-lg hover:bg-[#e3dacc] dark:hover:bg-[#393937] transition-colors">
                  <p className="font-sans text-sm text-[#141413] dark:text-[#eeeeee]">{conv.title || "Untitled"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-sans text-sm text-[#87867f]">No conversations yet. Start chatting from the home page with this project selected.</p>
          )}
        </div>
      </div>
    </div>
  );
}
