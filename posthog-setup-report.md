<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the cya app — a React + Vite application using React Router v6 and Supabase for auth. PostHog is initialized in `src/main.tsx` with `PostHogProvider` and `PostHogErrorBoundary` wrapping the entire app, enabling automatic error tracking and access to the PostHog client throughout the component tree. Users are identified using their Supabase user ID on every sign-in, and `posthog.reset()` is called on sign-out to clear the identity. Fourteen events covering the full user journey — from sign-in through group creation, invites, RSVPs, availability, and notifications — were instrumented across nine files.

| Event | Description | File |
|---|---|---|
| `sign_in_clicked` | User clicked the "Continue with Google" button | `src/pages/AuthPage.tsx` |
| `user_signed_in` | User successfully signed in (identify also called here) | `src/contexts/AuthContext.tsx` |
| `onboarding_completed` | User saved their phone number during onboarding | `src/pages/OnboardingPage.tsx` |
| `onboarding_skipped` | User skipped adding a phone number during onboarding | `src/pages/OnboardingPage.tsx` |
| `group_created` | User successfully created a new group | `src/pages/CreateGroupPage.tsx` |
| `invites_sent` | User sent invites to phone numbers when creating a group | `src/pages/CreateGroupPage.tsx` |
| `invite_joined` | User accepted a group invite and joined | `src/pages/InvitePage.tsx` |
| `invite_declined` | User declined a group invite | `src/pages/InvitePage.tsx` |
| `rsvp_submitted` | User responded yes/no/maybe to a hangout proposal | `src/pages/GroupPage.tsx` |
| `vote_cast` | User cast a vote for a hangout activity option | `src/pages/GroupPage.tsx` |
| `availability_saved` | User saved their weekly availability schedule | `src/pages/AvailabilityPage.tsx` |
| `calendar_synced` | User manually triggered a Google Calendar sync | `src/pages/AvailabilityPage.tsx` |
| `push_notifications_allowed` | User clicked Allow on the push notification banner | `src/App.tsx` |
| `user_signed_out` | User signed out from the profile page | `src/pages/ProfilePage.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1594651)
- [Sign-in to Onboarding Funnel](/insights/wB2Cew1k) — conversion from clicking sign in through completing onboarding
- [Group Creation Funnel](/insights/4fC1f66Y) — how many group creators go on to send invites
- [Daily Active Users](/insights/SAff28KX) — unique users signing in per day
- [RSVP Responses Over Time](/insights/PrKqfcbM) — breakdown of yes/no/maybe RSVP responses
- [Invite Join vs Decline](/insights/kT62qq19) — acceptance rate for group invites

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
