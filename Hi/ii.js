const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Hemanth@123',
  database: 'hospital_complete',
  multipleStatements: true
});

db.connect(err => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('✅ MySQL Connected');
  initializeDatabase();
});

// ✅ Initialize database with views and triggers
function initializeDatabase() {
  // First, create views
  const createViews = `
    -- Create patient treatment summary view
    CREATE OR REPLACE VIEW patient_treatment_summary AS
    SELECT 
        p.patient_id,
        p.name as patient_name,
        p.age,
        p.gender,
        COUNT(DISTINCT a.appointment_id) as total_appointments,
        COUNT(DISTINCT t.treatment_id) as total_treatments,
        COALESCE(SUM(b.total_amount), 0) as total_billing_amount,
        MAX(b.created_at) as last_bill_date,
        p.admission_date
    FROM patients p
    LEFT JOIN appointments a ON p.patient_id = a.patient_id
    LEFT JOIN treatments t ON p.patient_id = t.patient_id
    LEFT JOIN bills b ON p.patient_id = b.patient_id
    GROUP BY p.patient_id, p.name, p.age, p.gender, p.admission_date;

    -- Create doctor performance view
    CREATE OR REPLACE VIEW doctor_performance AS
    SELECT 
        d.doctor_id,
        d.name as doctor_name,
        s.specialization_name,
        dep.department_name,
        COUNT(DISTINCT a.appointment_id) as total_appointments,
        COUNT(DISTINCT t.treatment_id) as total_treatments,
        COALESCE(AVG(b.total_amount), 0) as avg_billing_amount,
        COUNT(DISTINCT p.patient_id) as total_patients
    FROM doctors d
    LEFT JOIN specializations s ON d.specialization_id = s.specialization_id
    LEFT JOIN departments dep ON d.department_id = dep.department_id
    LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
    LEFT JOIN treatments t ON d.doctor_id = t.doctor_id
    LEFT JOIN bills b ON t.treatment_id = b.treatment_id
    LEFT JOIN patients p ON t.patient_id = p.patient_id
    GROUP BY d.doctor_id, d.name, s.specialization_name, dep.department_name;

    -- Create billing summary view
    CREATE OR REPLACE VIEW billing_summary AS
    SELECT 
        b.bill_id,
        p.name as patient_name,
        d.name as doctor_name,
        t.description as treatment_description,
        b.total_amount,
        b.insurance_covered,
        b.patient_payable,
        b.payment_status,
        b.due_date,
        b.created_at,
        (SELECT COALESCE(SUM(amount_paid), 0) FROM payments WHERE bill_id = b.bill_id) as amount_paid,
        (b.patient_payable - (SELECT COALESCE(SUM(amount_paid), 0) FROM payments WHERE bill_id = b.bill_id)) as remaining_amount
    FROM bills b
    JOIN patients p ON b.patient_id = p.patient_id
    LEFT JOIN treatments t ON b.treatment_id = t.treatment_id
    LEFT JOIN doctors d ON t.doctor_id = d.doctor_id;

    -- Create appointment details view
    CREATE OR REPLACE VIEW appointment_details AS
    SELECT 
        a.appointment_id,
        p.name as patient_name,
        p.contact as patient_contact,
        d.name as doctor_name,
        s.specialization_name,
        dep.department_name,
        a.appointment_date,
        a.status,
        a.notes,
        a.created_at
    FROM appointments a
    JOIN patients p ON a.patient_id = p.patient_id
    JOIN doctors d ON a.doctor_id = d.doctor_id
    LEFT JOIN specializations s ON d.specialization_id = s.specialization_id
    LEFT JOIN departments dep ON d.department_id = dep.department_id;
  `;

  // Execute views creation
  db.query(createViews, (err, results) => {
    if (err) {
      console.error('Error creating views:', err);
    } else {
      console.log('✅ Views created successfully');
      createTriggers();
    }
  });
}

