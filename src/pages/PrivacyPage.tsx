import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cyaTransition } from "@/lib/motion";

// ─── Section helpers ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-foreground mb-3 tracking-tight">{title}</h2>
      <div className="space-y-2 text-body text-sm leading-relaxed">{children}</div>
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

const PrivacyPage = () => (
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
          <h1 className="text-xl text-heading leading-tight">Privacy Policy</h1>
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
          cya ("we", "us", or "our") is a social scheduling app that helps friends find time
          to hang out. This Privacy Policy explains what information we collect, how we use it,
          and your rights around that data.
        </P>
        <P>
          By using cya, you agree to the practices described in this policy.
        </P>

        <div className="border-t border-border my-8" />

        <Section title="1. Information we collect">
          <P><strong className="text-foreground font-medium">Google account information</strong></P>
          <P>
            When you sign in with Google, we receive your name, email address, and profile
            picture from your Google account. This is used to identify you within the app.
          </P>

          <P><strong className="text-foreground font-medium">Google Calendar data</strong></P>
          <P>
            With your explicit permission, we access your Google Calendar to read your
            free/busy times over a 4-week window. We collect only the times you are busy —
            we never read, store, or transmit event titles, descriptions, attendees, or any
            other event details.
          </P>
          <P>
            We write to your Google Calendar only when a group hangout is confirmed and you
            have RSVPed "yes", in order to add that event to your calendar.
          </P>

          <P><strong className="text-foreground font-medium">Phone number</strong></P>
          <P>
            If you choose to provide your phone number during onboarding, we store it to
            match you with pending group invites. Providing a phone number is optional and
            can be skipped.
          </P>

          <P><strong className="text-foreground font-medium">Group and activity data</strong></P>
          <Ul items={[
            "Groups you create or join (name, members, invite links)",
            "Activity interests you select for your groups",
            "Your RSVPs and vote responses for proposed hangouts",
            "Availability schedules you manually enter in the app",
          ]} />
        </Section>

        <Section title="2. How we use your information">
          <P>
            We use the information we collect solely to operate cya and provide its core
            features:
          </P>
          <Ul items={[
            "Finding times when all members of a group are free",
            "Suggesting activities that match your group's shared interests",
            "Sending in-app and push notifications about group activity",
            "Adding confirmed hangout events to your Google Calendar",
            "Matching you to group invites sent to your phone number",
          ]} />
          <P>
            We do not sell, rent, or share your personal information with advertisers or
            third-party data brokers, ever.
          </P>
        </Section>

        <Section title="3. Third-party services">
          <P>cya uses the following third-party services to operate:</P>
          <Ul items={[
            "Google OAuth — for sign-in and calendar access (subject to Google's Privacy Policy)",
            "Supabase — our backend database and authentication infrastructure, hosted in the US",
            "Vercel — our hosting and deployment platform",
          ]} />
          <P>
            Each service has its own privacy policy. We encourage you to review them.
            We do not share your data with these services beyond what is necessary to
            operate the app.
          </P>
        </Section>

        <Section title="4. Google Calendar access">
          <P>
            cya's use of Google Calendar data is limited to:
          </P>
          <Ul items={[
            "Reading free/busy information to find shared availability (read-only)",
            "Writing a single calendar event when a group hangout is confirmed and you said yes",
          ]} />
          <P>
            We do not access, read, or store calendar event details (titles, descriptions,
            locations, attendees). Our Google Calendar integration complies with Google's
            API Services User Data Policy, including the Limited Use requirements.
          </P>
        </Section>

        <Section title="5. Data retention and deletion">
          <P>
            You can delete your account and all associated data at any time by contacting us
            at the email address below. Upon request, we will permanently delete:
          </P>
          <Ul items={[
            "Your user profile (name, email, phone number)",
            "Your availability schedules and Google Calendar busy-time data",
            "Your group memberships, RSVPs, and activity preferences",
            "Any notifications or push subscription records associated with your account",
          ]} />
          <P>
            We will complete deletion requests within 30 days. Anonymised, aggregated data
            that cannot be linked back to you may be retained for product improvement.
          </P>
        </Section>

        <Section title="6. Security">
          <P>
            We use industry-standard practices to protect your data, including encrypted
            connections (HTTPS), row-level security on our database, and we never store
            raw Google OAuth access tokens longer than your active session.
          </P>
          <P>
            No method of transmission or storage is 100% secure. If you discover a security
            issue, please contact us immediately at the address below.
          </P>
        </Section>

        <Section title="7. Children">
          <P>
            cya is not directed at children under the age of 13 and we do not knowingly
            collect personal information from children. If you believe a child has provided
            us with personal information, please contact us and we will delete it promptly.
          </P>
        </Section>

        <Section title="8. Changes to this policy">
          <P>
            We may update this Privacy Policy from time to time. When we do, we will update
            the "Last updated" date at the top of this page and, for material changes, notify
            you through the app or via email.
          </P>
        </Section>

        <Section title="9. Contact">
          <P>
            Questions about this Privacy Policy or requests to delete your data can be sent to:
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
          <Link to="/terms" className="font-mono-data text-[11px] text-primary hover:underline">
            Terms of Service →
          </Link>
          <Link to="/" className="font-mono-data text-[11px] text-muted-foreground hover:text-foreground">
            Back to cya
          </Link>
        </div>
      </motion.div>
    </div>
  </div>
);

export default PrivacyPage;
