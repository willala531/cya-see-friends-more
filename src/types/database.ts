// TypeScript types mirroring the Supabase database schema.
// Keep in sync with the SQL tables defined in the Supabase dashboard.

export interface DbUser {
  id: string;                         // uuid — matches auth.users.id
  email: string;
  display_name: string | null;
  phone_number: string | null;        // E.164 format, e.g. +13105551234
  google_refresh_token: string | null; // stored after first Google OAuth
  interests: string[];
  has_completed_onboarding: boolean;  // false for new users until phone collected
  created_at: string;
}

export interface DbGroup {
  id: string;
  name: string;
  created_by: string | null;          // references users.id
  invite_code: string;
  created_at: string;
  group_interests: string[];          // activity IDs selected by the group
  last_suggested_activity_id: string | null; // for repeat-filter persistence
  last_hangout_at: string | null;     // set when a confirmed hangout's start_time passes
}

export interface DbGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  can_invite: boolean;               // true = this member may send invites
  joined_at: string;
  // Populated by joins:
  users?: DbUser;
  groups?: DbGroup;
}

export interface DbGroupInvite {
  id: string;
  group_id: string;
  invited_by: string;                // user_id of the sender
  phone_number: string;              // E.164
  status: "pending" | "accepted" | "declined" | "expired";
  token: string;                     // crypto UUID — acts as a secret URL slug
  invited_user_id: string | null;    // set for existing cya users (in-app invite path)
  created_at: string;
  expires_at: string;
  // Populated by joins:
  users?: Pick<DbUser, "id" | "display_name">;       // inviter (via invited_by FK)
  inviter?: Pick<DbUser, "id" | "display_name">;     // alias used by useMyPendingGroupInvite
  groups?: Pick<DbGroup, "id" | "name">;
}

export interface DbAvailabilityBlock {
  id: string;
  user_id: string;
  start_time: string | null;          // ISO timestamptz — set for concrete blocks
  end_time: string | null;            // ISO timestamptz — set for concrete blocks
  is_recurring: boolean;
  // JSONB payload — shape depends on source:
  //   source="manual"   → Omit<RecurringBlock, "id"> (dayOfWeek, startTime, endTime)
  //   source="schedule" → WeekSchedule (Record<string, DaySchedule>)
  //   source="google"   → null (concrete timestamps used instead)
  recurrence_rule: Record<string, unknown> | null;
  source: "google" | "manual" | "schedule";
  created_at: string;
}

export interface DbHangoutSuggestion {
  id: string;
  group_id: string;
  start_time: string | null;
  end_time: string | null;
  suggested_activity: string | null;
  status: "pending" | "confirmed" | "cancelled" | "expired" | "paused" | "completed";
  created_at: string;
  // New columns for RSVP flow:
  reminder_sent: boolean;
  rsvp_expires_at: string | null;     // day before the event
  vote_expires_at: string | null;     // 24h after first "maybe"
  vote_options: {                     // set when vote flow is active
    originalId: string | null;
    alt1Id: string | null;
    alt2Id: string | null;
  } | null;
  winning_activity_id: string | null; // set after vote resolves
  // Populated by joins:
  groups?: { id: string; name: string };
  rsvps?: DbRsvp[];
}

export interface DbRsvp {
  id: string;
  hangout_id: string;
  user_id: string;
  response: "yes" | "no" | "maybe" | "pending";
  created_at: string;
  // Populated by join:
  users?: Pick<DbUser, "id" | "display_name">;
}

export interface DbHangoutVote {
  id: string;
  hangout_id: string;
  user_id: string;
  activity_id: string;
  created_at: string;
}

export interface DbNotification {
  id: string;
  user_id: string;
  group_id: string | null;
  message: string;
  read: boolean;
  created_at: string;
}

export interface DbPushSubscription {
  id: string;
  user_id: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  created_at: string;
}

export interface DbFeedback {
  id: string;
  user_id: string | null;
  type: "bug" | "suggestion";
  page: string | null;
  message: string;
  browser: string | null;
  os: string | null;
  screen_resolution: string | null;
  app_version: string | null;
  user_email: string | null;
  user_display_name: string | null;
  created_at: string;
}

// Convenience type: group row with its members array pre-joined
export interface DbGroupWithMembers extends DbGroup {
  group_members: (Omit<DbGroupMember, "users"> & { users: DbUser })[];
}

// Shape returned by the get-invite Edge Function (public, no auth required)
export interface InviteLookup {
  groupName: string;
  inviterName: string;
  status: DbGroupInvite["status"];
  groupId: string;
  inviteId: string;
  expiresAt: string;
  isValid: boolean;                  // false if expired or already accepted/declined
}
