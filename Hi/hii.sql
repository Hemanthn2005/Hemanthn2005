-- Create and use database
DROP DATABASE IF EXISTS hospital_complete;
-- Enhanced database schema with views and triggers

-- Create database and use it
CREATE DATABASE IF NOT EXISTS hospital_complete;
USE hospital_complete;

-- Specializations table (3NF)
CREATE TABLE IF NOT EXISTS specializations (
  specialization_id INT AUTO_INCREMENT PRIMARY KEY,
  specialization_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

-- Departments table (3NF)
CREATE TABLE IF NOT EXISTS departments (
  department_id INT AUTO_INCREMENT PRIMARY KEY,
  department_name VARCHAR(100) NOT NULL UNIQUE,
  head_doctor_id INT
);

-- Doctors table with proper normalization
CREATE TABLE IF NOT EXISTS doctors (
  doctor_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  specialization_id INT,
  department_id INT,
  room_number VARCHAR(10),
  email VARCHAR(100) UNIQUE,
  phone VARCHAR(15),
  hire_date DATE,
  salary DECIMAL(10,2),
  FOREIGN KEY (specialization_id) REFERENCES specializations(specialization_id),
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- Insurance companies table (3NF)
CREATE TABLE IF NOT EXISTS insurance_companies (
  company_id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(100) NOT NULL UNIQUE,
  contact_number VARCHAR(15),
  email VARCHAR(100),
  address TEXT
);

-- Insurance policies table
CREATE TABLE IF NOT EXISTS insurance (
  insurance_id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT,
  policy_number VARCHAR(50) UNIQUE,
  coverage_details TEXT,
  coverage_limit DECIMAL(10,2),
  valid_till DATE,
  premium_amount DECIMAL(8,2),
  FOREIGN KEY (company_id) REFERENCES insurance_companies(company_id)
);

-- Patients table with improved structure
CREATE TABLE IF NOT EXISTS patients (
  patient_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  age INT,
  gender ENUM('Male','Female','Other'),
  contact VARCHAR(15),
  email VARCHAR(100),
  address TEXT,
  emergency_contact VARCHAR(15),
  medical_history TEXT,
  admission_date DATE,
  insurance_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (insurance_id) REFERENCES insurance(insurance_id)
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  appointment_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT,
  doctor_id INT,
  appointment_date DATETIME,
  status ENUM('Scheduled','Completed','Cancelled','No-show') DEFAULT 'Scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);

-- Treatments table
CREATE TABLE IF NOT EXISTS treatments (
  treatment_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT,
  doctor_id INT,
  treatment_date DATE,
  diagnosis TEXT,
  description TEXT,
  medicine_prescribed TEXT,
  follow_up_date DATE,
  status ENUM('Ongoing','Completed','Discontinued') DEFAULT 'Ongoing',
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  bill_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT,
  treatment_id INT,
  total_amount DECIMAL(10,2) NOT NULL,
  insurance_covered DECIMAL(10,2) DEFAULT 0,
  patient_payable DECIMAL(10,2) DEFAULT 0,
  payment_status ENUM('Paid','Unpaid','Partial') DEFAULT 'Unpaid',
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (treatment_id) REFERENCES treatments(treatment_id)
);

-- Payments table for payment tracking
CREATE TABLE IF NOT EXISTS payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT,
  amount_paid DECIMAL(10,2),
  payment_date DATE,
  payment_method ENUM('Cash','Card','Insurance','Online'),
  transaction_id VARCHAR(100),
  FOREIGN KEY (bill_id) REFERENCES bills(bill_id)
);

-- Insert sample data
INSERT INTO specializations (specialization_name, description) VALUES
('Cardiology', 'Heart and cardiovascular system specialist'),
('Neurology', 'Nervous system disorders specialist'),
('Orthopedics', 'Bones and joints specialist'),
('Pediatrics', 'Child healthcare specialist'),
('Dermatology', 'Skin diseases specialist');

INSERT INTO departments (department_name, head_doctor_id) VALUES
('Cardiology Department', NULL),
('Neurology Department', NULL),
('Orthopedics Department', NULL),
('Pediatrics Department', NULL),
('Emergency Department', NULL);

INSERT INTO doctors (name, specialization_id, department_id, room_number, email, phone, hire_date, salary) VALUES
('Dr. Sarah Wilson', 1, 1, '101', 'sarah.wilson@hospital.com', '1234567890', '2020-01-15', 120000),
('Dr. Michael Chen', 2, 2, '102', 'michael.chen@hospital.com', '1234567891', '2019-03-20', 110000),
('Dr. Emily Davis', 3, 3, '103', 'emily.davis@hospital.com', '1234567892', '2021-06-10', 100000),
('Dr. James Brown', 4, 4, '104', 'james.brown@hospital.com', '1234567893', '2018-11-05', 95000);

INSERT INTO insurance_companies (company_name, contact_number, email, address) VALUES
('HealthGuard Inc', '1800-HEALTH', 'info@healthguard.com', '123 Insurance Ave, City'),
('MediShield Corp', '1800-MEDISHIELD', 'support@medishield.com', '456 Healthcare St, City'),
('WellCare Providers', '1800-WELLCARE', 'contact@wellcare.com', '789 Wellness Rd, City');

INSERT INTO insurance (company_id, policy_number, coverage_details, coverage_limit, valid_till, premium_amount) VALUES
(1, 'HG-001', 'Comprehensive health coverage', 500000, '2024-12-31', 5000),
(2, 'MS-001', 'Basic health coverage', 200000, '2024-06-30', 3000),
(3, 'WC-001', 'Premium health coverage', 1000000, '2024-09-15', 8000);

-- Make sure we have sample data
INSERT IGNORE INTO patients (patient_id, name, age, gender, contact, email, emergency_contact, medical_history, admission_date, insurance_id) VALUES
(1, 'John Smith', 45, 'Male', '555-0101', 'john.smith@email.com', '555-0102', 'Hypertension, Diabetes', '2024-01-15', 1),
(2, 'Maria Garcia', 32, 'Female', '555-0103', 'maria.garcia@email.com', '555-0104', 'Asthma', '2024-01-20', 2),
(3, 'Robert Johnson', 58, 'Male', '555-0105', 'robert.johnson@email.com', '555-0106', 'Heart condition', '2024-01-25', 3);

INSERT IGNORE INTO treatments (treatment_id, patient_id, doctor_id, treatment_date, diagnosis, description, medicine_prescribed, follow_up_date, status) VALUES
(1, 1, 1, '2024-01-16', 'Hypertension check', 'Blood pressure monitoring', 'Lisinopril 10mg', '2024-02-16', 'Completed'),
(2, 2, 2, '2024-01-21', 'Asthma review', 'Lung function test', 'Albuterol inhaler', '2024-02-21', 'Ongoing');

-- Create Views
CREATE VIEW patient_treatment_summary AS
SELECT 
    p.patient_id,
    p.name as patient_name,
    p.age,
    p.gender,
    COUNT(DISTINCT a.appointment_id) as total_appointments,
    COUNT(DISTINCT t.treatment_id) as total_treatments,
    COALESCE(SUM(b.total_amount), 0) as total_billing_amount,
    MAX(b.created_at) as last_bill_date
FROM patients p
LEFT JOIN appointments a ON p.patient_id = a.patient_id
LEFT JOIN treatments t ON p.patient_id = t.patient_id
LEFT JOIN bills b ON p.patient_id = b.patient_id
GROUP BY p.patient_id, p.name, p.age, p.gender;

CREATE VIEW doctor_performance AS
SELECT 
    d.doctor_id,
    d.name as doctor_name,
    s.specialization_name,
    dep.department_name,
    COUNT(DISTINCT a.appointment_id) as total_appointments,
    COUNT(DISTINCT t.treatment_id) as total_treatments,
    AVG(b.total_amount) as avg_billing_amount
FROM doctors d
LEFT JOIN specializations s ON d.specialization_id = s.specialization_id
LEFT JOIN departments dep ON d.department_id = dep.department_id
LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
LEFT JOIN treatments t ON d.doctor_id = t.doctor_id
LEFT JOIN bills b ON t.treatment_id = b.treatment_id
GROUP BY d.doctor_id, d.name, s.specialization_name, dep.department_name;

-- Create Triggers
DELIMITER //

-- Trigger to automatically calculate patient_payable when bill is inserted
CREATE TRIGGER calculate_patient_payable 
BEFORE INSERT ON bills
FOR EACH ROW
BEGIN
    SET NEW.patient_payable = NEW.total_amount - NEW.insurance_covered;
END//

-- Trigger to update bill payment status when payment is made
CREATE TRIGGER update_bill_status 
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    DECLARE total_paid DECIMAL(10,2);
    DECLARE total_amount DECIMAL(10,2);
    
    SELECT SUM(amount_paid), b.total_amount INTO total_paid, total_amount
    FROM payments p
    JOIN bills b ON p.bill_id = b.bill_id
    WHERE p.bill_id = NEW.bill_id;
    
    IF total_paid >= total_amount THEN
        UPDATE bills SET payment_status = 'Paid' WHERE bill_id = NEW.bill_id;
    ELSEIF total_paid > 0 THEN
        UPDATE bills SET payment_status = 'Partial' WHERE bill_id = NEW.bill_id;
    END IF;
END//

DELIMITER ;
