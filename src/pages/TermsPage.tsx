import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cyaTransition } from "@/lib/motion";

// ─── Section helpers ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-foreground mb-3 tracking-tight">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-sm leading-relaxed">{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-4">
      {items.map((item, i) => (
        <li key={i} className="text-body text-sm leading-relaxed flex gap-2">
          <span className="text-primary shrink-0 mt-0.5">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TermsPage = () => (
  <div className="min-h-screen bg-background">
    <div className="max-w-lg mx-auto px-4 pt-6 pb-16">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          to="/"
          className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center hover:shadow-gloss-hover transition-shadow shrink-0"
        >
          <ArrowLeft size={16} className="text-foreground" />
        </Link>
        <div>
          <span className="font-mono-data text-primary text-[11px]">CYA</span>
          <h1 className="text-xl text-heading leading-tight">Terms of Service</h1>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cyaTransition}
      >
        <p className="font-mono-data text-muted-foreground text-[11px] mb-8">
          LAST UPDATED: APRIL 29, 2025
        </p>

        <P>
          Welcome to cya. By accessing or using cya ("the Service"), you agree to be bound
          by these Terms of Service ("Terms"). Please read them carefully.
        </P>

        <div className="border-t border-border my-8" />

        <Section title="1. What cya is">
          <P>
            cya is a social scheduling app designed to help groups of friends find shared
            free time and plan activities together. It connects to your Google Calendar
            (with permission) to identify when your group is collectively available, then
            suggests activities based on your shared interests.
          </P>
          <P>
            The Service is currently in beta. Features may change, and some functionality
            may be limited or temporarily unavailable.
          </P>
        </Section>

        <Section title="2. Eligibility">
          <P>
            You must be at least 13 years old to use cya. By using the Service you
            represent that you meet this requirement. If you are under 18, you confirm
            that you have your parent or guardian's permission to use the Service.
          </P>
        </Section>

        <Section title="3. Your account">
          <P>
            You sign in to cya using your Google account. You are responsible for maintaining
            the security of your Google credentials. You must notify us immediately if you
            suspect unauthorised access to your account.
          </P>
          <P>
            You agree to provide accurate information and to keep it up to date. You may not
            create accounts on behalf of others without their express permission.
          </P>
        </Section>

        <Section title="4. Acceptable use">
          <P>
            You agree to use cya only for its intended purpose — coordinating social plans
            with your friends. You must not:
          </P>
          <Ul items={[
            "Use the Service to send spam, unsolicited messages, or harassment to other users",
            "Attempt to access another user's account or data without permission",
            "Use the invite system to contact people who have not consented to receive messages from you",
            "Scrape, reverse-engineer, or interfere with the Service's infrastructure",
            "Use the Service for any illegal purpose or in violation of any applicable law",
            "Impersonate another person or entity",
          ]} />
          <P>
            Violations of this section may result in immediate account suspension or
            termination.
          </P>
        </Section>

        <Section title="5. Google Calendar integration">
          <P>
            By connecting your Google Calendar, you grant cya permission to read your
            free/busy information and, when you RSVP yes to a confirmed hangout, to add
            that event to your primary calendar.
          </P>
          <P>
            You can revoke this permission at any time through your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Google Account permissions
            </a>{" "}
            page or from within the cya app (Profile → Calendar Integration → Disconnect).
          </P>
        </Section>

        <Section title="6. Beta service disclaimer">
          <P>
            cya is provided <strong className="text-foreground font-medium">as-is</strong>{" "}
            while in beta. We make no warranties, express or implied, regarding the
            Service's availability, accuracy, or fitness for a particular purpose.
          </P>
          <P>
            We are not liable for any loss or damage arising from your use of the Service,
            including missed events, scheduling conflicts, or data loss. Features may be
            added, changed, or removed at any time.
          </P>
        </Section>

        <Section title="7. Intellectual property">
          <P>
            The cya app, its design, and underlying technology are owned by us and protected
            by applicable intellectual property laws. You may not copy, modify, or distribute
            any part of the Service without our written permission.
          </P>
          <P>
            You retain ownership of any content you create within cya (group names,
            activity preferences, etc.). By using the Service, you grant us a limited
            licence to use that content solely to operate and improve the Service.
          </P>
        </Section>

        <Section title="8. Account termination">
          <P>
            You may stop using cya at any time. To permanently delete your account and data,
            contact us at the email address below.
          </P>
          <P>
            We reserve the right to suspend or terminate your account without notice if you
            violate these Terms, engage in abusive behaviour, or if we are required to do so
            by law. Where possible, we will provide advance notice before termination.
          </P>
        </Section>

        <Section title="9. Changes to these Terms">
          <P>
            We may update these Terms from time to time. When we make material changes, we
            will update the "Last updated" date above and notify you through the app or via
            email at least 14 days before the changes take effect.
          </P>
          <P>
            Continued use of cya after the effective date of updated Terms constitutes your
            acceptance of the new Terms.
          </P>
        </Section>

        <Section title="10. Governing law">
          <P>
            These Terms are governed by the laws of the State of California, United States,
            without regard to its conflict-of-law provisions.
          </P>
        </Section>

        <Section title="11. Contact">
          <P>
            Questions about these Terms can be sent to:
          </P>
          <div className="glass-surface rounded-lg px-4 py-3 mt-2">
            <a
              href="mailto:hello@see-friends.com"
              className="font-mono-data text-primary text-[12px]"
            >
              hello@see-friends.com
            </a>
          </div>
        </Section>

        {/* Footer nav */}
        <div className="border-t border-border pt-6 flex items-center justify-between">
          <Link to="/privacy" className="font-mono-data text-[11px] text-primary hover:underline">
            Privacy Policy →
          </Link>
          <Link to="/" className="font-mono-data text-[11px] text-muted-foreground hover:text-foreground">
            Back to cya
          </Link>
        </div>
      </motion.div>
    </div>
  </div>
);

export default TermsPage;
