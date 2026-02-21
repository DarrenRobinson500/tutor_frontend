import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { WeeklyBookingCalendar } from "./components/WeeklyBookingCalendar";
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

export function TutorBookingPage() {
  const { id } = useParams(); // tutor id
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [weeklyAvailability, setWeeklyAvailability] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [manualWeekday, setManualWeekday] = useState<number>(0);
  const [manualTime, setManualTime] = useState<string>("");
  const [manualMessage, setManualMessage] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [editingBooking, setEditingBooking] = useState<{
    weekday: number;
    index: number;
  } | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editDuration, setEditDuration] = useState(60);
  const [editLoading, setEditLoading] = useState(false);




  // -----------------------------
  // Load tutor booking data
  // -----------------------------
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/tutors/${id}/booking/`);
        const data = await res.json();

        setStudents(data.students || []);
        setWeeklyAvailability(data.weekly_availability || {});
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  // -----------------------------
  // Handle ad hoc booking
  // -----------------------------
  const handleSelectSlot = async (day: string, start: string, end: string) => {
    if (!selectedStudentId) {
      setMessage("Please select a student first.");
      return;
    }

    setMessage("Booking…");

    const payload = {
      student_id: selectedStudentId,
      date: day,
      time: start,
      repeat_weekly: false,
    };

    try {
      const res = await apiFetch(`/api/tutors/${id}/check_and_book/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.created > 0) {
        setMessage("Appointment booked.");
      } else {
        setMessage("Could not book appointment.");
      }

      // Reload availability + students
      const reload = await apiFetch(`/api/tutors/${id}/booking/`);
      const fresh = await reload.json();

      setWeeklyAvailability(fresh.weekly_availability);
      setStudents(fresh.students);

    } catch (err) {
      setMessage("Error booking appointment.");
    }
  };

  // -----------------------------
  // Handle weekly booking
  // -----------------------------
  const handleBookWeekly = async (weekday: number, time: string) => {
    if (!selectedStudentId) {
      setMessage("Please select a student first.");
      return;
    }

    setMessage("Booking weekly session…");

    try {
      const res = await apiFetch(`/api/tutors/${id}/create_weekly_booking/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selectedStudentId,
          weekday,
          time,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage("Weekly session booked.");
      } else {
        setMessage(data.error || "Could not book weekly session.");
      }

      // Reload availability + students
      const reload = await apiFetch(`/api/tutors/${id}/booking/`);
      const fresh = await reload.json();

      setWeeklyAvailability(fresh.weekly_availability);
      setStudents(fresh.students);

    } catch (err) {
      setMessage("Error booking weekly session.");
    }
  };

  const handleManualWeeklyCreate = async () => {
    if (!selectedStudentId) {
      setManualMessage("Please select a student first.");
      return;
    }
    if (!manualTime) {
      setManualMessage("Please choose a time.");
      return;
    }

    setManualLoading(true);
    setManualMessage("");

    try {
      const res = await apiFetch(`/api/tutors/${id}/create_weekly_booking/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selectedStudentId,
          weekday: manualWeekday,
          time: manualTime,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setManualMessage("Weekly session created.");
      } else {
        setManualMessage(data.error || "Could not create weekly session.");
      }

      // Reload availability + students
      const reload = await apiFetch(`/api/tutors/${id}/booking/`);
      const fresh = await reload.json();
      setWeeklyAvailability(fresh.weekly_availability);
      setStudents(fresh.students);

    } catch (err) {
      setManualMessage("Error creating weekly session.");
    } finally {
      setManualLoading(false);
    }
  };


  const handleDeleteWeeklyBooking = async (weekday: number, time: string) => {
    if (!id) return;

    await apiFetch(`/api/tutors/${id}/delete_weekly_booking/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekday, time }),
    });

    // Reload availability + students
    const reload = await apiFetch(`/api/tutors/${id}/booking/`);
    const fresh = await reload.json();

    setWeeklyAvailability(fresh.weekly_availability);
    setStudents(fresh.students);
  };

  function formatTime(t: any) {
    if (!t || typeof t !== "string" || !t.includes(":")) {
      return "";
    }

    const [h, m] = t.split(":").map(Number);
    const date = new Date();
    date.setHours(h, m);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

    function computeDuration(start: string, end: string): number {
    if (!start || !end) return 60; // fallback

    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    const diff = endMinutes - startMinutes;
    return diff > 0 ? diff : 60; // fallback if something weird happens
  }

  const openEditor = (weekday: number, idx: number, booking: any) => {
    setEditingBooking({ weekday, index: idx });
    setEditStart(booking.start_time);
    setEditDuration(
      booking.duration_minutes ||
      (booking.end_time && booking.start_time
        ? computeDuration(booking.start_time, booking.end_time)
        : 60)
    );
  };

  const handleSaveWeeklyEdit = async (
    weekday: number,
    booking: any,
    newStart: string,
    duration: number
  ) => {
    setEditLoading(true);

    try {
      const res = await apiFetch(`/api/tutors/${id}/edit_weekly_booking/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekday,
          old_time: booking.start_time,
          new_time: newStart,
          duration_minutes: duration,
          student_id: booking.student_id,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setMessage(data.error || "Could not update weekly booking.");
      } else {
        setMessage("Weekly booking updated.");
      }

      // Reload
      const reload = await apiFetch(`/api/tutors/${id}/booking/`);
      const fresh = await reload.json();
      setWeeklyAvailability(fresh.weekly_availability);
      setStudents(fresh.students);

      setEditingBooking(null);
    } catch (err) {
      setMessage("Error updating weekly booking.");
    } finally {
      setEditLoading(false);
    }
  };








  return (
    <Layout>
      <div className="container mt-4">
        <h1>Existing Bookings</h1>
          {/* Weekly Overview */}

{weeklyAvailability && (
  <div className="mt-4">

    <div
      className="weekly-booking-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: "0px",
      }}
    >
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, weekday) => {
        const dayData = weeklyAvailability[weekday] || { bookings: [] };
        const bookings = (dayData.bookings || []).slice().sort((a: any, b: any) => {
          const t1 = a.start_time || a.time || a.start;
          const t2 = b.start_time || b.time || b.start;
          return t1.localeCompare(t2);
        });


        return (
          <div
            key={weekday}
            className="day-column"
            style={{
              border: "1px solid #ccc",
              padding: "10px",
              borderRadius: "6px",
              minHeight: "120px",
            }}
          >
            <h5 style={{ textAlign: "center" }}>{day}</h5>

{bookings.map((b: any, idx: number) => {
  const time = b.start_time || b.time || b.start || "";

  const isEditing =
    editingBooking &&
    editingBooking.weekday === weekday &&
    editingBooking.index === idx;

  return (
    <div key={idx}>
      {/* Booking card as a button */}
      <button
        className="card w-100 text-start"
        style={{
          padding: "6px 8px",
          marginTop: "6px",
          borderRadius: "6px",
          border: "1px solid #ddd",
          background: "#f8f9fa",
          fontSize: "0.8rem",
        }}
        onClick={() => openEditor(weekday, idx, b)}
      >
        <strong>{time ? formatTime(time) : ""}</strong>
        <b>{b.student_name}</b>
        {(() => {
          const duration = computeDuration(b.start_time, b.end_time);
          return duration !== 60 ? `(${duration}m)` : "";
        })()}
      </button>


      {/* Expanded editor */}
      {isEditing && (
        <div
          className="border rounded p-2 mt-2"
          style={{ background: "#fff" }}
        >
          <div className="mb-2">
            <label className="form-label">Start Time</label>
            <input
              type="time"
              className="form-control"
              value={editStart}
              onChange={(e) => setEditStart(e.target.value)}
            />
          </div>

          <div className="mb-2">
            <label className="form-label">Duration (minutes)</label>
            <input
              type="number"
              className="form-control"
              value={editDuration}
              onChange={(e) => setEditDuration(Number(e.target.value))}
            />
          </div>

          <div className="d-flex gap-2 mt-3">
            <button
              className="btn btn-danger ms-auto"
              onClick={() => handleDeleteWeeklyBooking(weekday, b.start_time)}
            >
              Delete
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setEditingBooking(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-success"
              onClick={() =>
                handleSaveWeeklyEdit(weekday, b, editStart, editDuration)
              }
              disabled={editLoading}
            >
              {editLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  ></span>
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </button>


          </div>
        </div>
      )}
    </div>
  );
})}

          </div>
        );
      })}
    </div>
  </div>
)}
<br/>

        <h1>New Bookings</h1>

        {/* Student dropdown */}
        <div className="mb-4">
          <label className="form-label" style={{ fontWeight: 600 }}>
            Select a student
          </label>
          <select
            className="form-select"
            value={selectedStudentId || ""}
            onChange={(e) => setSelectedStudentId(Number(e.target.value))}
          >
            <option value="">-- Choose a student --</option>
              {students
                .slice() // avoid mutating state
                .sort((a, b) => {
                  const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
                  const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
                  return nameA.localeCompare(nameB);
                })
                .map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.first_name} {s.last_name}
                  </option>
                ))}
          </select>
        </div>

        {message && (
          <div className="alert alert-info">{message}</div>
        )}

        {loading && (
          <div className="text-center my-3">
            <div className="spinner-border text-primary" role="status" />
          </div>
        )}

