import React from 'react';
import type { AppId } from '@ace/shared';

import AiApp from '@ace/app-ai';
import FocusApp from '@ace/app-focus';
import HomeApp from '@ace/app-home';
import SettingsApp from '@ace/app-settings';

/**
 * Renders the React module for the given appId inside the website
 * shell (NOT inside a draggable window frame \u2014 the frame metaphor is
 * gone in this iteration).
 *
 * Only the apps we currently ship are wired here. Unknown ids surface
 * a graceful "unknown view" message so a stale `activeView` from an
 * older build can never crash the page.
 */
const REGISTRY: Partial<Record<AppId, React.ComponentType>> = {
  ai: AiApp,
  focus: FocusApp,
  home: HomeApp,
  settings: SettingsApp,
};

const UnknownApp: React.FC<{ appId: AppId }> = ({ appId }) => (
  <div
    className="h-full w-full flex flex-col items-center justify-center gap-3 px-8 text-center text-ace-muted"
    data-testid="unknown-app"
  >
    <div className="text-3xl">{'\u2728'}</div>
    <div className="text-lg font-semibold text-ace-ink">
      {appId} is not available
    </div>
    <p className="text-sm max-w-md">
      This view isn\u2019t wired up in the current build. Pick another app
      from the sidebar to continue.
    </p>
  </div>
);

export const AppHost: React.FC<{ appId: AppId }> = ({ appId }) => {
  const Component = REGISTRY[appId];
  if (!Component) return <UnknownApp appId={appId} />;
  return (
    <div className="h-full w-full" data-testid={`app-host-${appId}`}>
      <Component />
    </div>
  );
};
