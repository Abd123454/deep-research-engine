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
    return <div className="flex items-center justify-center min-h-screen font-body text-lg text-[#6b6358]">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] dark:bg-[#2b2a27]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-body text-3xl font-normal text-[#2a2620] dark:text-[#e8e3d8] mb-1">Projects</h1>
            <p className="font-ui text-sm text-[#6b6358]">Persistent knowledge bases with custom instructions</p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 bg-[#b5673a] text-[#faf8f3] rounded-lg px-4 py-2.5 font-ui text-sm font-medium hover:bg-[#8b4513] transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>

        {showCreate && (
          <div className="mb-6 bg-[#faf8f3] dark:bg-[#252220] border border-[#d9d4c7] dark:border-[#3d3830] rounded-3xl p-6">
            <input
              type="text"
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-transparent border-0 font-body text-xl text-[#2a2620] dark:text-[#e8e3d8] placeholder:text-[#6b6358] outline-none mb-3"
              style={{ boxShadow: "none", minHeight: "auto", padding: "0" }}
            />
            <textarea
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="w-full bg-transparent border-0 font-ui text-sm text-[#2a2620] dark:text-[#e8e3d8] placeholder:text-[#6b6358] outline-none resize-none"
              style={{ boxShadow: "none", minHeight: "auto", padding: "0" }}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={createProject} className="bg-[#b5673a] text-[#faf8f3] rounded-lg px-4 py-2 font-ui text-sm font-medium hover:bg-[#8b4513] transition-colors">Create</button>
              <button onClick={() => setShowCreate(false)} className="border border-[#6b6358] text-[#2a2620] dark:text-[#e8e3d8] rounded-lg px-4 py-2 font-ui text-sm hover:bg-[#e0d9c8] dark:hover:bg-[#322e28] transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-16">
            <Folder className="h-12 w-12 text-[#d9d4c7] mx-auto mb-4" />
            <p className="font-body text-lg text-[#6b6358] mb-2">No projects yet</p>
            <p className="font-ui text-sm text-[#6b6358]">Create a project to organize research and conversations with custom instructions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block bg-[#faf8f3] dark:bg-[#252220] border border-[#d9d4c7] dark:border-[#3d3830] rounded-3xl p-6 hover:border-[#b5673a] transition-colors"
              >
                <h3 className="font-body text-lg text-[#2a2620] dark:text-[#e8e3d8] mb-1">{project.name}</h3>
                <p className="font-ui text-sm text-[#6b6358] mb-4 line-clamp-2">{project.description || "No description"}</p>
                <div className="flex items-center gap-3 text-xs font-ui text-[#6b6358]">
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
