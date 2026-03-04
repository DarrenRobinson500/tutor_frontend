import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ExistingBookingsWeek } from "./components/ExistingBookingsWeek";
import { apiFetch } from "../utils/apiFetch";

interface StudentInfo {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  year_level: string;
  area_of_study: string;
  next_ad_hoc_booking: any;
  next_weekly_booking: any;
}

interface WeekData {
  [date: string]: {
    day_status: "past" | "today" | "future";
    bookings: any[];
  };
}

export function TutorBookingPage() {
  const { id } = useParams();
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [week1, setWeek1] = useState<WeekData | null>(null);
  const [week2, setWeek2] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [weeklyDay, setWeeklyDay] = useState<number>(1); // Monday default
  const [weeklyTime, setWeeklyTime] = useState<string>("16:00");
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [adhocStudentId, setAdhocStudentId] = useState<number | null>(null);
  const [adhocDate, setAdhocDate] = useState("");
  const [adhocTime, setAdhocTime] = useState("16:00");
  const [adhocLoading, setAdhocLoading] = useState(false);

  const [editing, setEditing] = useState<{
    date: string;
    booking: any;
    index: number;
  } | null>(null);

  const [editStart, setEditStart] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState<number | null>(null);


  // -----------------------------
  // Load booking data
  // -----------------------------
  const load = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const res = await apiFetch(`/api/tutors/${id}/booking/`);
      const data = await res.json();

      setStudents(data.students || []);
      setWeek1(data.week1 || null);
      setWeek2(data.week2 || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const reload = async () => load();

  // -----------------------------
  // Booking actions
  // -----------------------------

  const openEditor = (date: string, booking: any, index: number) => {
    setEditing({ date, booking, index });
    setEditStart(booking.start_time);
  };

// -----------------UNIFIED FUNCTIONS (CONFIRM, CREATE, EDIT, SKIP) -------------------

  const handleBookingAction = async (
    bookingId: number,
    bookingType: string,
    action: "confirm" | "delete" | "skip" | "remove_skip" | "edit",
    extra: any = {}
  ) => {
    try {
      const res = await apiFetch(`/api/tutors/${id}/booking_action/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bookingId,
          type: bookingType,
          action,
          ...extra,   // <‑‑ weekly/adhoc edit fields go here
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setMessage(data.error || "Action failed.");
        return;
      }

      if (action === "confirm") {
        setMessage(data.confirmed ? "Booking confirmed." : "Booking unconfirmed.");
      } else if (action === "delete") {
        setMessage("Booking deleted.");
      } else if (action === "skip") {
        setMessage("Booking skipped.");
      } else if (action === "remove_skip") {
        setMessage("Skip removed.");
      } else if (action === "edit") {
        setMessage("Booking updated.");
      }

      await reload();
    } catch {
      setMessage("Error performing booking action.");
    }
  };

  const handleCreateBooking = async (payload: any) => {
    const type = payload.booking_type;

    // Weekly booking → must use selectedStudentId
    if (type === "weekly") {
      if (!selectedStudentId) {
        setMessage("Please select a student for the weekly booking.");
        return;
      }
      payload.student_id = selectedStudentId;
    }

    // Ad‑hoc booking → must use adhocStudentId
    if (type === "adhoc") {
      if (!adhocStudentId) {
        setMessage("Please select a student for the ad‑hoc booking.");
        return;
      }
      payload.student_id = adhocStudentId;
    }

    setWeeklyLoading(true);
    try {
      const res = await apiFetch(`/api/tutors/${id}/create_booking/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setMessage(data.ok ? "Booking created." : data.error);
      await reload();
    } catch {
      setMessage("Error creating booking.");
    } finally {
      setWeeklyLoading(false);
    }
  };

  const createWeekly = () => {
    const pythonDay = (weeklyDay + 6) % 7;

    handleCreateBooking({
      booking_type: "weekly",
      weekday: pythonDay,
      time: weeklyTime,
    });
  };

const createAdhoc = () => {
  if (!adhocStudentId) {
    setMessage("Please select a student for the ad‑hoc booking.");
    return;
  }
  if (!adhocDate || !adhocTime) {
    setMessage("Please choose both a date and time.");
    return;
  }

  const datetime = `${adhocDate}T${adhocTime}:00`;

  handleCreateBooking({
    booking_type: "adhoc",
    datetime,
    student_id: adhocStudentId,
  });
};




  // -----------------------------
  // Render
  // -----------------------------
  return (
    <Layout>
      <div className="container mt-4">
        <h1>Bookings</h1>


        {message && <div className="alert alert-info">{message}</div>}

        {loading && (
          <div className="text-center my-3">
            <div className="spinner-border text-primary" role="status" />
          </div>
        )}

        {/* Two-week calendar */}
        {week1 && (
          <>
            <h3>Calendar</h3>
            <ExistingBookingsWeek
              week={week1}
              handleBookingAction={handleBookingAction}
            />
          </>
        )}

        {week2 && (
          <>
            <ExistingBookingsWeek
              week={week2}
              handleBookingAction={handleBookingAction}
            />
          </>
        )}


            <h4>Create Weekly Booking</h4>

            <div
              className="d-flex align-items-end gap-3 mb-4"
              style={{ flexWrap: "wrap" }}
            >

            {/* Student selector */}
            <div>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Student
              </label>
              <select
                className="form-select"
                value={selectedStudentId || ""}
                onChange={(e) => setSelectedStudentId(Number(e.target.value))}
              >
                <option value="">-- Choose a student --</option>
                {students
                  .slice()
                  .sort((a, b) =>
                    `${a.first_name} ${a.last_name}`.localeCompare(
                      `${b.first_name} ${b.last_name}`
                    )
                  )
                  .map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.first_name} {s.last_name}
                    </option>
                  ))}
              </select>
            </div>

              {/* Day selector */}
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Day</label>
                <select
                  className="form-select"
                  value={weeklyDay}
                  onChange={(e) => setWeeklyDay(Number(e.target.value))}
                >
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                  <option value={0}>Sunday</option>
                </select>
              </div>

              {/* Time selector */}
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={weeklyTime}
                  onChange={(e) => setWeeklyTime(e.target.value)}
                />
              </div>

              {/* Create button */}
              <div>
                <button
                  className="btn btn-primary"
                  onClick={createWeekly}
                  disabled={weeklyLoading}
                >
                  {weeklyLoading ? "Creating…" : "Create weekly booking"}
                </button>
              </div>
            </div>

            <h4>Create One-off Booking</h4>

            <div
              className="d-flex align-items-end gap-3 mb-4"
              style={{ flexWrap: "wrap" }}
            >
              {/* Student selector */}
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Select a student
                </label>
                <select
                  className="form-select"
                  value={adhocStudentId || ""}
                  onChange={(e) => setAdhocStudentId(Number(e.target.value))}
                >
                  <option value="">-- Choose a student --</option>
                  {students
                    .slice()
                    .sort((a, b) =>
                      `${a.first_name} ${a.last_name}`.localeCompare(
                        `${b.first_name} ${b.last_name}`
                      )
                    )
                    .map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.first_name} {s.last_name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Date selector */}
              <div>
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={adhocDate}
                  onChange={(e) => setAdhocDate(e.target.value)}
                />
              </div>

              {/* Time selector */}
              <div>
                <label className="form-label">Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={adhocTime}
                  onChange={(e) => setAdhocTime(e.target.value)}
                />
              </div>

              {/* Create button */}
              <div>
                <button
                  className="btn btn-primary"
                  onClick={createAdhoc}
                  disabled={adhocLoading}
                >
                  {adhocLoading ? "Creating…" : "Create ad‑hoc booking"}
                </button>
              </div>
            </div>





      </div>
    </Layout>
  );
}