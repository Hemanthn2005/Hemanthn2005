const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Hemanth@123',
  database: 'hospital_complete'
});

db.connect(err => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('✅ MySQL Connected');
});

// ✅ Root route - serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Doctors routes
app.get('/doctors', (req, res) => {
  const sql = 'SELECT doctor_id, name, specialization, room_number, email FROM doctors';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching doctors:', err);
      return res.status(500).json({ error: 'Failed to fetch doctors' });
    }
    res.json(results);
  });
});

// ✅ Patients routes
app.get('/patients', (req, res) => {
  const sql = `
    SELECT p.patient_id, p.name, p.age, p.gender, p.contact, p.medical_history, 
           p.admission_date, i.provider_name, i.insurance_id
    FROM patients p
    LEFT JOIN insurance i ON p.insurance_id = i.insurance_id
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

app.get('/patients/search/:name', (req, res) => {
  const name = req.params.name;
  const sql = `
    SELECT p.patient_id, p.name, p.age, p.gender, p.contact, p.medical_history, 
           p.admission_date, i.provider_name
    FROM patients p
    LEFT JOIN insurance i ON p.insurance_id = i.insurance_id
    WHERE p.name LIKE ?
  `;
  db.query(sql, [`%${name}%`], (err, results) => {
    if (err) {
      console.error('Error searching patients:', err);
      return res.status(500).json({ error: 'Failed to search patients' });
    }
    res.json(results);
  });
});

app.post('/patients/add', (req, res) => {
  const { name, age, gender, contact, medical_history, admission_date, insurance_id } = req.body;
  
  // Convert empty insurance_id to null
  const insuranceIdValue = insurance_id ? insurance_id : null;
  
  const sql = `
    INSERT INTO patients (name, age, gender, contact, medical_history, admission_date, insurance_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.query(sql, [name, age, gender, contact, medical_history, admission_date, insuranceIdValue], (err, result) => {
    if (err) {
      console.error('Error adding patient:', err);
      return res.status(500).json({ error: 'Failed to add patient' });
    }
    res.json({ success: true, patient_id: result.insertId });
  });
});

// ✅ Appointments routes
app.get('/appointments', (req, res) => {
  const sql = `
    SELECT a.appointment_id, p.name as patient_name, d.name as doctor_name, a.appointment_date
    FROM appointments a
    JOIN patients p ON a.patient_id = p.patient_id
    JOIN doctors d ON a.doctor_id = d.doctor_id
    ORDER BY a.appointment_date DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching appointments:', err);
      return res.status(500).json({ error: 'Failed to fetch appointments' });
    }
    res.json(results);
  });
});

app.post('/appointments/add', (req, res) => {
  const { patient_id, doctor_id, appointment_date } = req.body;
  
  const sql = 'INSERT INTO appointments (patient_id, doctor_id, appointment_date) VALUES (?, ?, ?)';
  
  db.query(sql, [patient_id, doctor_id, appointment_date], (err, result) => {
    if (err) {
      console.error('Error adding appointment:', err);
      return res.status(500).json({ error: 'Failed to add appointment' });
    }
    res.json({ success: true, appointment_id: result.insertId });
  });
});

// ✅ Treatments routes
app.get('/treatments', (req, res) => {
  const sql = `
    SELECT t.treatment_id, p.name as patient_name, d.name as doctor_name, 
           t.treatment_date, t.description, t.medicine_prescribed
    FROM treatments t
    JOIN patients p ON t.patient_id = p.patient_id
    JOIN doctors d ON t.doctor_id = d.doctor_id
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

app.post('/treatments/add', (req, res) => {
  const { patient_id, doctor_id, treatment_date, description, medicine_prescribed } = req.body;
  
  const sql = `
    INSERT INTO treatments (patient_id, doctor_id, treatment_date, description, medicine_prescribed)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.query(sql, [patient_id, doctor_id, treatment_date, description, medicine_prescribed], (err, result) => {
    if (err) {
      console.error('Error adding treatment:', err);
      return res.status(500).json({ error: 'Failed to add treatment' });
    }
    res.json({ success: true, treatment_id: result.insertId });
  });
});

// ✅ Bills routes
app.get('/bills', (req, res) => {
  const sql = `
    SELECT b.bill_id, b.total_amount, b.payment_status, b.created_at,
           p.name as patient_name, t.description as treatment_description
    FROM bills b
    JOIN patients p ON b.patient_id = p.patient_id
    LEFT JOIN treatments t ON b.treatment_id = t.treatment_id
    ORDER BY b.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching bills:', err);
      return res.status(500).json({ error: 'Failed to fetch bills' });
    }
    res.json(results);
  });
});

app.post('/bills/add', (req, res) => {
  const { patient_id, treatment_id, total_amount, payment_status } = req.body;
  
  // Convert empty treatment_id to null
  const treatmentIdValue = treatment_id ? treatment_id : null;
  
  const sql = 'INSERT INTO bills (patient_id, treatment_id, total_amount, payment_status) VALUES (?, ?, ?, ?)';
  
  db.query(sql, [patient_id, treatmentIdValue, total_amount, payment_status], (err, result) => {
    if (err) {
      console.error('Error adding bill:', err);
      return res.status(500).json({ error: 'Failed to add bill' });
    }
    res.json({ success: true, bill_id: result.insertId });
  });
});

// ✅ Insurance routes
app.get('/insurance', (req, res) => {
  const sql = 'SELECT * FROM insurance ORDER BY insurance_id DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching insurance:', err);
      return res.status(500).json({ error: 'Failed to fetch insurance' });
    }
    res.json(results);
  });
});

app.post('/insurance/add', (req, res) => {
  const { provider_name, policy_number, coverage_details, valid_till } = req.body;
  
  const sql = 'INSERT INTO insurance (provider_name, policy_number, coverage_details, valid_till) VALUES (?, ?, ?, ?)';
  
  db.query(sql, [provider_name, policy_number, coverage_details, valid_till], (err, result) => {
    if (err) {
      console.error('Error adding insurance:', err);
      return res.status(500).json({ error: 'Failed to add insurance' });
    }
    res.json({ success: true, insurance_id: result.insertId });
  });
});

// ✅ Test route to check if server is working
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Test the server: http://localhost:${PORT}/test`);
});