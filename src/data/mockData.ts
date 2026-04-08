// Mock data for the MVP frontend
import type { RecurringBlock } from "@/types/calendar";

export interface User {
  id: string;
  name: string;
  email: string;
  calendarConnected: boolean;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  members: GroupMember[];
}

export interface GroupMember {
  userId: string;
  name: string;
  role: "admin" | "member";
  synced: boolean;
}

export interface ProposedSlot {
  id: string;
  startTime: string;
  endTime: string;
  score: number; // how many members are free
}

export interface RSVP {
  userId: string;
  userName: string;
  status: "yes" | "no" | "pending";
}

export interface CyaEvent {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  description: string;
  status: "proposed" | "confirmed";
  proposedSlot: ProposedSlot;
  rsvps: RSVP[];
}

export const mockUser: User = {
  id: "u1",
  name: "Alex",
  email: "alex@email.com",
  calendarConnected: true,
};

export const mockGroups: Group[] = [
  {
    id: "g1",
    name: "Friday Crew",
    inviteCode: "FRI-2024-XK",
    members: [
      { userId: "u1", name: "Alex", role: "admin", synced: true },
      { userId: "u2", name: "Jordan", role: "member", synced: true },
      { userId: "u3", name: "Sam", role: "member", synced: true },
      { userId: "u4", name: "Taylor", role: "member", synced: false },
    ],
  },
  {
    id: "g2",
    name: "Hiking Pals",
    inviteCode: "HIK-2024-QZ",
    members: [
      { userId: "u1", name: "Alex", role: "admin", synced: true },
      { userId: "u5", name: "Morgan", role: "member", synced: true },
      { userId: "u6", name: "Casey", role: "member", synced: true },
    ],
  },
  {
    id: "g3",
    name: "Game Night",
    inviteCode: "GMN-2024-AB",
    members: [
      { userId: "u1", name: "Alex", role: "member", synced: true },
      { userId: "u2", name: "Jordan", role: "admin", synced: true },
      { userId: "u7", name: "Riley", role: "member", synced: true },
      { userId: "u8", name: "Quinn", role: "member", synced: true },
      { userId: "u9", name: "Drew", role: "member", synced: false },
    ],
  },
];

// ─── Mock busy patterns for non-current-user members ─────────────────────────
// Stored as RecurringBlock[] (always relative to now) so they never go stale.
// Taylor (u4) and Drew (u9) have synced: false and are excluded from matching.

export const MOCK_MEMBER_BUSY_PATTERNS: Record<string, RecurringBlock[]> = {
  // Jordan: Mon–Fri 9–5, Tuesday gym 7–9pm
  u2: [
    { id: "u2-1", dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
    { id: "u2-2", dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
    { id: "u2-3", dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
    { id: "u2-4", dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
    { id: "u2-5", dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
    { id: "u2-6", dayOfWeek: 2, startTime: "19:00", endTime: "21:00" },
  ],
  // Sam: Mon–Fri 9–6, Thursday class 6–9pm
  u3: [
    { id: "u3-1", dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
    { id: "u3-2", dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
    { id: "u3-3", dayOfWeek: 3, startTime: "09:00", endTime: "18:00" },
    { id: "u3-4", dayOfWeek: 4, startTime: "09:00", endTime: "18:00" },
    { id: "u3-5", dayOfWeek: 5, startTime: "09:00", endTime: "18:00" },
    { id: "u3-6", dayOfWeek: 4, startTime: "18:00", endTime: "21:00" },
  ],
  // Morgan: Mon–Fri 8–4, Saturday morning hike 8–11am
  u5: [
    { id: "u5-1", dayOfWeek: 1, startTime: "08:00", endTime: "16:00" },
    { id: "u5-2", dayOfWeek: 2, startTime: "08:00", endTime: "16:00" },
    { id: "u5-3", dayOfWeek: 3, startTime: "08:00", endTime: "16:00" },
    { id: "u5-4", dayOfWeek: 4, startTime: "08:00", endTime: "16:00" },
    { id: "u5-5", dayOfWeek: 5, startTime: "08:00", endTime: "16:00" },
    { id: "u5-6", dayOfWeek: 6, startTime: "08:00", endTime: "11:00" },
  ],
  // Casey: Mon–Fri 10–6
  u6: [
    { id: "u6-1", dayOfWeek: 1, startTime: "10:00", endTime: "18:00" },
    { id: "u6-2", dayOfWeek: 2, startTime: "10:00", endTime: "18:00" },
    { id: "u6-3", dayOfWeek: 3, startTime: "10:00", endTime: "18:00" },
    { id: "u6-4", dayOfWeek: 4, startTime: "10:00", endTime: "18:00" },
    { id: "u6-5", dayOfWeek: 5, startTime: "10:00", endTime: "18:00" },
  ],
  // Riley: Mon–Fri 9–5, Wednesday game night 6–8pm
  u7: [
    { id: "u7-1", dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
    { id: "u7-2", dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
    { id: "u7-3", dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
    { id: "u7-4", dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
    { id: "u7-5", dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
    { id: "u7-6", dayOfWeek: 3, startTime: "18:00", endTime: "20:00" },
  ],
  // Quinn: Mon–Fri 9–5, Friday evening 7–10pm
  u8: [
    { id: "u8-1", dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
    { id: "u8-2", dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
    { id: "u8-3", dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
    { id: "u8-4", dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
    { id: "u8-5", dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
    { id: "u8-6", dayOfWeek: 5, startTime: "19:00", endTime: "22:00" },
  ],
};

export const mockEvents: CyaEvent[] = [
  {
    id: "e1",
    groupId: "g1",
    groupName: "Friday Crew",
    title: "Dinner",
    description: "Weekly dinner at the usual spot",
    status: "proposed",
    proposedSlot: {
      id: "s1",
      startTime: "2026-03-20T19:00:00",
      endTime: "2026-03-20T21:00:00",
      score: 3,
    },
    rsvps: [
      { userId: "u1", userName: "Alex", status: "yes" },
      { userId: "u2", userName: "Jordan", status: "yes" },
      { userId: "u3", userName: "Sam", status: "pending" },
      { userId: "u4", userName: "Taylor", status: "no" },
    ],
  },
  {
    id: "e2",
    groupId: "g2",
    groupName: "Hiking Pals",
    title: "Trail Run",
    description: "Morning trail at Bear Creek",
    status: "confirmed",
    proposedSlot: {
      id: "s2",
      startTime: "2026-03-22T08:00:00",
      endTime: "2026-03-22T11:00:00",
      score: 3,
    },
    rsvps: [
      { userId: "u1", userName: "Alex", status: "yes" },
      { userId: "u5", userName: "Morgan", status: "yes" },
      { userId: "u6", userName: "Casey", status: "yes" },
    ],
  },
  {
    id: "e3",
    groupId: "g3",
    groupName: "Game Night",
    title: "Board Games",
    description: "Bring your favorites",
    status: "proposed",
    proposedSlot: {
      id: "s3",
      startTime: "2026-03-21T18:00:00",
      endTime: "2026-03-21T22:00:00",
      score: 4,
    },
    rsvps: [
      { userId: "u1", userName: "Alex", status: "pending" },
      { userId: "u2", userName: "Jordan", status: "yes" },
      { userId: "u7", userName: "Riley", status: "yes" },
      { userId: "u8", userName: "Quinn", status: "yes" },
      { userId: "u9", userName: "Drew", status: "pending" },
    ],
  },
];
