// TypeScript types mirroring the Supabase database schema.
// Keep in sync with the SQL tables defined in the Supabase dashboard.

export interface DbUser {
  id: string;                         // uuid — matches auth.users.id
  email: string;
  display_name: string | null;
  phone_number: string | null;
  google_refresh_token: string | null; // stored after first Google OAuth
  interests: string[];
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
}

export interface DbGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  // Populated by joins:
  users?: DbUser;
  groups?: DbGroup;
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
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
  // Populated by joins:
  groups?: { id: string; name: string };
  rsvps?: DbRsvp[];
}

export interface DbRsvp {
  id: string;
  hangout_id: string;
  user_id: string;
  response: "yes" | "no" | "pending";
  created_at: string;
  // Populated by join:
  users?: Pick<DbUser, "id" | "display_name">;
}

// Convenience type: group row with its members array pre-joined
export interface DbGroupWithMembers extends DbGroup {
  group_members: (Omit<DbGroupMember, "users"> & { users: DbUser })[];
}
