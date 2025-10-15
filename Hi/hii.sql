-- Create database
DROP DATABASE IF EXISTS hospital;
CREATE DATABASE hospital;
USE hospital;
-- Create complete database
DROP DATABASE IF EXISTS hospital_complete;
CREATE DATABASE hospital_complete;
USE hospital_complete;

-- Doctors table
CREATE TABLE doctors (
  doctor_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  specialization VARCHAR(100),
  room_number VARCHAR(10),
  email VARCHAR(100)
);

-- Insurance table
CREATE TABLE insurance (
  insurance_id INT AUTO_INCREMENT PRIMARY KEY,
  provider_name VARCHAR(100) NOT NULL,
  policy_number VARCHAR(50) UNIQUE,
  coverage_details TEXT,
  valid_till DATE
);

-- Patients table
CREATE TABLE patients (
  patient_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  age INT,
  gender VARCHAR(10),
  contact VARCHAR(15),
  medical_history TEXT,
  admission_date DATE,
  insurance_id INT,
  FOREIGN KEY (insurance_id) REFERENCES insurance(insurance_id)
);

-- Appointments table
CREATE TABLE appointments (
  appointment_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT,
  doctor_id INT,
  appointment_date DATE,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);

-- Treatments table
CREATE TABLE treatments (
  treatment_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT,
  doctor_id INT,
  treatment_date DATE,
  description TEXT,
  medicine_prescribed TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);

-- Bills table
CREATE TABLE bills (
  bill_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT,
  treatment_id INT,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status ENUM('Paid', 'Unpaid', 'Partial') DEFAULT 'Unpaid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (treatment_id) REFERENCES treatments(treatment_id)
);

-- Insert sample data
INSERT INTO doctors (name, specialization, room_number, email) VALUES
('Dr. Asha Menon', 'Cardiologist', '101A', 'asha.menon@hospital.com'),
('Dr. Ravi Kumar', 'Orthopedic', '102B', 'ravi.kumar@hospital.com'),
('Dr. Priya Sharma', 'Pediatrician', '103C', 'priya.sharma@hospital.com');

INSERT INTO insurance (provider_name, policy_number, coverage_details, valid_till) VALUES
('LIC HealthCare', 'LIC12345', 'Full hospitalization coverage', '2026-12-31'),
('ICICI Lombard', 'ICICI67890', 'OPD and diagnostics', '2027-06-30'),
('Star Health', 'STAR54321', 'Comprehensive health insurance', '2026-08-15');

INSERT INTO patients (name, age, gender, contact, medical_history, admission_date, insurance_id) VALUES
('Ramesh Gupta', 45, 'Male', '9811122233', 'Hypertension, Diabetes', '2025-01-15', 1),
('Sunita Patel', 32, 'Female', '9823344556', 'Asthma, Allergies', '2025-01-16', 2),
('Amit Singh', 28, 'Male', '9834567890', 'Fracture in right arm', '2025-01-17', NULL);

INSERT INTO appointments (patient_id, doctor_id, appointment_date) VALUES
(1, 1, '2025-01-20'),
(2, 3, '2025-01-21'),
(3, 2, '2025-01-22');

INSERT INTO treatments (patient_id, doctor_id, treatment_date, description, medicine_prescribed) VALUES
(1, 1, '2025-01-15', 'Cardiac checkup and ECG', 'Amlodipine 5mg, Metformin 500mg'),
(2, 3, '2025-01-16', 'Asthma treatment and allergy test', 'Salbutamol inhaler, Cetirizine'),
(3, 2, '2025-01-17', 'Fracture treatment and cast', 'Pain killers, Calcium supplements');

INSERT INTO bills (patient_id, treatment_id, total_amount, payment_status) VALUES
(1, 1, 2500.00, 'Paid'),
(2, 2, 1800.50, 'Unpaid'),
(3, 3, 3200.75, 'Partial');
