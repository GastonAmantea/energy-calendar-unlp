-- =========================================================
-- PostgreSQL schema for Energy Consumption Calendar System
-- =========================================================

-- Optional: create a dedicated schema
-- CREATE SCHEMA energy;
-- SET search_path = energy, public;

-- ---------------------------------------------------------
-- 1) Laboratories
-- ---------------------------------------------------------
CREATE TABLE laboratory (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            TEXT        NOT NULL,
  location        TEXT        NOT NULL,
  created_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 2) Machines (each machine belongs to exactly one lab)
-- ---------------------------------------------------------
CREATE TABLE machine (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               TEXT        NOT NULL,
  power_consumption  NUMERIC(10,2) NOT NULL,  -- kW or similar unit
  created_at         TIMESTAMP   NOT NULL DEFAULT NOW(),
);

-- ---------------------------------------------------------
-- 3) Preferred hours (global; not tied to a specific lab)
--    day_of_week uses 0=Mon ... 6=Sun
-- ---------------------------------------------------------
CREATE TABLE preferred_hour (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  day_of_week        SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time         TIME        NOT NULL,
  end_time           TIME        NOT NULL,
  power_consumption  NUMERIC(10,2) NOT NULL,
  created_at         TIMESTAMP   NOT NULL DEFAULT NOW(),
  CHECK (start_time < end_time)
);

-- ---------------------------------------------------------
-- 4) Appointments (booked for one lab)
-- ---------------------------------------------------------
CREATE TABLE appointment (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  laboratory_id      INTEGER     NOT NULL REFERENCES laboratory(id) ON DELETE RESTRICT,
  user_name          TEXT        NOT NULL,
  user_email         TEXT        NOT NULL,
  appointment_date   DATE        NOT NULL,
  start_time         TIME        NOT NULL,
  end_time           TIME        NOT NULL,
  purpose            TEXT        NOT NULL,
  status             TEXT        NOT NULL CHECK (status IN ('pending','confirmed','cancelled')),
  power_consumption  NUMERIC(10,2),           -- optional direct entry; can also derive from machines
  created_at         TIMESTAMP   NOT NULL DEFAULT NOW(),

  CHECK (start_time < end_time),

  -- For enforcing lab consistency in the join table via composite FK
  UNIQUE (id, laboratory_id)
);

-- ---------------------------------------------------------
-- 5) Appointment ↔ Machines (many-to-many within SAME lab)
--    This table enforces that the machine’s lab matches the appointment’s lab.
-- ---------------------------------------------------------
CREATE TABLE appointment_machine (
  appointment_id  INTEGER   NOT NULL,
  machine_id      INTEGER   NOT NULL,
  laboratory_id   INTEGER   NOT NULL, -- carried to enforce cross-table lab matching

  PRIMARY KEY (appointment_id, machine_id),

  -- The appointment must exist and the lab must match
  FOREIGN KEY (appointment_id, laboratory_id)
    REFERENCES appointment(id, laboratory_id)
    ON DELETE CASCADE,

  -- The machine must exist and the lab must match
  FOREIGN KEY (machine_id, laboratory_id)
    REFERENCES machine(id, laboratory_id)
    ON DELETE RESTRICT
);

-- Helpful indexes
CREATE INDEX idx_machine_lab ON machine(laboratory_id);
CREATE INDEX idx_appointment_lab_date ON appointment(laboratory_id, appointment_date);
CREATE INDEX idx_appointment_machine_lab ON appointment_machine(laboratory_id);

-- ---------------------------------------------------------
-- 6) Optional: a view to compute total machine power per appointment
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW appointment_machine_power AS
SELECT
  a.id AS appointment_id,
  a.laboratory_id,
  COALESCE(SUM(m.power_consumption), 0)::NUMERIC(10,2) AS total_machine_power
FROM appointment a
LEFT JOIN appointment_machine am
  ON am.appointment_id = a.id AND am.laboratory_id = a.laboratory_id
LEFT JOIN machine m
  ON m.id = am.machine_id AND m.laboratory_id = am.laboratory_id
GROUP BY a.id, a.laboratory_id;
