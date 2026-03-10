import React, { Suspense, Component, ReactNode } from "react";

const LazyCyberpunkScene = React.lazy(() => import("./CyberpunkScene"));

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn("[3D Scene] Failed to load:", error.message);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

type Props = {
  intensity?: "full" | "subtle";
  sacredGeometry?: "flower" | "merkaba" | "fibonacci";
};

export default function SafeCyberpunkScene({ intensity = "full", sacredGeometry }: Props) {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <LazyCyberpunkScene intensity={intensity} sacredGeometry={sacredGeometry} />
      </Suspense>
    </ErrorBoundary>
  );
}
