import { redirect } from "next/navigation";

import { AssistShell } from "@/components/assist/AssistShell";
import { ExpertFooter } from "@/components/assist/ExpertFooter";
import { PreviousSessions } from "@/components/assist/PreviousSessions";
import { HomeJoinForm } from "@/components/HomeJoinForm";
import {
  getSessionUser,
  isAdminRole,
  isExpertRole,
} from "@/lib/auth";

export default async function HomePage() {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  const { profile } = session;
  const canJoin = isExpertRole(profile.role);
  const isAdmin = isAdminRole(profile.role);
  const expertName = profile.display_name?.trim() || profile.email;

  return (
    <AssistShell
      sidebar={
        <>
          <div className="assist-brand">Assist AR</div>

          <section className="assist-section">
            <h2 className="assist-section-title">Provide support using ID</h2>
            {!canJoin ? (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 text-xs text-[var(--muted)] leading-relaxed">
                This account is a customer account. Use the Instant app on your
                phone, or ask your administrator for an expert account.
              </div>
            ) : (
              <HomeJoinForm />
            )}
          </section>

          <PreviousSessions />

          <ExpertFooter
            name={expertName}
            email={profile.email}
            roleLabel={isAdmin ? "Admin" : "Expert"}
            avatarUrl={profile.avatar_url}
            showAdmin={isAdmin}
          />
        </>
      }
    >
      <div className="stage-idle">
        <p className="stage-idle-title">Ready to assist</p>
        <p className="stage-idle-copy">
          Enter the customer&apos;s 11-digit public ID on the left, then Connect.
          Their live camera will appear here in portrait.
        </p>
      </div>
    </AssistShell>
  );
}
