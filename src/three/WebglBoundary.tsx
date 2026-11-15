import { Component, type ReactNode } from 'react';

// Kept free of three.js imports so screens can use it without pulling the 3D bundle.
/** WebGL can be missing or blocked; the 2D drawing still tells the story. */
export class WebglBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
