import type { ReactNode } from "react";

type AssistShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

/** Two-pane Assist AR frame: fixed left rail + stage. */
export function AssistShell({ sidebar, children }: AssistShellProps) {
  return (
    <div className="assist-shell">
      <aside className="assist-sidebar">{sidebar}</aside>
      <main className="assist-main">{children}</main>
    </div>
  );
}