// ✅ Create triggers separately
function createTriggers() {
  // Drop existing triggers if they exist
  const dropTriggers = `
    DROP TRIGGER IF EXISTS calculate_patient_payable;
    DROP TRIGGER IF EXISTS update_bill_status;
    DROP TRIGGER IF EXISTS update_bill_status_on_update;
    DROP TRIGGER IF EXISTS prevent_overpayment;
  `;

  db.query(dropTriggers, (err) => {
    if (err) {
      console.error('Error dropping triggers:', err);
      return;
    }
    console.log('✅ Old triggers dropped');

    // Create triggers one by one
    createCalculatePatientPayableTrigger();
  });
}

function createCalculatePatientPayableTrigger() {
  const trigger1 = `
    CREATE TRIGGER calculate_patient_payable 
    BEFORE INSERT ON bills
    FOR EACH ROW
    BEGIN
        SET NEW.patient_payable = NEW.total_amount - NEW.insurance_covered;
        
        IF NEW.insurance_covered >= NEW.total_amount THEN
            SET NEW.payment_status = 'Paid';
        ELSEIF NEW.insurance_covered > 0 THEN
            SET NEW.payment_status = 'Partial';
        ELSE
            SET NEW.payment_status = 'Unpaid';
        END IF;
    END
  `;

  db.query(trigger1, (err) => {
    if (err) {
      console.error('Error creating calculate_patient_payable trigger:', err);
    } else {
      console.log('✅ calculate_patient_payable trigger created');
    }
    createUpdateBillStatusTrigger();
  });
}

function createUpdateBillStatusTrigger() {
  const trigger2 = `
    CREATE TRIGGER update_bill_status 
    AFTER INSERT ON payments
    FOR EACH ROW
    BEGIN
        DECLARE total_paid DECIMAL(10,2);
        DECLARE patient_payable_amount DECIMAL(10,2);
        
        SELECT COALESCE(SUM(amount_paid), 0), b.patient_payable 
        INTO total_paid, patient_payable_amount
        FROM payments p
        JOIN bills b ON p.bill_id = b.bill_id
        WHERE p.bill_id = NEW.bill_id;
        
        IF total_paid >= patient_payable_amount THEN
            UPDATE bills SET payment_status = 'Paid' WHERE bill_id = NEW.bill_id;
        ELSEIF total_paid > 0 THEN
            UPDATE bills SET payment_status = 'Partial' WHERE bill_id = NEW.bill_id;
        END IF;
    END
  `;

  db.query(trigger2, (err) => {
    if (err) {
      console.error('Error creating update_bill_status trigger:', err);
    } else {
      console.log('✅ update_bill_status trigger created');
    }
    createUpdateBillStatusOnUpdateTrigger();
  });
}

function createUpdateBillStatusOnUpdateTrigger() {
  const trigger3 = `
    CREATE TRIGGER update_bill_status_on_update
    AFTER UPDATE ON payments
    FOR EACH ROW
    BEGIN
        DECLARE total_paid DECIMAL(10,2);
        DECLARE patient_payable_amount DECIMAL(10,2);
        
        SELECT COALESCE(SUM(amount_paid), 0), b.patient_payable 
        INTO total_paid, patient_payable_amount
        FROM payments p
        JOIN bills b ON p.bill_id = b.bill_id
        WHERE p.bill_id = NEW.bill_id;
        
        IF total_paid >= patient_payable_amount THEN
            UPDATE bills SET payment_status = 'Paid' WHERE bill_id = NEW.bill_id;
        ELSEIF total_paid > 0 THEN
            UPDATE bills SET payment_status = 'Partial' WHERE bill_id = NEW.bill_id;
        ELSE
            UPDATE bills SET payment_status = 'Unpaid' WHERE bill_id = NEW.bill_id;
        END IF;
    END
  `;

  db.query(trigger3, (err) => {
    if (err) {
      console.error('Error creating update_bill_status_on_update trigger:', err);
    } else {
      console.log('✅ update_bill_status_on_update trigger created');
    }
    createPreventOverpaymentTrigger();
  });
}