{/* Manual Weekly Booking */}
<div className="p-3 mb-4 border rounded" style={{ background: "#f8f9fa" }}>
  <h4>Create Weekly Booking</h4>

  {manualMessage && (
    <div className="alert alert-info mt-2">{manualMessage}</div>
  )}

  <div className="row mt-3">
    <div className="col-md-4">
      <label className="form-label">Day</label>
      <select
        className="form-select"
        value={manualWeekday}
        onChange={(e) => setManualWeekday(Number(e.target.value))}
      >
        <option value={0}>Monday</option>
        <option value={1}>Tuesday</option>
        <option value={2}>Wednesday</option>
        <option value={3}>Thursday</option>
        <option value={4}>Friday</option>
        <option value={5}>Saturday</option>
        <option value={6}>Sunday</option>
      </select>
    </div>

    <div className="col-md-4">
      <label className="form-label">Start Time</label>
      <input
        type="time"
        className="form-control"
        value={manualTime}
        onChange={(e) => setManualTime(e.target.value)}
      />
    </div>

    <div className="col-md-4 d-flex align-items-end">
      <button
        className="btn btn-primary w-100"
        onClick={handleManualWeeklyCreate}
        disabled={manualLoading}
      >
        {manualLoading ? "Creating…" : "Create Appointment"}
      </button>
    </div>
  </div>
</div>


        {/* WeeklyBookingCalendar */}
        {!loading && weeklyAvailability && (
          <WeeklyBookingCalendar
            availability={weeklyAvailability}
            mode="tutor"
            onBook={handleBookWeekly}
            onDelete={handleDeleteWeeklyBooking}
          />
        )}
      </div>
    </Layout>
  );
}