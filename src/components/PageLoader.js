import React from "react";

// Suspense fallback shown while a lazily-loaded page chunk downloads.
// Self-contained (its own keyframes) so it doesn't depend on the app's injected
// stylesheet, and brand-coloured so the brief load feels intentional, not broken.
export default function PageLoader() {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        minHeight: "55vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{"@keyframes stitchd-spin{to{transform:rotate(360deg)}}"}</style>
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "3px solid #f0d4e6",
          borderTopColor: "#FF1493",
          animation: "stitchd-spin .7s linear infinite",
          display: "block",
        }}
      />
    </div>
  );
}
