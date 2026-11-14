# UI Design System
Tokens are CSS variables in `src/app/globals.css` (bg `#050B18`, panel `rgba(9,25,51,.78)`, electric `#168BFF`, cyan `#4FC3F7`, orange `#FF8C42`, gold `#FFC857`, success/warning/error). Fonts: Space Grotesk (display), Inter (UI).
Components (`src/components/ui`): GlassPanel, GameButton (primary/secondary/outline/ghost/danger, loading, disabled), IconButton, LinkButton, BackButton, XPProgressBar, LevelBadge, StatBar, PlayerAvatar, StatusPill (symbol + color), LoadingBar (indeterminate when unmeasurable), EmptyState, ErrorState, SkeletonLoader, ScreenContainer, StepProgress.
Motion: 120–250 ms hovers/selection, 300 ms screen transitions; reduced motion honored via OS setting and Settings toggle (`.reduce-motion`).
Accessibility: visible gold focus ring, roles/aria on tabs, radios, meters, dialogs; status never color-only; skip link.
