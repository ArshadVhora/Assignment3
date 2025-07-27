const Appointment = require('../models/Appointment');
const Availability = require('../models/Availability');
const NotificationService = require('../utils/notificationService');
const User = require('../models/User');
const { generateCallLinkToken } = require('../utils/generateCallLink');
const NodeCache = require('node-cache');

// Initialize a 30-second TTL cache
const cache = new NodeCache({ stdTTL: 30 });

function getTimeSlots(startTime, endTime) {
  const slots = [];
  let currentTime = new Date(`1970-01-01 ${startTime}`);
  const end = new Date(`1970-01-01 ${endTime}`);

  while (currentTime < end) {
    slots.push(currentTime.toTimeString().slice(0, 5));
    currentTime.setMinutes(currentTime.getMinutes() + 30);
  }
  return slots;
}

// Book an appointment and invalidate related caches
exports.bookAppointment = async (req, res) => {
  try {
    const { patientId, doctorId, date, time } = req.body;

    // Invalidate caches for this patient and doctor
    cache.del(`appointments_patient_${patientId}`);
    cache.del(`appointments_doctor_${doctorId}`);

    // Validation
    if (!patientId || !doctorId || !date || !time)
      return res.status(400).json({ message: 'Missing required fields' });
    if (req.user.role !== 'patient')
      return res.status(403).json({ message: 'Only patients can book appointments' });
    if (req.user.id !== patientId)
      return res.status(403).json({ message: 'Cannot book appointment for other patients' });
    if (isNaN(Date.parse(date)))
      return res.status(400).json({ message: 'Invalid date' });
    if (!/^\d{2}:\d{2}$/.test(time))
      return res.status(400).json({ message: 'Invalid time format' });

    // Check availability
    const availability = await Availability.findOne({ doctorId, date });
    if (!availability)
      return res.status(409).json({ message: 'No availability for this doctor on the selected date' });
    const availableSlots = getTimeSlots(availability.startTime, availability.endTime);
    if (!availableSlots.includes(time))
      return res.status(409).json({ message: 'Selected time is not within available slots' });

    // Check for conflicts
    const conflict = await Appointment.findOne({ doctorId, date, time, status: { $ne: 'cancelled' } });
    if (conflict)
      return res.status(409).json({ message: 'Time slot already booked by another patient' });

    // Create appointment
    const appointment = new Appointment({ patientId, doctorId, date, time, status: 'confirmed' });
    await appointment.save();

    // Fetch user names
    const patient = await User.findById(patientId, 'name');
    const doctor = await User.findById(doctorId, 'name');
    const patientName = patient.name;
    const doctorName = doctor.name;

    // Schedule reminders
    const appointmentDateTime = new Date(`${date}T${time}:00`);
    const reminderTime = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000);
    await NotificationService.scheduleNotification(
      patientId,
      appointment._id,
      'appointment',
      `Reminder: Your appointment with Dr. ${doctorName} is scheduled for ${date} at ${time}.`,
      'email',
      reminderTime
    );
    await NotificationService.scheduleNotification(
      doctorId,
      appointment._id,
      'appointment',
      `Reminder: You have an appointment with ${patientName} on ${date} at ${time}.`,
      'email',
      reminderTime
    );

    const callLink = generateCallLinkToken(appointment, req.user);
    res.status(201).json({ message: 'Appointment booked successfully', appointmentId: appointment._id, callLink });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get appointments by patient with caching
exports.getAppointmentsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Auth check
    if (req.user.role === 'patient' && req.user.id !== patientId)
      return res.status(403).json({ message: 'Forbidden: access denied' });

    const cacheKey = `appointments_patient_${patientId}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    // Fetch from DB
    const appointments = await Appointment.find({ patientId }).lean();
    if (!appointments.length)
      return res.status(404).json({ message: 'No appointments found' });

    // Bulk fetch related users
    const userIds = [...new Set(appointments.flatMap(a => [a.doctorId.toString(), a.patientId.toString()]))];
    const users = await User.find({ _id: { $in: userIds } }).select('name role specialty').lean();
    const nameMap = {}, specialtyMap = {};
    users.forEach(u => {
      nameMap[u._id] = u.name;
      if (u.role === 'doctor') specialtyMap[u._id] = u.specialty;
    });

    const result = appointments.map(apt => ({
      appointmentId: apt._id,
      doctorId: apt.doctorId,
      doctorName: nameMap[apt.doctorId.toString()],
      doctorSpecialty: specialtyMap[apt.doctorId.toString()],
      patientId: apt.patientId,
      patientName: nameMap[apt.patientId.toString()],
      date: apt.date,
      time: apt.time,
      status: apt.status,
      callLink: generateCallLinkToken(apt, req.user),
      type: 'Video Consultation'
    }));

    // Cache and return
    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get appointments by doctor with caching
exports.getAppointmentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    if (req.user.role === 'doctor' && req.user.id !== doctorId)
      return res.status(403).json({ message: 'Forbidden: access denied' });

    const cacheKey = `appointments_doctor_${doctorId}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const appointments = await Appointment.find({ doctorId })
      .populate('patientId', 'name email')
      .sort({ date: 1, time: 1 })
      .lean();
    if (!appointments.length)
      return res.status(404).json({ message: 'No appointments found' });

    cache.set(cacheKey, appointments);
    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Reschedule appointment: invalidate caches
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newDate, newTime } = req.body;
    // Validation omitted for brevity

    const appointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { date: newDate, time: newTime },
      { new: true }
    );

    // Invalidate caches
    cache.del(`appointments_patient_${appointment.patientId}`);
    cache.del(`appointments_doctor_${appointment.doctorId}`);

    res.json({ message: 'Appointment rescheduled', callLink: generateCallLinkToken(appointment, req.user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Cancel appointment: invalidate caches
exports.cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment)
      return res.status(404).json({ message: 'Appointment not found' });

    // Invalidate caches
    cache.del(`appointments_patient_${appointment.patientId}`);
    cache.del(`appointments_doctor_${appointment.doctorId}`);

    appointment.status = 'cancelled';
    await appointment.save();

    res.json({ message: 'Appointment cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Update appointment status: invalidate caches
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;
    // Validation omitted

    const appointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { status },
      { new: true }
    );

    cache.del(`appointments_patient_${appointment.patientId}`);
    cache.del(`appointments_doctor_${appointment.doctorId}`);

    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get call link (no caching)
exports.getCallLink = async (req, res) => {
  try {
    const { id: appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment)
      return res.status(404).json({ message: 'Appointment not found' });

    const callLink = generateCallLinkToken(appointment, req.user);
    if (!callLink)
      return res.status(410).json({ message: 'Call link expired' });

    res.json({ callLink });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
