"use client";
import * as Sentry from "@sentry/nextjs";

import * as React from "react";
import { UnifiedInterface } from "@/components/UnifiedInterface";
import type { Artifact } from "@/lib/artifact-detector";

export default function Home() {
  const [artifact, _setArtifact] = React.useState<Artifact | null>(null);

  return <UnifiedInterface onArtifact={_setArtifact} />;
}