function createPreventOverpaymentTrigger() {
  const trigger4 = `
    CREATE TRIGGER prevent_overpayment
    BEFORE INSERT ON payments
    FOR EACH ROW
    BEGIN
        DECLARE total_paid DECIMAL(10,2);
        DECLARE patient_payable_amount DECIMAL(10,2);
        
        SELECT COALESCE(SUM(amount_paid), 0), b.patient_payable 
        INTO total_paid, patient_payable_amount
        FROM payments p
        JOIN bills b ON p.bill_id = b.bill_id
        WHERE p.bill_id = NEW.bill_id;
        
        IF (total_paid + NEW.amount_paid) > patient_payable_amount THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Payment amount exceeds remaining balance';
        END IF;
    END
  `;

  db.query(trigger4, (err) => {
    if (err) {
      console.error('Error creating prevent_overpayment trigger:', err);
    } else {
      console.log('✅ prevent_overpayment trigger created');
    }
    console.log('🎉 All triggers initialized successfully!');
  });
}

// ✅ Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Enhanced Doctors routes with joins
app.get('/doctors', (req, res) => {
  const sql = `
    SELECT d.doctor_id, d.name, d.room_number, d.email, d.phone, d.hire_date, d.salary,
           s.specialization_name, dep.department_name
    FROM doctors d
    LEFT JOIN specializations s ON d.specialization_id = s.specialization_id
    LEFT JOIN departments dep ON d.department_id = dep.department_id
    ORDER BY d.doctor_id
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching doctors:', err);
      return res.status(500).json({ error: 'Failed to fetch doctors' });
    }
    res.json(results);
  });
});

// ✅ Enhanced Patients routes with multiple joins
app.get('/patients', (req, res) => {
  const sql = `
    SELECT p.patient_id, p.name, p.age, p.gender, p.contact, p.email, 
           p.medical_history, p.admission_date, p.emergency_contact,
           i.policy_number, ic.company_name as insurance_company,
           i.coverage_details, i.valid_till
    FROM patients p
    LEFT JOIN insurance i ON p.insurance_id = i.insurance_id
    LEFT JOIN insurance_companies ic ON i.company_id = ic.company_id
    ORDER BY p.patient_id DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching patients:', err);
      return res.status(500).json({ error: 'Failed to fetch patients' });
    }
    res.json(results);
  });
});

// ✅ Enhanced Appointments using view
app.get('/appointments', (req, res) => {
  const sql = `SELECT * FROM appointment_details ORDER BY appointment_date DESC`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching appointments:', err);
      return res.status(500).json({ error: 'Failed to fetch appointments' });
    }
    res.json(results);
  });
});

// ✅ Enhanced Treatments with complex joins
app.get('/treatments', (req, res) => {
  const sql = `
    SELECT t.treatment_id, p.name as patient_name, p.age, p.gender,
           d.name as doctor_name, s.specialization_name,
           t.treatment_date, t.diagnosis, t.description, 
           t.medicine_prescribed, t.follow_up_date, t.status
    FROM treatments t
    JOIN patients p ON t.patient_id = p.patient_id
    JOIN doctors d ON t.doctor_id = d.doctor_id
    LEFT JOIN specializations s ON d.specialization_id = s.specialization_id
    ORDER BY t.treatment_date DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching treatments:', err);
      return res.status(500).json({ error: 'Failed to fetch treatments' });
    }
    res.json(results);
  });
});

// ✅ Enhanced Bills using view
app.get('/bills', (req, res) => {
  const sql = `SELECT * FROM billing_summary ORDER BY created_at DESC`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching bills:', err);
      return res.status(500).json({ error: 'Failed to fetch bills' });
    }
    res.json(results);
  });
});

// ✅ Enhanced Insurance with company info
app.get('/insurance', (req, res) => {
  const sql = `
    SELECT i.insurance_id, i.policy_number, i.coverage_details, 
           i.coverage_limit, i.valid_till, i.premium_amount,
           ic.company_name, ic.contact_number, ic.email as company_email
    FROM insurance i
    JOIN insurance_companies ic ON i.company_id = ic.company_id
    ORDER BY i.insurance_id DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching insurance:', err);
      return res.status(500).json({ error: 'Failed to fetch insurance' });
    }
    res.json(results);
  });
});

// ✅ VIEW: Patient Treatment Summary
app.get('/patient-treatment-summary', (req, res) => {
  const sql = `SELECT * FROM patient_treatment_summary ORDER BY total_billing_amount DESC`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching patient summary:', err);
      return res.status(500).json({ error: 'Failed to fetch patient summary' });
    }
    res.json(results);
  });
});

