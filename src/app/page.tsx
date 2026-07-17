"use client";

import * as React from "react";
import { UnifiedInterface } from "@/components/UnifiedInterface";
import type { Artifact } from "@/lib/artifact-detector";

export default function Home() {
  const [, setArtifact] = React.useState<Artifact | null>(null);

  return <UnifiedInterface onArtifact={setArtifact} />;
}
