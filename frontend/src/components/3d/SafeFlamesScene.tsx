import React, { Suspense, Component, ReactNode } from "react";

const LazyFlamesHeroScene = React.lazy(() => import("./FlamesHeroScene"));

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn("[3D FlamesScene] Failed to load:", error.message);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function SafeFlamesScene() {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <LazyFlamesHeroScene />
      </Suspense>
    </ErrorBoundary>
  );
}