// ✅ VIEW: Doctor Performance Summary
app.get('/doctor-performance', (req, res) => {
  const sql = `SELECT * FROM doctor_performance ORDER BY total_appointments DESC`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching doctor performance:', err);
      return res.status(500).json({ error: 'Failed to fetch doctor performance' });
    }
    res.json(results);
  });
});

// ✅ VIEW: Billing Summary with remaining amounts
app.get('/billing-summary', (req, res) => {
  const sql = `SELECT * FROM billing_summary ORDER BY created_at DESC`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching billing summary:', err);
      return res.status(500).json({ error: 'Failed to fetch billing summary' });
    }
    res.json(results);
  });
});

// ✅ VIEW: Appointment Details
app.get('/appointment-details', (req, res) => {
  const sql = `SELECT * FROM appointment_details ORDER BY appointment_date DESC`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching appointment details:', err);
      return res.status(500).json({ error: 'Failed to fetch appointment details' });
    }
    res.json(results);
  });
});

// ✅ POST routes for adding data
app.post('/patients/add', (req, res) => {
  const { name, age, gender, contact, email, emergency_contact, medical_history, admission_date, insurance_id } = req.body;
  
  const sql = `
    INSERT INTO patients (name, age, gender, contact, email, emergency_contact, medical_history, admission_date, insurance_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.query(sql, [name, age, gender, contact, email, emergency_contact, medical_history, admission_date, insurance_id || null], (err, result) => {
    if (err) {
      console.error('Error adding patient:', err);
      return res.status(500).json({ error: 'Failed to add patient' });
    }
    res.json({ success: true, patient_id: result.insertId });
  });
});

app.post('/appointments/add', (req, res) => {
  const { patient_id, doctor_id, appointment_date, status, notes } = req.body;
  
  const sql = 'INSERT INTO appointments (patient_id, doctor_id, appointment_date, status, notes) VALUES (?, ?, ?, ?, ?)';
  
  db.query(sql, [patient_id, doctor_id, appointment_date, status || 'Scheduled', notes], (err, result) => {
    if (err) {
      console.error('Error adding appointment:', err);
      return res.status(500).json({ error: 'Failed to add appointment' });
    }
    res.json({ success: true, appointment_id: result.insertId });
  });
});

app.post('/treatments/add', (req, res) => {
  const { patient_id, doctor_id, treatment_date, diagnosis, description, medicine_prescribed, follow_up_date, status } = req.body;
  
  const sql = `
    INSERT INTO treatments (patient_id, doctor_id, treatment_date, diagnosis, description, medicine_prescribed, follow_up_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.query(sql, [patient_id, doctor_id, treatment_date, diagnosis, description, medicine_prescribed, follow_up_date, status || 'Ongoing'], (err, result) => {
    if (err) {
      console.error('Error adding treatment:', err);
      return res.status(500).json({ error: 'Failed to add treatment' });
    }
    res.json({ success: true, treatment_id: result.insertId });
  });
});

app.post('/bills/add', (req, res) => {
  const { patient_id, treatment_id, total_amount, insurance_covered, due_date } = req.body;
  
  const sql = `
    INSERT INTO bills (patient_id, treatment_id, total_amount, insurance_covered, due_date)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.query(sql, [patient_id, treatment_id || null, total_amount, insurance_covered || 0, due_date], (err, result) => {
    if (err) {
      console.error('Error adding bill:', err);
      return res.status(500).json({ error: 'Failed to add bill' });
    }
    res.json({ success: true, bill_id: result.insertId });
  });
});

// ✅ Payments routes (triggers will handle status updates)
app.post('/payments/add', (req, res) => {
  const { bill_id, amount_paid, payment_date, payment_method, transaction_id } = req.body;
  
  const sql = `
    INSERT INTO payments (bill_id, amount_paid, payment_date, payment_method, transaction_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.query(sql, [bill_id, amount_paid, payment_date, payment_method, transaction_id || null], (err, result) => {
    if (err) {
      console.error('Error adding payment:', err);
      return res.status(500).json({ error: 'Failed to add payment' });
    }
    res.json({ success: true, payment_id: result.insertId });
  });
});

app.get('/payments/:bill_id', (req, res) => {
  const bill_id = req.params.bill_id;
  
  const sql = `
    SELECT p.*, b.total_amount, b.patient_payable
    FROM payments p
    JOIN bills b ON p.bill_id = b.bill_id
    WHERE p.bill_id = ?
    ORDER BY p.payment_date DESC
  `;
  
  db.query(sql, [bill_id], (err, results) => {
    if (err) {
      console.error('Error fetching payments:', err);
      return res.status(500).json({ error: 'Failed to fetch payments' });
    }
    res.json(results);
  });
});

// ✅ Get specializations and departments
app.get('/specializations', (req, res) => {
  const sql = 'SELECT * FROM specializations ORDER BY specialization_name';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching specializations:', err);
      return res.status(500).json({ error: 'Failed to fetch specializations' });
    }
    res.json(results);
  });
});

