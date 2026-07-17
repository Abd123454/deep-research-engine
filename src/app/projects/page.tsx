"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Folder, FileText, Clock } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [newInstructions, setNewInstructions] = React.useState("");

  React.useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects || []))
      .finally(() => setLoading(false));
  }, []);

  async function createProject() {
    if (!newName.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc }),
    });
    const data = await res.json();
    if (data.project) {
      setProjects((prev) => [data.project, ...prev]);
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen font-serif text-lg text-[#87867f]">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f0eee6] dark:bg-[#2b2a27]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl font-normal text-[#141413] dark:text-[#eeeeee] mb-1">Projects</h1>
            <p className="font-sans text-sm text-[#87867f]">Persistent knowledge bases with custom instructions</p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 bg-[#d97757] text-[#faf9f5] rounded-lg px-4 py-2.5 font-sans text-sm font-medium hover:bg-[#c6613f] transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>

        {showCreate && (
          <div className="mb-6 bg-[#faf9f5] dark:bg-[#1f1e1b] border border-[#cccbc8] dark:border-[#3d3a35] rounded-3xl p-6">
            <input
              type="text"
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-transparent border-0 font-serif text-xl text-[#141413] dark:text-[#eeeeee] placeholder:text-[#87867f] outline-none mb-3"
              style={{ boxShadow: "none", minHeight: "auto", padding: "0" }}
            />
            <textarea
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="w-full bg-transparent border-0 font-sans text-sm text-[#141413] dark:text-[#eeeeee] placeholder:text-[#87867f] outline-none resize-none"
              style={{ boxShadow: "none", minHeight: "auto", padding: "0" }}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={createProject} className="bg-[#d97757] text-[#faf9f5] rounded-lg px-4 py-2 font-sans text-sm font-medium hover:bg-[#c6613f] transition-colors">Create</button>
              <button onClick={() => setShowCreate(false)} className="border border-[#87867f] text-[#141413] dark:text-[#eeeeee] rounded-lg px-4 py-2 font-sans text-sm hover:bg-[#e3dacc] dark:hover:bg-[#393937] transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-16">
            <Folder className="h-12 w-12 text-[#cccbc8] mx-auto mb-4" />
            <p className="font-serif text-lg text-[#87867f] mb-2">No projects yet</p>
            <p className="font-sans text-sm text-[#87867f]">Create a project to organize research and conversations with custom instructions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block bg-[#faf9f5] dark:bg-[#1f1e1b] border border-[#cccbc8] dark:border-[#3d3a35] rounded-3xl p-6 hover:border-[#d97757] transition-colors"
              >
                <h3 className="font-serif text-lg text-[#141413] dark:text-[#eeeeee] mb-1">{project.name}</h3>
                <p className="font-sans text-sm text-[#87867f] mb-4 line-clamp-2">{project.description || "No description"}</p>
                <div className="flex items-center gap-3 text-xs font-sans text-[#87867f]">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
