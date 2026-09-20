/**
 * Shared TypeScript types. They mirror the database enums and views defined in
 * /supabase/migrations.
 */

export type StayStatus = "pending" | "active" | "checked_out" | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type RoomType = "single" | "double";
/** How a stay is billed: per night, or one flat price for a short stay. */
export type RateKind = "night" | "short";
export type RoomState = "available" | "occupied" | "out_of_service";
export type StaffRole = "admin" | "staff";

/** Signed-in staff member (profiles row + auth email). */
export interface Profile {
  id: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  email: string;
}

/** One row of the `stay_details` view. */
export interface StayDetail {
  id: string;
  status: StayStatus;
  check_in: string;
  expected_check_out: string;
  actual_check_out: string | null;
  price_per_night: number;
  rate_kind: RateKind;
  payment_status: PaymentStatus;
  notes: string | null;
  nights: number;
  total_amount: number;
  guest_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  id_number: string;
  address: string;
  room_id: string;
  room_number: string;
  room_type: RoomType;
}

/** One row of the `room_status` view. */
export interface RoomStatusRow {
  id: string;
  room_number: string;
  room_type: RoomType;
  price_per_night: number;
  price_short_stay: number;
  is_active: boolean;
  state: RoomState;
  stay_id: string | null;
  guest_name: string | null;
  expected_check_out: string | null;
}

/** Result of the `dashboard_stats` database function. */
export interface DashboardStats {
  checked_in_guests: number;
  available_rooms: number;
  total_rooms: number;
  checkouts_today: number;
  overdue_checkouts: number;
  total_stays: number;
}

/** A room as offered in the stay form's dropdown. */
export interface RoomOption {
  id: string;
  room_number: string;
  room_type: RoomType;
  price_per_night: number;
  price_short_stay: number;
  /** True when someone is in the room right now (future bookings are still allowed). */
  occupied: boolean;
}

/** State returned by form-based server actions (used with useActionState). */
export type FormState =
  | {
      error?: string;
      /** Set when the action finished without redirecting (e.g. "room added"). */
      success?: boolean;
      /** Field name -> message, shown under each input. */
      fieldErrors?: Record<string, string>;
    }
  | undefined;

/** Result of button-style server actions (check out, cancel, ...). */
export type ActionResult = { error?: string } | undefined;

/** Row of report_summary(): headline numbers for a date range. */
export interface ReportSummary {
  checkins: number;
  checkouts: number;
  cancelled: number;
  billed: number;
  billed_paid: number;
  billed_partial: number;
  billed_unpaid: number;
  avg_stay_nights: number;
  avg_nightly_rate: number;
  occupied_room_nights: number;
  available_room_nights: number;
  occupancy_pct: number;
  short_stays: number;
  billed_short: number;
}

/** Row of report_daily(). */
export interface ReportDay {
  day: string; // YYYY-MM-DD
  checkins: number;
  checkouts: number;
  occupied_rooms: number;
}

/** Row of report_by_room_type(). */
export interface ReportRoomType {
  room_type: RoomType;
  rooms_count: number;
  checkins: number;
  room_nights: number;
  occupancy_pct: number;
  billed: number;
}

/** Row of report_outstanding(). */
export interface ReportOutstanding {
  stays: number;
  amount: number;
}

/** Row of the guest_summary view. */
export interface GuestSummary {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  id_number: string;
  address: string;
  stay_count: number;
  total_billed: number;
  last_check_in: string | null;
}

/** One access code as the Settings screen sees it (never the code itself). */
export interface PinStatus {
  admin: boolean;
  reception: boolean;
}