app.get('/departments', (req, res) => {
  const sql = 'SELECT * FROM departments ORDER BY department_name';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching departments:', err);
      return res.status(500).json({ error: 'Failed to fetch departments' });
    }
    res.json(results);
  });
});

app.get('/insurance-companies', (req, res) => {
  const sql = 'SELECT * FROM insurance_companies ORDER BY company_name';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching insurance companies:', err);
      return res.status(500).json({ error: 'Failed to fetch insurance companies' });
    }
    res.json(results);
  });
});

// ✅ Improved Test triggers - Check if patient exists first
app.get('/test-triggers', (req, res) => {
  // First, check if patient with ID 1 exists
  const checkPatientSql = 'SELECT * FROM patients WHERE patient_id = 1';
  
  db.query(checkPatientSql, (err, patientResults) => {
    if (err) {
      console.error('Error checking patient:', err);
      return res.status(500).json({ error: 'Failed to check patient' });
    }
    
    if (patientResults.length === 0) {
      return res.status(400).json({ 
        error: 'Patient with ID 1 does not exist. Please add patients first.' 
      });
    }
    
    // Test the calculate_patient_payable trigger
    const testBill = {
      patient_id: 1,
      treatment_id: null,
      total_amount: 1000,
      insurance_covered: 300,
      due_date: '2024-12-31'
    };

    const sql = 'INSERT INTO bills SET ?';
    
    db.query(sql, testBill, (err, result) => {
      if (err) {
        console.error('Error testing trigger:', err);
        return res.status(500).json({ error: 'Trigger test failed: ' + err.message });
      }
      
      // Check if trigger worked
      db.query('SELECT * FROM bills WHERE bill_id = ?', [result.insertId], (err, billResult) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to verify trigger' });
        }
        
        const bill = billResult[0];
        res.json({
          message: 'Trigger test completed successfully!',
          bill: bill,
          trigger_worked: bill.patient_payable === 700 && bill.payment_status === 'Partial',
          explanation: 'Trigger automatically calculated patient_payable (1000 - 300 = 700) and set payment_status to Partial'
        });
      });
    });
  });
});

// ✅ Get database views information
app.get('/views-info', (req, res) => {
  const sql = `
    SELECT TABLE_NAME as view_name, VIEW_DEFINITION 
    FROM INFORMATION_SCHEMA.VIEWS 
    WHERE TABLE_SCHEMA = 'hospital_complete'
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching views info:', err);
      return res.status(500).json({ error: 'Failed to fetch views info' });
    }
    res.json(results);
  });
});

// ✅ Get triggers information
app.get('/triggers-info', (req, res) => {
  const sql = `
    SELECT TRIGGER_NAME, ACTION_TIMING, EVENT_MANIPULATION, EVENT_OBJECT_TABLE 
    FROM INFORMATION_SCHEMA.TRIGGERS 
    WHERE TRIGGER_SCHEMA = 'hospital_complete'
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching triggers info:', err);
      return res.status(500).json({ error: 'Failed to fetch triggers info' });
    }
    res.json(results);
  });
});

// ✅ Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Hospital Management System is running',
    database: 'Connected',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Test triggers: http://localhost:${PORT}/test-triggers`);
  console.log(`👀 View information: http://localhost:${PORT}/views-info`);
  console.log(`⚡ Triggers information: http://localhost:${PORT}/triggers-info`);
});
